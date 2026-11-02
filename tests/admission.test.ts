import { afterEach, expect, it, vi } from 'vitest'
import express from 'express'
import { request as httpRequest } from 'node:http'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import { admissionGuard, validateBind } from '../server/admission.js'
import { loadConfig } from '../server/config.js'
import { Store } from '../server/store.js'
import { admit } from '../server/spend-policy.js'
import { createApiApp } from '../server/routes.js'
import { maskSecrets } from '../server/telemetry.js'

// Node fetch normalizes Host. Use the actual HTTP wire for rebinding tests.
const wire = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) => new Promise<Response>((done, fail) => {
  const req = httpRequest(url, { method: init.method, headers: init.headers }, res => {
    const chunks: Buffer[] = []
    res.on('data', chunk => chunks.push(Buffer.from(chunk)))
    res.on('end', () => done(new Response(Buffer.concat(chunks), { status: res.statusCode })))
  })
  req.on('error', fail); req.end(init.body)
})
const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); vi.unstubAllEnvs() })
const open = (path = ':memory:') => { const store = new Store(path); cleanup.push(() => store.close()); return store }
const request = (surface: 'web' | 'mcp', key: string, requestedMinor = 500) => ({ surface, principal: 'operator', question: key,
  requestedMinor, idempotencyKey: key, maxMinor: 500, ...(surface === 'mcp' ? { dailyMinor: 5000 } : {}) })

it('admits a S$5 web run then only S$1 MCP at a wallet cap of S$6, across connections and restart', () => {
  vi.stubEnv('WALLET_DAILY_CAP_MINOR', '600')
  const dir = mkdtempSync(join(tmpdir(), 'admission-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
  const a = open(join(dir, 'app.db')), b = open(a.path)
  const first = admit(a, request('web', 'a')).run
  expect(first).toMatchObject({ budgetMinor: 500, policyVersion: 'wallet-v1' })
  expect(admit(b, request('mcp', 'b')).run.budgetMinor).toBe(100)
  expect(admit(a, request('web', 'c')).run.budgetMinor).toBe(0)
  expect(admit(b, request('web', 'a'))).toMatchObject({ reused: true, run: { runId: first.runId } })
  expect(() => admit(b, { ...request('web', 'a'), question: 'changed' })).toThrow('different question')
  const restarted = open(a.path)
  expect(restarted.walletStatus().reservedMinor).toBe(600)
  a.setPaused(true)
  expect(restarted.walletStatus().paused).toBe(true)
})

it('migrates legacy MCP admissions, preserving scope, idempotency and outstanding reservations', () => {
  const dir = mkdtempSync(join(tmpdir(), 'admission-migrate-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, 'app.db'), original = new Store(path)
  const run = original.createRun('legacy', 200); original.close()
  const db = new DatabaseSync(path)
  db.prepare('INSERT INTO mcp_requests VALUES (?,?,?,?,?)').run('old-key', 'legacy', run.runId, 200, '2026-11-02'); db.close()
  const migrated = open(path)
  expect(migrated.createMcpRun('legacy', 500, 'old-key', { maxMinor: 500, dailyMinor: 1000 })).toMatchObject({ reused: true, run: { runId: run.runId } })
  expect(migrated.walletStatus().reservedMinor).toBe(200)
  expect(migrated.isMcpRun(run.runId)).toBe(true)
})

it('validates non-loopback startup and masks the API token', () => {
  expect(() => validateBind(loadConfig({ HOST: '0.0.0.0' }))).toThrow('RA_API_TOKEN')
  expect(() => validateBind(loadConfig({ HOST: '0.0.0.0', RA_API_TOKEN: 'test-token' }))).not.toThrow()
  expect(maskSecrets('test-token', { RA_API_TOKEN: 'test-token' })).not.toContain('test-token')
})

it('guards runs, stop, retry, reset, pause and MCP; blocks rebinding and cross-origin requests', async () => {
  vi.stubEnv('RA_API_TOKEN', 'test-token'); vi.stubEnv('RA_ALLOWED_HOSTS', 'api.example')
  vi.stubEnv('RA_WEB_ORIGIN', 'http://127.0.0.1:6200')
  const api = await createApiApp({ dbPath: ':memory:', publisherUrl: 'http://127.0.0.1:1' })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { await api.drain(); server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); api.close() })
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  for (const [method, path] of [['POST', '/runs'], ['POST', '/runs/id/stop'], ['POST', '/runs/id/retry-delivery'], ['POST', '/api/reputation/reset'], ['POST', '/api/wallet/pause'], ['GET', '/api/mcp/status'], ['GET', '/api/mcp/search'], ['GET', '/API/MCP/status'], ['POST', '/api/mcp/runs']]) {
    for (const token of ['', 'wrong-token']) {
      expect((await wire(base + path, { method, headers: { Host: 'api.example', Authorization: `Bearer ${token}` } })).status).toBe(401)
    }
    expect((await wire(base + path, { method, headers: { Host: 'evil.example', Authorization: 'Bearer test-token' } })).status).toBe(403)
  }
  expect((await wire(base + '/api/reputation/reset', { method: 'POST', headers: { Authorization: 'Bearer test-token', Origin: 'http://evil.example' } })).status).toBe(403)
  expect((await wire(base + '/api/reputation/reset', { method: 'POST', headers: { Authorization: 'Bearer test-token', Origin: 'http://127.0.0.1:6200' } })).status).toBe(200)
  expect((await wire(base + '/api/mcp/status', { headers: { Host: 'api.example', Authorization: 'Bearer test-token' } })).status).toBe(200)
  expect((await wire(base + '/api/mcp/status', { headers: { Authorization: 'test-token' } })).status).toBe(401)
  const pause = await wire(base + '/api/wallet/pause', { method: 'POST', headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }, body: '{"paused":true}' })
  expect(await pause.json()).toMatchObject({ paused: true, label: expect.stringContaining('nothing was charged') })
  expect((await (await wire(base + '/api/mcp/status', { headers: { Authorization: 'Bearer test-token' } })).json()).wallet.paused).toBe(true)
})

it('allows tokenless local development only with a local Host and no cross-origin browser', async () => {
  const app = express(); app.use(admissionGuard(loadConfig({}))); app.use((_req, res) => res.json({ ok: true }))
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(() => new Promise<void>(done => { server.closeAllConnections(); server.close(() => done()) }))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  expect((await wire(base, { method: 'POST' })).status).toBe(200)
  expect((await wire(base, { method: 'POST', headers: { Origin: 'null' } })).status).toBe(403)
  expect((await wire(base + '/api/wallet/pause', { method: 'POST' })).status).toBe(401)
  expect((await wire(base + '/API/WALLET/PAUSE/', { method: 'POST' })).status).toBe(401)
  expect((await wire(base, { method: 'POST', headers: { Host: 'evil.example' } })).status).toBe(403)
})
