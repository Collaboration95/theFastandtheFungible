// Provider transport for the decision and coverage harnesses (#212, #213), ported from
// bench/decisions/transport.ts on bench/decisions-vs-clef. Changes from the bench:
// - Nothing reaches a network unless the caller passes --live AND the shell sets EVAL_LIVE=1
//   (enableLive). Tests inject a mock fetch with setTransport; cached responses stay readable offline.
// - Credentials come only from EVAL_* names (a separate account, never the demo token), read from
//   the environment or an explicit EVAL_ENV_FILE. No hard-coded .env path.
// - One account per provider (no second-token swap); concurrency comes from EVAL_CONCURRENCY so the
//   9-in-flight production topology can be measured; the spend caps are configurable and default low.
// - Output lives under eval/decisions/out (gitignored) or EVAL_OUT, created on first write.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import dotenv from 'dotenv'

export const outDir = () => path.resolve(process.env.EVAL_OUT || 'eval/decisions/out')
export type Arm = 'flash' | 'clef' | 'luna'
export type TransportArm = Arm | 'deepseek'
export const models: Record<Arm, string> = { flash: '@cf/cloudflare/clef-flash', clef: '@cf/cloudflare/clef', luna: 'gpt-6-luna' }
/** US$ per million input tokens (DeepSeek output adds 1.20/M), as the 8 Oct bench priced them. */
export const rates: Record<TransportArm, number> = { flash: 0.09, clef: 0.24, luna: 0.10, deepseek: 0.30 }
/** The only credential names the harness reads: a separate evaluation account, never the demo's. */
export const CREDENTIALS = { cloudflareToken: 'EVAL_CLOUDFLARE_API_TOKEN', cloudflareAccount: 'EVAL_CLOUDFLARE_ACCOUNT_ID', openai: 'EVAL_OPENAI_API_KEY', deepseek: 'EVAL_DEEPSEEK_API_KEY' } as const

export const hash = (v: unknown) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
export function save(name: string, data: unknown) {
  const file = path.join(outDir(), name)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
  return file
}

let live = false
let transport: typeof fetch | undefined
/** Opt in to network calls: both the --live flag (the caller) and EVAL_LIVE=1 (the shell) are required. */
export function enableLive(): void {
  if (process.env.EVAL_LIVE !== '1') throw new Error('Live provider calls need EVAL_LIVE=1 in the shell as well as --live.')
  if (process.env.VITEST) throw new Error('Live provider calls are never allowed under the test runner.')
  live = true
}
/** Tests: a mock transport; no network is touched and no opt-in is needed. Pass undefined to reset. */
export function setTransport(fetchImpl: typeof fetch | undefined): void { transport = fetchImpl }
export const isLive = () => live

const secrets = () => process.env.EVAL_ENV_FILE && fs.existsSync(process.env.EVAL_ENV_FILE) ? dotenv.parse(fs.readFileSync(process.env.EVAL_ENV_FILE)) : {}
export const secret = (name: string) => secrets()[name] || process.env[name] || ''

