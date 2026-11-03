import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { DatabaseSync } from 'node:sqlite'
import { auditAgentAuthority } from '../server/agent-audit.js'
import { Store } from '../server/store.js'
import { createApiApp } from '../server/routes.js'
import { createClient } from '../sdk/index.js'
import { maskSecrets } from '../server/telemetry.js'
import { assertSafe } from '../server/audit.js'
import { payPath, honestArticle } from './fixtures/pay-path.js'

const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
const temp = () => { const dir = mkdtempSync(join(tmpdir(), 'agents-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true })); return dir }
const open = (path = ':memory:') => { const store = new Store(path); cleanup.push(() => store.close()); return store }
const ask = (s: Store, id: string, key = 'same', requestedMinor = 500) => s.admit({ surface: 'agent', principal: id, question: 'allowance test', requestedMinor, idempotencyKey: key, maxMinor: 500 })
const child = (args: string[]) => new Promise<string>((done, fail) => {
  const p = spawn(process.execPath, ['--import', 'tsx', ...args], { cwd: process.cwd(), env: { ...process.env, LANGFUSE_ENABLED: '0' } })
  let out = ''; p.stdout.on('data', c => out += c); p.stderr.on('data', () => {})
  p.on('error', fail); p.on('exit', code => code === 0 ? done(out) : fail(new Error('Fixture subprocess failed')))
})

it('stores only SHA-256, masks keys even in free text, and creates a private credential file once via CLI', async () => {
  const path = join(temp(), 'app.db'), s = open(path)
  const a = s.addAgent({ name: 'Claude Code', maxMinor: 100, dailyMinor: 200 })
  expect(s.agentKeys.authenticate(a.token)?.id).toBe(a.id)
  expect(s.agentKeys.authenticate(a.token.slice(0, -1) + 'z')).toBeUndefined()
  expect(maskSecrets(`question has ${a.token}`)).not.toContain(a.token)
  expect(() => assertSafe({ value: a.token })).toThrow()
  const raw = new DatabaseSync(path, { readOnly: true })
  const data = JSON.stringify(raw.prepare('SELECT * FROM agent_keys').all()); raw.close()
  expect(data).not.toContain(a.token); expect(data).toMatch(/"digest":"[a-f0-9]{64}"/)
  expect(JSON.stringify(s.auditEntries())).not.toContain(a.token)
  const tokenFile = join(temp(), 'agent.key')
  const out = await child(['scripts/agents.ts', 'add', '--db', path, '--name', 'SDK', '--max-minor', '50', '--daily-minor', '100', '--token-file', tokenFile])
  const token = readFileSync(tokenFile, 'utf8').trim()
  expect(out).not.toContain(token); expect(statSync(tokenFile).mode & 0o777).toBe(0o600)
  await expect(child(['scripts/agents.ts', 'add', '--db', path, '--name', 'overwrite', '--max-minor', '50', '--daily-minor', '100', '--token-file', tokenFile])).rejects.toThrow()
  expect(readFileSync(tokenFile, 'utf8').trim()).toBe(token)
})

it('clamps each principal and isolates idempotency; pause/revoke are durable and revocation cannot resume', () => {
  vi.stubEnv('WALLET_DAILY_CAP_MINOR', '500')
  const s = open(join(temp(), 'app.db')), b = open(s.path)
  const a = s.addAgent({ name: 'A', maxMinor: 100, dailyMinor: 200 }), other = s.addAgent({ name: 'B', maxMinor: 200, dailyMinor: 300 })
  const ar = ask(s, a.id), br = ask(b, other.id)
  expect(ar.run.budgetMinor).toBe(100); expect(br.run.budgetMinor).toBe(200); expect(br.run.runId).not.toBe(ar.run.runId)
  expect(ask(b, a.id, 'two').run.budgetMinor).toBe(100)
  expect(ask(s, a.id, 'three').run.budgetMinor).toBe(0)
  expect(ask(s, other.id, 'two').run.budgetMinor).toBe(100)
  s.setAgentPaused(a.id, true); expect(() => ask(b, a.id, 'paused')).toThrow('paused')
  s.setAgentPaused(a.id, false); expect(ask(b, a.id).reused).toBe(true)
  b.setAgentPaused(a.id, true, true)
  expect(() => ask(s, a.id)).toThrow('revoked'); expect(s.agentKeys.authenticate(a.token)).toBeUndefined()
  expect(() => s.setAgentPaused(a.id, false)).toThrow('permanent')
  expect(s.walletStatus().reservedMinor).toBe(500)
})

it('carries each principal reservation across UTC midnight beneath the wallet cap', () => {
  vi.stubEnv('WALLET_DAILY_CAP_MINOR', '300')
  const s = open(), a = s.addAgent({ name: 'A', maxMinor: 100, dailyMinor: 100 }), b = s.addAgent({ name: 'B', maxMinor: 200, dailyMinor: 200 })
  const prior = s.admit({ surface: 'agent', principal: a.id, question: 'before midnight', requestedMinor: 100, maxMinor: 500, idempotencyKey: 'old' }, '2026-11-01')
  expect(s.agentStatus(a.id, '2026-11-02').reservedMinor).toBe(100)
  expect(ask(s, a.id, 'new').run.budgetMinor).toBe(0)
  expect(ask(s, b.id, 'new').run.budgetMinor).toBe(200)
  s.updateRun(prior.run.runId, { phase: 'STOPPED', stopped: true })
  expect(ask(s, a.id, 'after-stop').run.budgetMinor).toBe(100)
})

it('serialises per-agent and wallet caps across four concurrent OS processes', async () => {
  vi.stubEnv('WALLET_DAILY_CAP_MINOR', '500')
  const s = open(join(temp(), 'app.db'))
  const a = s.addAgent({ name: 'A', maxMinor: 100, dailyMinor: 300 }), b = s.addAgent({ name: 'B', maxMinor: 100, dailyMinor: 300 })
  const totals = await Promise.all([a, a, b, b].map((key, lane) => child(['tests/fixtures/agent-admissions-worker.mjs', s.path, key.id, String(lane)])))
  expect(totals.reduce((n, out) => n + Number(out.trim()), 0)).toBe(500)
  expect(s.agentStatus(a.id).reservedMinor).toBeLessThanOrEqual(300)
  expect(s.agentStatus(b.id).reservedMinor).toBeLessThanOrEqual(300)
  expect(s.walletStatus().reservedMinor).toBe(500)
}, 15_000)

it('stops unsigned purchases and signing on mid-run revoke, while a signed intent finishes once with attribution', async () => {
  const h = await payPath({ storePath: join(temp(), 'app.db') }); cleanup.push(h.close)
  const a = h.store.addAgent({ name: 'A', maxMinor: 200, dailyMinor: 400 })
  const r = ask(h.store, a.id).run, c = await h.candidate(honestArticle)
  const original = h.store.recordSubmission.bind(h.store)
  const signed = vi.spyOn(h.store, 'recordSubmission')
  signed.mockImplementation((id, tx) => { const saved = original(id, tx); h.store.setAgentPaused(a.id, true, true); return saved })
  const input = { runId: r.runId, candidate: c, intentId: 'already-signed' }
  const [one, two] = await Promise.all([h.manager.purchase(input), h.manager.purchase(input)])
  expect(one.status).toBe('VERIFIED'); expect(two.status).toBe('VERIFIED')
  expect(h.store.getRun(r.runId).receipts).toHaveLength(1)
  expect(h.store.getRun(r.runId).receipts[0].intentId).toBe('already-signed')
  const next = await h.manager.purchase({ ...input, intentId: 'revoked-next' })
  expect(next.status).toBe('SKIPPED'); expect(h.store.getSubmission('revoked-next')).toBeUndefined()
  const rows = h.store.receiptRows({ principal: a.id }); expect(rows).toHaveLength(1); expect(rows[0].principal).toBe(a.id)
  expect(h.store.agentStatus(a.id).spentMinor).toBe(c.price.amountMinor)
  expect(h.store.agentStatus(a.id).spent7DaysMinor).toBe(c.price.amountMinor)
  expect(h.store.auditVerify().ok).toBe(true)
  expect(auditAgentAuthority(h.store.auditEntries())).toEqual([])
  const corrupted = h.store.auditEntries().map(e => e.kind === 'sign' ? { ...e, principal: 'unknown-key' } : e)
  expect(auditAgentAuthority(corrupted)).toHaveLength(1)
  expect(h.store.auditEntries().filter(e => e.runId === r.runId).every(e => e.principal === a.id && e.surface === 'agent')).toBe(true)
  // Reservation made before pause, unsigned CAS and sign attempts after pause must both refuse.
  const b = h.store.addAgent({ name: 'B', maxMinor: 200, dailyMinor: 200 }), rb = ask(h.store, b.id).run
  const quote = { ...h.store.getIntent('already-signed')!.quote!, runId: rb.runId, intentId: 'unsigned', amountMinor: 50, expiresAt: new Date(Date.now() + 60_000).toISOString() }
  const intent = { intentId: 'unsigned', runId: rb.runId, profileId: quote.profileId, resourceId: quote.resourceId, version: quote.version, amountMinor: 50, status: 'RESERVED' as const, quote }
  h.store.reserveIntent(intent); h.store.setAgentPaused(b.id, true)
  expect(h.store.claimSubmitting('unsigned')).toBe(false)
  h.store.setAgentPaused(b.id, false)
  const q2 = { ...quote, intentId: 'unsigned-sign' }
  h.store.reserveIntent({ ...intent, intentId: q2.intentId, quote: q2 })
  expect(h.store.claimSubmitting(q2.intentId)).toBe(true)
  h.store.setAgentPaused(b.id, true, true)
  expect(() => original(q2.intentId, h.store.getSubmission('already-signed')!)).toThrow('Signing authority expired')
  expect(h.store.getSubmission(q2.intentId)).toBeUndefined()

})

it('HTTP and SDK enforce token ownership, caps, immediate revocation, and operator-only controls', async () => {
  vi.stubEnv('RA_API_TOKEN', 'operator-test'); vi.stubEnv('LLM_PROVIDER', 'fixture'); vi.stubEnv('DECISION_PROVIDER', 'fixture')
  const api = await createApiApp({ dbPath: ':memory:', publisherUrl: 'http://127.0.0.1:1' })
  vi.spyOn(api.loop, 'start').mockResolvedValue(undefined)
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await api.close(); await new Promise<void>(done => server.close(() => done())) })
  const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const a = api.store.addAgent({ name: 'MCP A', maxMinor: 50, dailyMinor: 100 }), b = api.store.addAgent({ name: 'SDK B', maxMinor: 100, dailyMinor: 200 })
  const ac = createClient({ baseUrl, token: a.token }), bc = createClient({ baseUrl, token: b.token })
  const ar = await ac.ask('Which allowance?', { budgetSgd: 5, waitMs: 5, idempotencyKey: 'same' })
  const br = await bc.ask('Which allowance?', { budgetSgd: 5, waitMs: 5, idempotencyKey: 'same' })
  expect(ar.budgetMinor).toBe(50); expect(br.budgetMinor).toBe(100)
  expect((await ac.wallet()).agent).toMatchObject({ id: a.id, reservedMinor: 50 })
  await expect(ac.getRun(br.run_id)).rejects.toMatchObject({ code: 'not_found' })
  for (const path of ['/api/wallet/pause', `/runs/${br.run_id}/stop`, '/api/audit/receipts.jsonl', '/api/reputation/reset']) {
    const res = await fetch(baseUrl + path, { method: path.includes('receipts') ? 'GET' : 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' }, body: path.includes('receipts') ? undefined : '{}' })
    expect([403, 404]).toContain(res.status)
  }
  api.store.setAgentPaused(a.id, true, true)
  await expect(ac.ask('revoked', { budgetSgd: 1 })).rejects.toMatchObject({ code: 'unauthorized' })
  expect((await bc.wallet()).agent?.id).toBe(b.id)
})

it('SDK self pause is scoped, durable, audited and blocks an already admitted purchase without premium content', async () => {
  vi.stubEnv('RA_API_TOKEN', 'operator-test')
  const path = join(temp(), 'pause.db')
  const h = await payPath({ storePath: path }); cleanup.push(h.close)
  const api = await createApiApp({ dbPath: path, publisherUrl: h.base })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await api.close(); await new Promise<void>(done => server.close(() => done())) })
  const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const a = h.store.addAgent({ name: 'A', maxMinor: 200, dailyMinor: 400 })
  const b = h.store.addAgent({ name: 'B', maxMinor: 200, dailyMinor: 400 })
  const run = ask(h.store, a.id).run
  const client = createClient({ baseUrl, token: a.token })
  await expect(client.pause({ reason: 'self kill switch' })).resolves.toEqual({ paused: true, scope: 'agent', agentId: a.id })
  await expect(client.pause()).resolves.toMatchObject({ paused: true })
  await expect(client.pause({ reason: 'x'.repeat(241) })).rejects.toMatchObject({ code: 'invalid' })
  const response = await fetch(baseUrl + '/api/spending/pause', { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: b.id }) })
  expect(response.status).toBe(400)
  expect(h.store.agentKeys.get(b.id)?.paused).toBe(false)
  expect(h.store.isPaused()).toBe(false)
  expect((await fetch(baseUrl + '/api/wallet/pause', { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' }, body: '{"paused":false}' })).status).toBe(403)
  const result = await h.manager.purchase({ runId: run.runId, candidate: await h.candidate(honestArticle), intentId: 'after-self-pause' })
  expect(result.status).toBe('SKIPPED')
  expect(h.store.getRun(run.runId).contents).toHaveLength(0)
  expect(h.store.getRun(run.runId).grants).toHaveLength(0)
  expect(() => h.store.assertPolicyPaymentAllowed(run.runId)).toThrow('paused')
  const restarted = new Store(path)
  expect(restarted.agentKeys.get(a.id)?.paused).toBe(true)
  expect(restarted.auditEntries().some(e => e.kind === 'pause' && e.principal === a.id && e.data.reason === 'self kill switch')).toBe(true)
  restarted.close()
  await expect(createClient({ baseUrl, token: 'operator-test' }).pause()).resolves.toMatchObject({ scope: 'wallet' })
  expect(h.store.isPaused()).toBe(true)
})
