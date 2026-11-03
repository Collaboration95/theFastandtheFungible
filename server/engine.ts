import { loadConfig, engineEnvironment } from './config.js'
import { randomBytes } from 'node:crypto'
import { Worker } from 'node:worker_threads'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

export type EngineOptions = { apiPort?: number; publisherPort?: number; dataDir: string; live?: boolean; apiToken?: string }
/** An in-process worker isolates configuration and publisher readers between engines. No UI or fixed ports. */
export async function startEngine({ apiPort = 0, publisherPort = 0, dataDir, live = false, apiToken }: EngineOptions) {
  mkdirSync(dataDir, { recursive: true })
  const config = loadConfig()
  apiToken = apiToken || config.RA_API_TOKEN || randomBytes(32).toString('hex')
  const env = engineEnvironment({ RA_API_TOKEN: apiToken, HOST: '127.0.0.1', APP_DB: resolve(dataDir, 'app.db'), PUBLISHER_DB: resolve(dataDir, 'publisher.db'), REPORT_DIR: resolve(dataDir, 'reports'),
    PUBLISHER_PORT: String(publisherPort), LANGFUSE_ENABLED: '0', PUBLISHER_FAULTS: '0',
    LLM_PROVIDER: live && process.env.RA_ACCEPT_TESTNET !== '1' ? 'deepseek' : 'fixture', DECISION_PROVIDER: live && process.env.RA_ACCEPT_TESTNET !== '1' ? (config.DECISION_PROVIDER === 'openai' ? 'openai' : 'cloudflare') : 'fixture',
    SEARCH_EMBEDDINGS: live ? (config.SEARCH_EMBEDDINGS ?? 'live') : 'off',
    SETTLEMENT_RAIL: live && config.XRPL_PAYER_SEED ? 'xrpl-testnet' : 'simulated' })
  const worker = new Worker(new URL('./engine-worker.mjs', import.meta.url), { env, execArgv: process.execArgv.filter(arg => !arg.startsWith('--input-type')), workerData: { apiPort }, stdout: true, stderr: true })
  // stdout is reserved for the MCP JSON-RPC transport, including publisher startup messages.
  worker.stdout.pipe(process.stderr)
  worker.stderr.pipe(process.stderr)
  const ready = await new Promise<{ apiUrl: string; publisherUrl: string }>((done, fail) => {
    worker.once('message', done)
    worker.once('error', fail)
    worker.once('exit', code => fail(new Error(`Engine exited before ready (${code})`)))
  }).catch(async error => { await worker.terminate(); throw error })
  let closing: Promise<void> | undefined
  return { ...ready, apiToken, close: () => closing ??= new Promise<void>((done, fail) => {
    worker.once('exit', code => code === 0 ? done() : fail(new Error('Engine shutdown failed')))
    worker.postMessage('close')
  }) }
}