export type CallRecord = { key: string; arm: TransportArm; phase: string; kind: string; repeat: number; status: number; latencyMs: number; timeout3s: boolean; inputTokens: number; outputTokens: number; estimatedUsage: boolean; usd: number; request: unknown; response: unknown; error?: string; timestamp: string; cacheHit?: boolean }
type Meter = { calls: number; inputTokens: number; outputTokens: number; usd: number; estimatedCalls: number; errors: number; timeouts3s: number }

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const queues: Record<string, { active: number; waiters: (() => void)[] }> = {}
async function acquire(provider: string) {
  const limit = Math.max(1, Number(process.env.EVAL_CONCURRENCY) || 2)
  const q = queues[provider] ??= { active: 0, waiters: [] }
  if (q.active >= limit) await new Promise<void>(resolve => q.waiters.push(resolve))
  else q.active++
  return () => { const next = q.waiters.shift(); if (next) next(); else q.active-- }
}
const meterFile = () => path.join(outDir(), 'cost.json')
const readMeter = (): Record<string, Meter> => fs.existsSync(meterFile()) ? JSON.parse(fs.readFileSync(meterFile(), 'utf8')) : {}
const reserved: Record<string, number> = {}
/** Hard stop before a call would push the projected spend over EVAL_SPEND_CAP_USD (default US$2 in total). */
function reserveBudget(arm: TransportArm, usd: number) {
  const cap = Number(process.env.EVAL_SPEND_CAP_USD || 2)
  const meter = readMeter()
  const total = Object.values(meter).reduce((s, m) => s + m.usd, 0) + Object.values(reserved).reduce((s, v) => s + v, 0)
  if (total + usd > cap) throw new Error(`HARD STOP: projected provider spend would pass US$${cap}`)
  reserved[arm] = (reserved[arm] ?? 0) + usd
  return () => { reserved[arm] -= usd }
}
/** Planned calls before a live phase: printed and saved so the coordinator can check them against the cap. */
export function forecast(phase: string, calls: Partial<Record<TransportArm, number>>, tokensPerCall = 1500) {
  const estimate = Object.fromEntries(Object.entries(calls).map(([arm, n]) => [arm, { calls: n, inputTokens: n! * tokensPerCall, usd: n! * tokensPerCall * rates[arm as TransportArm] / 1e6 }]))
  console.log(JSON.stringify({ phase, estimated: estimate }))
  return estimate
}

