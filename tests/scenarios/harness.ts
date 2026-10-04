import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadCorpus } from '../../publisher/corpus.js'
import { RunSnapshotSchema, type RunSnapshot, type Grant, type CorpusResource } from '../../shared/contracts/index.js'

export const question = "Can Vertex Compute's announced 600 MW Johor–Singapore expansion actually be operating by 2028?"
export const canary = (id: string) => `SCENARIO_PAID_CANARY_${id}_9F13`
export type Observation = { kind: string; raw: string; grants: Grant[]; runId?: string }
export type Audit = { kind: string; body: unknown; grants: Grant[]; runId: string }
const pause = (ms: number) => new Promise(done => setTimeout(done, ms))

export async function startScenario(variant?: string, audited = false) {
  const dir = mkdtempSync(join(tmpdir(), 'tftf-scenarios-'))
  const resources = (await loadCorpus(variant)).map(c => c.tier === 'PAID' ? { ...c, body: `${c.body}\n${canary(c.resourceId)}` } : c)
  writeFileSync(join(dir, 'corpus.json'), JSON.stringify(resources))
  const children: ChildProcess[] = []
  const logs: string[] = []
  const observations: Observation[] = []
  const controllers: AbortController[] = []
  const streams: Promise<void>[] = []
  let llm: ReturnType<typeof createHttpServer> | undefined
  const env = { ...process.env, DOTENV_CONFIG_PATH: join(dir, 'no-env'), PORT: '0', HOST: '127.0.0.1', PUBLISHER_PORT: '0', APP_DB: join(dir, 'api.db'), REPORT_DIR: join(dir, 'reports'), PUBLISHER_SECRET: 'scenario-fixture-secret', SCENARIO_CORPUS: join(dir, 'corpus.json'), SCENARIO_JOURNAL: join(dir, 'publisher.db'), SCENARIO_AUDIT: join(dir, 'audit.jsonl'), LLM_PROVIDER: 'fixture', GROQ_API_KEY: '', LLM_BASE_URL: '', DECISION_PROVIDER: 'fixture', CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '', BUY_THRESHOLD: '', PUBLISHER_FAULTS: '0', CORPUS_VARIANT: variant ?? '' }
  async function stop() {
    controllers.forEach(c => c.abort())
    await Promise.all(streams)
    await Promise.all(children.map(async child => {
      if (child.exitCode !== null || child.signalCode !== null) return
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      const timer = setTimeout(() => child.kill('SIGKILL'), 2000)
      await exited
      clearTimeout(timer)
    }))
    if (llm) { llm.closeAllConnections(); await new Promise<void>(done => llm!.close(() => done())) }
    rmSync(dir, { recursive: true, force: true })
  }
  async function start(args: string[], port?: number) {
    const child = spawn(process.execPath, ['--import', 'tsx', ...args], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(child)
    let output = ''
    child.stdout!.on('data', data => { output += String(data); logs.push(String(data)) })
    child.stderr!.on('data', data => logs.push(String(data)))
    for (let i = 0; i < 500; i++) {
      if (child.exitCode !== null) throw new Error(`Scenario process exited: ${logs.join('')}`)
      const actual = port ?? Number(output.match(/PORT=(\d+)/)?.[1])
      if (actual) {
        const base = `http://127.0.0.1:${actual}`
        try {
          const response = await fetch(base + '/health')
          const raw = await response.text()
          observations.push({ kind: 'health', raw, grants: [] })
          if (response.ok) return base
        } catch { /* Still starting. */ }
      }
      await pause(20)
    }
    throw new Error(`Scenario startup timeout: ${logs.join('')}`)
  }
  try {
    const publisher = await start(['tests/scenarios/driver.ts', 'publisher'])
    Object.assign(env, { PUBLISHER_URL: publisher })
    if (audited) {
      // Intentionally invalid JSON output exercises labelled fallback while capturing real Groq requests.
      llm = createHttpServer(async (req, res) => {
        for await (const _chunk of req) { /* Drain the locally captured request. */ }
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: '{}' } }] }) + '\n\ndata: [DONE]\n\n')
      })
      llm.listen(0, '127.0.0.1')
      await once(llm, 'listening')
      Object.assign(env, { LLM_PROVIDER: 'groq', GROQ_API_KEY: 'fixture-key', LLM_BASE_URL: `http://127.0.0.1:${(llm.address() as { port: number }).port}`, LLM_TIMEOUT_MS: '2000' })
    }
    let base: string
    if (audited) base = await start(['tests/scenarios/driver.ts', 'audit-api'])
    else {
      // Obtain an OS-assigned ephemeral port; the production entry logs PORT rather than its bound address.
      const reservation = createServer().listen(0, '127.0.0.1')
      await once(reservation, 'listening')
      const port = (reservation.address() as { port: number }).port
      await new Promise<void>(done => reservation.close(() => done()))
      env.PORT = String(port)
      base = await start([resolve(process.env.SCENARIO_API_ENTRY ?? 'server/index.ts')], port)
    }
    async function request(path: string, body?: unknown) {
      const response = await fetch(base + path, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const raw = await response.text()
      if (!response.ok) throw new Error(`${path}: ${response.status} ${raw}`)
      const value = JSON.parse(raw)
      observations.push({ kind: `API ${path}`, raw, grants: value.grants ?? [], runId: value.runId })
      return RunSnapshotSchema.parse(value)
    }
    async function ask(budgetMinor = 200) {
      const initial = await request('/runs', { question, budgetMinor })
      const controller = new AbortController()
      controllers.push(controller)
      const response = await fetch(`${base}/runs/${initial.runId}/events`, { signal: controller.signal })
      if (!response.ok || !response.body) throw new Error('SSE unavailable')
      const reader = response.body.getReader()
      const task = (async () => {
        const decoder = new TextDecoder()
        let pending = '', grants: Grant[] = []
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            pending += decoder.decode(value, { stream: true })
            const frames = pending.split('\n\n')
            pending = frames.pop()!
            for (const frame of frames) {
              const data = frame.split('\n').find(line => line.startsWith('data: '))?.slice(6)
              if (!data) continue
              const value = JSON.parse(data)
              if (frame.startsWith('event: snapshot')) grants = value.grants
              observations.push({ kind: 'SSE', raw: data, grants: structuredClone(grants), runId: initial.runId })
            }
          }
        } catch (error) { if (!controller.signal.aborted) throw error }
        finally { await reader.cancel().catch(() => undefined) }
      })()
      streams.push(task)
      return initial.runId
    }
    async function until(id: string, predicate: (run: RunSnapshot) => boolean = run => ['DONE', 'FAILED', 'STOPPED'].includes(run.phase)) {
      for (let i = 0; i < 500; i++) {
        const run = await request(`/runs/${id}`)
        if (predicate(run)) { await pause(20); return run }
        await pause(10)
      }
      throw new Error('Scenario run timeout')
    }
    return { base, publisher, resources, observations, logs, ask, until, request, stop, audits: (): Audit[] => readFileSync(join(dir, 'audit.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)) }
  } catch (error) { await stop(); throw error }
}

/** Raw text, not a schema-sanitized copy. Match each resource/version/run grant independently. */
export function assertNoLeaks(observations: Observation[], resources: CorpusResource[]) {
  for (const observation of observations) {
    for (const resource of resources.filter(c => c.tier === 'PAID')) {
      if (observation.grants.some(g => g.runId === observation.runId && g.resourceId === resource.resourceId && g.version === resource.version)) continue
      // Some variants deliberately repeat free evidence; only private spans are leak markers.
      const publicBodies = resources.filter(c => c.tier === 'FREE').map(c => c.body)
      const markers = [canary(resource.resourceId), ...resource.body.match(/PAID_CANARY_[\w]+/g) ?? [], ...resource.spans.map(s => s.text).filter(text => !publicBodies.some(body => body.includes(text)))]
      for (const marker of markers) if (observation.raw.includes(marker) || observation.raw.includes(JSON.stringify(marker).slice(1, -1))) throw new Error(`${observation.kind} leaked ${resource.resourceId} before its run/version grant: ${marker}`)
    }
  }
}
