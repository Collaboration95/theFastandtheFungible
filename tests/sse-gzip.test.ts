import { afterEach, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { request, type IncomingHttpHeaders } from 'node:http'
import { createGunzip } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createApiApp } from '../server/routes.js'
import { HostedLimits, hash } from '../server/hosted/limits.js'
import { loadConfig } from '../server/config.js'
import { resources } from './helpers/resource-scope.js'

const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.unstubAllEnvs() })
async function stack(hosted = true, kill = false) {
  const dir = resources().tempDir('sse-gzip-')
  for (const [key, value] of Object.entries({ HOSTED: hosted ? '1' : '0', HOSTED_SSE_GZIP: kill ? '0' : '1', HOSTED_ORIGIN: 'https://demo.example', HOSTED_TRUSTED_PROXY: '127.0.0.1', HOSTED_IP_HMAC_KEY: 'a'.repeat(40), HOSTED_CONTROL_PATH: join(dir, 'control.json'), SETTLEMENT_RAIL: 'simulated', ANCHOR_RAIL: 'off', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', LANGFUSE_ENABLED: '0' })) vi.stubEnv(key, value)
  writeFileSync(process.env.HOSTED_CONTROL_PATH!, JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'test', expiresAt: '2026-11-19T16:00:00Z' }))
  const api = await createApiApp({ dbPath: ':memory:', hostedReadiness: async () => true, reconcileIntervalMs: 0 })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await api.close() })
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const jar = await new Promise<string>((resolve, reject) => { const req = request(url + '/api/demo/status', { headers: { Host: 'demo.example' } }, res => { res.resume(); res.on('end', () => resolve(res.headers['set-cookie']?.[0].split(';')[0] ?? '')) }); req.on('error', reject); req.end() })
  const store = api.store!
  const principal = hosted ? hash(jar.split('=')[1]) : 'operator'
  const limits = hosted ? new HostedLimits(store, loadConfig()) : undefined
  const hold = limits?.reserve(principal, 'test', 'How does XRPL escrow work?', '127.0.0.1', 0, 'submit', {})
  const run = store.admit({ surface: 'web', principal, idempotencyKey: 'test', question: 'How does XRPL escrow work?', requestedMinor: 0, maxMinor: 200 }).run
  if (hold) limits!.update(hold.id, { run_id: run.runId, state: 'active' })
  const open = (encoding = 'gzip') => new Promise<{ headers: IncomingHttpHeaders; frames: { text: string; at: number }[]; ended: () => boolean; bytes: () => number }>((resolve, reject) => {
    const req = request(`${url}/runs/${run.runId}/events`, { headers: { Host: hosted ? 'demo.example' : '127.0.0.1', Cookie: jar, 'Accept-Encoding': encoding } }, res => {
      const frames: { text: string; at: number }[] = []; let buffer = '', ended = false, bytes = 0
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`SSE HTTP ${res.statusCode}`)); return }
      res.on('data', chunk => { bytes += chunk.length })
      const body = res.headers['content-encoding'] === 'gzip' ? res.pipe(createGunzip()) : res
      body.setEncoding('utf8'); body.on('data', chunk => {
        buffer += chunk
        let end: number
        while ((end = buffer.indexOf('\n\n')) >= 0) { frames.push({ text: buffer.slice(0, end), at: Date.now() }); buffer = buffer.slice(end + 2) }
      }); body.on('end', () => { ended = true }); body.on('error', () => {})
      resolve({ headers: res.headers, frames, ended: () => ended, bytes: () => bytes })
    })
    cleanup.push(() => req.destroy()); req.on('error', reject); req.end()
  })
  return { store, run, open }
}