function endpoint(arm: TransportArm, account: string) {
  return arm === 'luna' ? 'https://api.openai.com/v1/decisions' : arm === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${models[arm]}`
}
const credentialFor = (arm: TransportArm) => arm === 'luna' ? CREDENTIALS.openai : arm === 'deepseek' ? CREDENTIALS.deepseek : CREDENTIALS.cloudflareToken

/** One provider call, cached by request body. Without live opt-in or a mock transport only cache hits return. */
export async function request(arm: TransportArm, body: unknown, meta: { phase: string; kind: string; repeat?: number; ordinal?: string }): Promise<CallRecord> {
  const repeat = meta.repeat ?? 0
  const key = hash({ arm, body, repeat, ordinal: meta.ordinal ?? '' })
  const file = path.join(outDir(), 'cache', key + '.json')
  if (fs.existsSync(file)) {
    const previous = JSON.parse(fs.readFileSync(file, 'utf8')) as CallRecord
    if (previous.status !== 0 || !process.env.EVAL_RETRY_TRANSPORT) return { ...previous, cacheHit: true }
  }
  const send = transport ?? (live ? fetch : undefined)
  if (!send) throw new Error('No cached response and live calls are off (pass --live with EVAL_LIVE=1, or inject a transport in tests).')
  if ((arm === 'flash' || arm === 'clef') && fs.existsSync(path.join(outDir(), 'blocked-cloudflare.json'))) throw new Error('Cloudflare calls stopped: daily allocation exhausted; cached responses remain readable.')
  const token = transport ? 'mock-credential' : secret(credentialFor(arm))
  if (!token) throw new Error(`Missing ${credentialFor(arm)} for ${arm}`)
  const account = arm === 'flash' || arm === 'clef' ? (transport ? 'mock-account' : secret(CREDENTIALS.cloudflareAccount)) : ''
  if ((arm === 'flash' || arm === 'clef') && !account) throw new Error(`Missing ${CREDENTIALS.cloudflareAccount}`)
  const estimated = Math.ceil(JSON.stringify(body).length / 3) + 100
  const unreserve = reserveBudget(arm, estimated * rates[arm] / 1e6 + (arm === 'deepseek' ? 2500 * 1.2 / 1e6 : 0))
  const release = await acquire(arm === 'flash' || arm === 'clef' ? 'cloudflare' : arm)
  const rec: CallRecord = { key, arm, phase: meta.phase, kind: meta.kind, repeat, status: 0, latencyMs: 0, timeout3s: false, inputTokens: estimated, outputTokens: 0, estimatedUsage: true, usd: 0, request: body, response: null, timestamp: new Date().toISOString() }
  const start = performance.now()
  let retryAfter = 0
  try {
    const response = await send(endpoint(arm, account), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(arm === 'deepseek' ? 90_000 : 20_000) })
    rec.status = response.status
    const text = await response.text()
    try { rec.response = JSON.parse(text) } catch { rec.response = { text: text.slice(0, 2000) } }
    const payload = rec.response as { usage?: Record<string, number>; result?: { usage?: Record<string, number> } } | null
    const usage = payload?.usage ?? payload?.result?.usage
    if (usage) { rec.inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? estimated; rec.outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0; rec.estimatedUsage = usage.input_tokens === undefined && usage.prompt_tokens === undefined }
    if (!response.ok) {
      rec.error = `HTTP ${response.status}`
      if (response.status === 429) {
        retryAfter = Math.min(60_000, Math.max(1000, Number(response.headers.get('retry-after')) * 1000 || 60_000))
        // A daily-allowance error stops Cloudflare work for the run (stop at the first quota error).
        if (arm === 'flash' || arm === 'clef') save('blocked-cloudflare.json', { at: new Date().toISOString(), status: 429, reason: JSON.stringify(rec.response).slice(0, 200) })
      }
    }
  } catch (e) { rec.error = e instanceof Error ? e.name : 'transport failure' } finally {
    rec.latencyMs = performance.now() - start
    rec.timeout3s = rec.latencyMs > 3000
    // Missing usage is a conservative estimate, not a claimed invoice charge.
    rec.usd = (rec.inputTokens * rates[arm] + rec.outputTokens * (arm === 'deepseek' ? 1.2 : 0)) / 1e6
    try {
      const meter = readMeter()
      const m = meter[arm] ??= { calls: 0, inputTokens: 0, outputTokens: 0, usd: 0, estimatedCalls: 0, errors: 0, timeouts3s: 0 }
      m.calls++; m.inputTokens += rec.inputTokens; m.outputTokens += rec.outputTokens; m.usd += rec.usd; m.estimatedCalls += Number(rec.estimatedUsage); m.errors += Number(Boolean(rec.error)); m.timeouts3s += Number(rec.timeout3s)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, JSON.stringify(rec) + '\n')
      save('cost.json', meter)
      fs.appendFileSync(path.join(outDir(), 'requests.jsonl'), JSON.stringify({ key, arm, phase: meta.phase, kind: meta.kind, repeat, status: rec.status, latencyMs: rec.latencyMs, inputTokens: rec.inputTokens, usd: rec.usd, error: rec.error }) + '\n')
      if (retryAfter && !transport) await sleep(retryAfter)
    } finally { release(); unreserve() }
  }
  if (arm === 'luna' && [401, 403, 404].includes(rec.status)) throw new Error(`HARD STOP: OpenAI access rejected HTTP ${rec.status}`)
  return rec
}

/** Before publishing any output: no credential value, and no bearer or key-prefix pattern, in the files. */
export function assertNoSecrets(files: string[]) {
  const values = Object.entries({ ...process.env, ...secrets() }).filter(([k, v]) => /KEY|TOKEN|SEED|SECRET/.test(k) && typeof v === 'string' && v.length > 8).map(([, v]) => v as string)
  // A key prefix as a whole token (not "desk-" or "risk-"), or an Authorization bearer value.
  const markers = [new RegExp(`\\b${String.fromCharCode(115, 107)}-[A-Za-z0-9_-]{12,}`), new RegExp(`${String.fromCharCode(66, 101, 97, 114, 101, 114)} [A-Za-z0-9._-]{12,}`)]
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    if (values.some(v => content.includes(v))) throw new Error(`HARD STOP: credential value in ${file}`)
    if (markers.some(m => m.test(content))) throw new Error(`HARD STOP: secret-pattern match in ${file}`)
  }
}
