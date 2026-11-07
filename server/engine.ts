import { ResourceScope } from '../shared/resource-scope.js'
import { loadConfig, engineEnvironment } from './config.js'
import { randomBytes } from 'node:crypto'
import { Worker } from 'node:worker_threads'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

export type EngineOptions = { apiPort?: number; publisherPort?: number; dataDir: string; live?: boolean; apiToken?: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal }
/** An in-process worker isolates configuration and publisher readers between engines. No UI or fixed ports. */
export async function startEngine({ apiPort = 0, publisherPort = 0, dataDir, live = false, apiToken, env: extraEnv = {}, signal }: EngineOptions) {
  mkdirSync(dataDir, { recursive: true })
  const config = loadConfig()
  apiToken = apiToken || config.RA_API_TOKEN || randomBytes(32).toString('hex')
  const env = engineEnvironment({ RA_API_TOKEN: apiToken, HOST: '127.0.0.1', APP_DB: resolve(dataDir, 'app.db'), PUBLISHER_DB: resolve(dataDir, 'publisher.db'), REPORT_DIR: resolve(dataDir, 'reports'),
    PUBLISHER_PORT: String(publisherPort), LANGFUSE_ENABLED: '0', PUBLISHER_FAULTS: '0',
    LLM_PROVIDER: live && process.env.RA_ACCEPT_TESTNET !== '1' ? 'deepseek' : 'fixture', DECISION_PROVIDER: live && process.env.RA_ACCEPT_TESTNET !== '1' ? (config.DECISION_PROVIDER === 'openai' ? 'openai' : 'cloudflare') : 'fixture',
    SEARCH_EMBEDDINGS: live ? (config.SEARCH_EMBEDDINGS ?? 'live') : 'off',
    SETTLEMENT_RAIL: extraEnv.XRPL_PAYER_SEED || (live && config.XRPL_PAYER_SEED) ? 'xrpl-testnet' : 'simulated', ...extraEnv })
  // Bound the nursery rather than old space: transient snapshot validation creates
  // heavy allocation traffic. This reduces transient heap capacity without capping
  // old space or external buffers; pause distributions are workload dependent.
  // Measured rationale and full unchanged gates: docs/evidence/round2-u/README.md.
  const worker = new Worker(new URL('./engine-worker.mjs', import.meta.url), { env, resourceLimits: { maxYoungGenerationSizeMb: 16 }, execArgv: process.execArgv.filter(arg => !arg.startsWith('--input-type')), workerData: { apiPort }, stdout: true, stderr: true })
  // stdout is reserved for the MCP JSON-RPC transport, including publisher startup messages.
  worker.stdout.pipe(process.stderr)
  worker.stderr.pipe(process.stderr)
  const scope = new ResourceScope()
  let state: 'booting' | 'ready' | 'closing' | 'closed' = 'booting'
  let exited = false
  worker.once('exit', () => { exited = true; state = 'closed' })
  scope.defer(async () => { if (!exited) await worker.terminate() })
  const ready = await new Promise<{ apiUrl: string; publisherUrl: string }>((done, fail) => {
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.off('message', message); worker.off('error', error); worker.off('exit', exit) }
    const message = (value: { apiUrl: string; publisherUrl: string }) => { cleanup(); state = 'ready'; done(value) }
    const error = () => { cleanup(); fail(new Error('Engine boot failed')) }
    const exit = () => error()
    const abort = () => { cleanup(); fail(new Error('Engine boot aborted')) }
    const timer = scope.timer(setTimeout(() => { cleanup(); fail(new Error('Engine boot timeout')) }, 90_000))
    worker.once('message', message); worker.once('error', error); worker.once('exit', exit)
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true })
  }).catch(async error => { await scope.close(); throw error })
  // Worker errors after readiness must not become uncaught process errors.
  worker.on('error', () => { state = 'closed' })
  let closing: Promise<void> | undefined
  return { ...ready, apiToken, get state() { return state }, close: () => closing ??= (async () => {
    if (!exited) {
      state = 'closing'
      await new Promise<void>(done => {
        const finish = () => { clearTimeout(timer); worker.off('exit', finish); done() }
        const timer = scope.timer(setTimeout(finish, 3500))
        worker.once('exit', finish)
        worker.postMessage('close')
      })
    }
    await scope.close()
    state = 'closed'
  })() }
}