it('flushes every hosted frame, coalesces progress snapshots to 1 s, and delivers the terminal snapshot before closing gzip', async () => {
  const { store, run, open } = await stack(), stream = await open()
  expect(stream.headers['content-encoding']).toBe('gzip'); expect(stream.headers.vary).toContain('Accept-Encoding')
  await vi.waitFor(() => expect(stream.frames).toHaveLength(1))
  for (let i = 0; i < 4; i++) {
    store.appendEvent(run.runId, { type: 'SNAPSHOT', label: `progress ${i}` })
    await vi.waitFor(() => expect(stream.frames.filter(f => f.text.startsWith('event: trace'))).toHaveLength(i + 1), { interval: 10 })
  }
  expect(stream.frames.filter(f => f.text.startsWith('event: snapshot'))).toHaveLength(1)
  await vi.waitFor(() => expect(stream.frames.filter(f => f.text.startsWith('event: snapshot'))).toHaveLength(2), { timeout: 1800, interval: 10 })
  const snapshots = stream.frames.filter(f => f.text.startsWith('event: snapshot'))
  expect(snapshots[1].at - snapshots[0].at).toBeGreaterThanOrEqual(950)
  store.appendEvent(run.runId, { type: 'PROGRESS', label: 'Anchor unavailable (failed)' });
  store.updateRun(run.runId, { phase: 'DONE' }); store.appendEvent(run.runId, { type: 'DONE', label: 'Finished' })
  await vi.waitFor(() => expect(stream.ended()).toBe(true), { interval: 10 })
  expect(stream.frames.at(-1)!.text).toContain('"phase":"DONE"')
  const lags = stream.frames.filter(f => f.text.startsWith('event: trace')).map(f => f.at - Date.parse(JSON.parse(f.text.split('data: ')[1]).at))
  expect(Math.max(...lags)).toBeLessThanOrEqual(300)
  expect(stream.bytes()).toBeLessThan(Buffer.byteLength(stream.frames.map(f => f.text).join('\n\n')))
})

it.each([[true, true, 'gzip'], [true, false, 'gzip;q=0, identity'], [false, false, 'gzip']] as const)('keeps a plain stream: hosted=%s, kill=%s, Accept-Encoding=%s', async (hosted, kill, encoding) => {
  const { open } = await stack(hosted, kill), stream = await open(encoding)
  expect(stream.headers['content-encoding']).toBeUndefined()
  await vi.waitFor(() => expect(stream.frames[0]?.text).toContain('event: snapshot'))
})

it('retains the uncompressed 256 KiB frame cap even when the oversized body compresses very well', async () => {
  const { store, run, open } = await stack(), stream = await open()
  await vi.waitFor(() => expect(stream.frames).toHaveLength(1))
  store.appendEvent(run.runId, { type: 'PROGRESS', label: 'x'.repeat(256 * 1024) })
  await vi.waitFor(() => expect(stream.ended()).toBe(true))
  expect(stream.frames).toHaveLength(1)
  // Durable state is intact; streamRun's existing GET resync reads the same run after a bounded close.
  expect(store.getRun(run.runId).events.at(-1)!.label).toHaveLength(256 * 1024)
})

it('sends a failed run immediately even when failure has only a SNAPSHOT notification', async () => {
  const { store, run, open } = await stack(), stream = await open()
  await vi.waitFor(() => expect(stream.frames).toHaveLength(1))
  const at = Date.now()
  store.updateRun(run.runId, { phase: 'FAILED' })
  store.appendEvent(run.runId, { type: 'SNAPSHOT', label: 'Latest validated answer and ledger saved.' })
  await vi.waitFor(() => expect(stream.frames.at(-1)!.text).toContain('"phase":"FAILED"'), { timeout: 300, interval: 10 })
  expect(stream.frames.at(-1)!.at - at).toBeLessThanOrEqual(300)
})

it('flushes a late final anchor immediately and then closes the settled stream', async () => {
  const { store, run, open } = await stack(), stream = await open()
  await vi.waitFor(() => expect(stream.frames).toHaveLength(1))
  store.updateRun(run.runId, { phase: 'DONE' }); store.appendEvent(run.runId, { type: 'DONE', label: 'Done; anchor still pending' })
  await vi.waitFor(() => expect(stream.frames.at(-1)!.text).toContain('"phase":"DONE"'))
  expect(stream.ended()).toBe(false)
  const at = Date.now()
  store.appendEvent(run.runId, { type: 'SNAPSHOT', label: 'Anchor unavailable (failed)' })
  await vi.waitFor(() => expect(stream.ended()).toBe(true), { timeout: 300, interval: 10 })
  expect(stream.frames.at(-1)!.at - at).toBeLessThanOrEqual(300)
  expect(stream.frames.at(-1)!.text).toContain('Anchor unavailable (failed)')
})

it('bounds queued uncompressed input even when many individually valid frames compress to almost nothing', async () => {
  const { store, run, open } = await stack(), stream = await open()
  await vi.waitFor(() => expect(stream.frames).toHaveLength(1))
  for (let i = 0; i < 10; i++) store.appendEvent(run.runId, { type: 'PROGRESS', label: 'x'.repeat(128 * 1024) })
  await vi.waitFor(() => expect(stream.ended()).toBe(true))
  expect(stream.frames.filter(f => f.text.startsWith('event: trace')).length).toBeLessThanOrEqual(1)
  expect(store.getRun(run.runId).events).toHaveLength(10)
})
