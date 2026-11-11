// LIVE-DEC (11 Nov 2026): live OpenAI Decisions (gpt-6-luna) against the labelled fixture decision model, on the hosted
// judge path, before the hosted demo is switched to DECISION_PROVIDER=openai.
//   node --import tsx scripts/evidence/live-decisions.ts <out-dir> [--sets presets,judges,negatives] [--reps 3] [--cap-usd 2.5]
//
// One process, one HOSTED=1 gateway per arm; the arms differ only in the decision model (see `Arm` below): `fixture` (the
// labelled fixture, what the hosted demo runs today), `openai` (OpenAIDecisionsProvider, gpt-6-luna, as the VM would run it)
// and `openai-uncapped` (measurement only). Everything else mirrors the VM's env.template plus its operator env.local: live
// DeepSeek scope, planner and writer; keyword search; the hosted meter with the VM's conservative rates (research
// 0.40/1.60, decision 0.25/1.00 US$ per million tokens, 8192 decision output tokens); the default decision timeout (5 s per
// attempt, two attempts) and 19 questions per request. Payments are SIMULATED against an in-process fixture writer server;
// ephemeral loopback ports only (never 5100/8788/8790).
//
// Pairing: every DeepSeek call goes through a loopback record/replay proxy. For repetition r of question q the first arm
// runs first and its DeepSeek responses are recorded; the other arms then get the same response for a byte-identical
// request (same scope → same confirmed plan; same evidence → same written answer), replayed with the recorded chunk timing
// so end-to-end time stays comparable. A request that differs (different purchases → different evidence) goes live.
// So the arms see the same live plan, and differences come from the decision model. Each repetition is a fresh plan.
//
// Keys: read only through dotenv (the worktree's .env), never printed. Results hold no request bodies, headers or keys.
import { createServer, request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { once } from 'node:events'
import { join, resolve } from 'node:path'
import { ResourceScope } from '../../shared/resource-scope.js'

const args = process.argv.slice(2)
const out = resolve(args[0] ?? '')
if (!args[0] || args[0].startsWith('--')) throw Error('Usage: node --import tsx scripts/evidence/live-decisions.ts <out-dir> [--sets presets,judges,negatives] [--reps 3] [--cap-usd 2.5]')
const flag = (name: string, fallback: string) => { const i = args.indexOf(`--${name}`); return i > 0 && args[i + 1] ? args[i + 1] : fallback }
const SETS = flag('sets', 'presets,judges,negatives').split(',')
const REPS = Number(flag('reps', '3'))
const JUDGE_REPS = Number(flag('judge-reps', '1'))
const ONLY = flag('only', '').split(',').filter(Boolean)
// --direct: skip the scope step and POST /runs straight away, as an API client may. The planner then plans every question,
// so off-topic questions the scope would answer with its fixed redirect reach the decision model (a stress test of declines).
const DIRECT = args.includes('--direct')
const ARMS = flag('arms', 'fixture,openai,openai-uncapped').split(',') as Arm[]
// Upper bound on OpenAI spend for this whole run, at the VM's conservative decision rates (above list price).
const CAP_USD = Number(flag('cap-usd', '2.5'))
if (!Number.isFinite(CAP_USD) || CAP_USD <= 0 || CAP_USD > 2.5) throw Error('--cap-usd must be positive and at most 2.5 (leave room for prior lane spend)')
const RATES = { research: { input: 0.40, output: 1.60 }, decision: { input: 0.25, output: 1.00 } } as const
// fixture: the labelled fixture decision model (the hosted demo today). openai: gpt-6-luna exactly as the VM would run it
// (19 questions per request, the hosted meter and its caps). openai-uncapped: MEASUREMENT ONLY, the same as openai except
// that the per-question decision input-token ceiling (50,000, counted as request bytes) is lifted, so the decision model's
// choices can be measured past round 1; the US$0.05 per-question money envelope and every other cap still apply.
// openai-batch (optional): one request per round (up to 49 questions; the API accepted 25, 37 and 49 on 11 Nov).
type Arm = 'fixture' | 'openai' | 'openai-uncapped' | 'openai-batch'
const MAX_QUESTIONS: Partial<Record<Arm, number>> = { 'openai-batch': 49 }

const resources = new ResourceScope()
const dir = resources.tempDir('ra-live-dec-')
const ORIGIN = 'https://demo.example'
const envPath = resolve('.env')
if (!existsSync(envPath)) throw Error('No .env in this checkout: symlink the owner .env (never print it).')
// The VM's public configuration (docker/hosted/env.template + the operator env.local), set before dotenv so .env's local
// development settings (LLM_TIMEOUT_MS, DECISIONS_MAX_QUESTIONS, LLM_BASE_URL…) cannot override them. '' means "unset"
// to the config loader and keeps dotenv from filling it.
Object.assign(process.env, {
  HOSTED: '1', HOSTED_ORIGIN: ORIGIN, HOSTED_TRUSTED_PROXY: '127.0.0.1', HOSTED_IP_HMAC_KEY: 'live-dec-measurement-only-'.padEnd(40, 'x'),
  HOSTED_CONTROL_PATH: join(dir, 'control.json'), HOSTED_QUESTION_CAP_MINOR: '200', HOSTED_ADMISSIONS_UNTIL: '2026-11-19T16:00:00Z',
  HOSTED_RESEARCH_INPUT_USD_PER_MILLION: String(RATES.research.input), HOSTED_RESEARCH_OUTPUT_USD_PER_MILLION: String(RATES.research.output),
  HOSTED_DECISION_INPUT_USD_PER_MILLION: String(RATES.decision.input), HOSTED_DECISION_OUTPUT_USD_PER_MILLION: String(RATES.decision.output), HOSTED_DECISION_OUTPUT_TOKENS: '8192',
  ACTIVE_WORK_LIMIT: '2', LLM_PROVIDER: 'deepseek', LLM_MODEL: '', LLM_TIMEOUT_MS: '', LLM_SYNTHESIS_TIMEOUT_MS: '',
  DECISION_PROVIDER: 'fixture', DECISION_MODEL: 'gpt-6-luna', DECISION_TIMEOUT_MS: '', CLEF_TIMEOUT_MS: '', DECISIONS_MAX_QUESTIONS: '', DECISIONS_WORDING: '', DECISIONS_GAP_WORDING: '', DECISION_CALIBRATION: '', BUY_THRESHOLD: '',
  SEARCH_EMBEDDINGS: 'off', SETTLEMENT_RAIL: 'simulated', ANCHOR_RAIL: 'off', XRPL_PAYER_SEED: '', LANGFUSE_ENABLED: '0', LANGFUSE_PUBLIC_TRACES: '0', SEMANTIC_RANKER: '',
  APP_DB: join(dir, 'unused.db'), REPORT_DIR: join(dir, 'reports'), DOTENV_CONFIG_PATH: envPath,
})
await import('dotenv/config')
if (!process.env.OPENAI_API_KEY || !(process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY)) throw Error('OpenAI or DeepSeek key missing from .env')
writeFileSync(process.env.HOSTED_CONTROL_PATH!, JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'live_dec_measurement', expiresAt: new Date(Date.now() + 86_400_000).toISOString() }))

// ---- Questions and what a right answer looks like (same yardstick for both arms) ----
type Gold = { right: string[]; lead?: RegExp; none?: boolean; note: string }
type Q = { set: 'presets' | 'judges' | 'negatives'; id: string; question: string; gold: Gold }
const { TESTNET_QUESTIONS: presets } = await import('../../shared/contracts/examples.js')
const GOLD: Record<string, Gold> = {
  XRPL2: { right: ['product-x402-response'], lead: /PAYMENT-REQUIRED|scheme, network, amount|payTo/i, note: 'the 402 response explainer; lead names what the 402 carries' },
  XRPL1: { right: ['team-rlusd'], lead: /AllowTrustLineLocking/i, note: 'the team RLUSD note; lead names AllowTrustLineLocking' },
  XRPL3: { right: ['xrpl-reserves'], lead: /\b\d+(?:\.\d+)?\s*XRP\b|base reserve/i, note: 'the reserves explainer; lead names the base reserve (or its amount)' },
  A3: { right: ['team-fees'], lead: /\b\d[\d,]*\s*drops\b/i, note: 'the fee note; lead states a fee in drops' },
  A4: { right: ['c5-xrpl-token-escrow-xls85'], lead: /TokenEscrow|XLS-85/i, note: 'the TokenEscrow (XLS-85) explainer; lead names the amendment' },
  A5: { right: ['xrpl-escrow', 'xrpl-tx-escrowfinish', 'xrpl-tx-escrowcancel', 'product-escrow-no-show'], lead: /EscrowFinish[\s\S]*EscrowCancel|EscrowCancel[\s\S]*EscrowFinish/, note: 'an escrow explainer or the Finish/Cancel references; lead contrasts both' },
  D1: { right: ['c5-fatf-recommendation-16-travel-rule', 'xrpl-compliance-fatf-travel-rule'], lead: /originator|beneficiary/i, note: 'a travel-rule explainer; lead names originator/beneficiary information' },
  D3: { right: ['c5-mas-licence-paying-suppliers-rlusd'], lead: /licen[cs]e/i, note: 'the MAS licence explainer; lead says when a licence applies' },
  D4: { right: ['product-escrow-no-show'], lead: /EscrowCancel|CancelAfter|cancel/i, note: 'the no-show recovery explainer; lead says the buyer cancels and recovers' },
  E5: { right: [], none: true, note: 'unanswerable from the corpus: buy nothing' },
  B5: { right: ['product-how-it-decides'], lead: /decid|worth buying|two steps/i, note: 'the how-it-decides explainer' },
  C1: { right: ['product-writer-paid'], lead: /key/i, note: 'the writer-paid explainer; lead says the writer is paid by publishing the key' },
  C4: { right: ['product-writer-earnings'], lead: /S\$0\.40|full price|40,000 drops|fee/i, note: 'the writer-earnings explainer; lead states the earning or fee' },
}
const JUDGES: Record<string, string> = {
  A3: 'How much does one key-reveal purchase cost in XRPL network fees?',
  A4: 'Which XRPL amendment and issuer flag does token escrow need?',
  A5: "What's the difference between EscrowFinish and EscrowCancel, and who can submit each one?",
  D1: 'What travel-rule information must a VASP send with a crypto transfer in Singapore?',
  D3: 'Does a Singapore company need a MAS licence to pay suppliers in RLUSD?',
  D4: 'If my agent pays for an article and the writer never reveals the key, what happens to my money?',
  E5: 'Which XRPL validators are run by Singapore banks?',
  B5: 'How does ResearchAgent decide which article is worth buying?',
  C1: 'How does the writer get paid, and what stops the agent from reading the article and then refusing to pay?',
  C4: 'How much does a writer earn per sale, and what does ResearchAgent take as a fee?',
}
const { readFileSync } = await import('node:fs')
const negatives = (JSON.parse(readFileSync('eval/questions/judge-xrpl.v5-negatives.json', 'utf8')) as { questions: { id: string; question: string }[] }).questions
const QUESTIONS: Q[] = [
  ...presets.map(p => ({ set: 'presets' as const, id: p.id, question: p.text, gold: GOLD[p.id] })),
  ...Object.entries(JUDGES).map(([id, question]) => ({ set: 'judges' as const, id, question, gold: GOLD[id] })),
  ...negatives.map(n => ({ set: 'negatives' as const, id: n.id, question: n.question, gold: { right: [], none: true, note: 'v5 off-topic: buy nothing' } })),
].filter(q => SETS.includes(q.set) && (!ONLY.length || ONLY.includes(q.id)))
if (QUESTIONS.some(q => !q.gold)) throw Error('a question has no gold definition')

// ---- DeepSeek record/replay proxy (pairs the arms on the same live plan) ----
type Recorded = { status: number; type: string; chunks: [number, Buffer][] }
const tape = new Map<string, Recorded>()
let proxyMode: 'record' | 'replay' = 'record', proxyTag = ''
const proxyStats = { live: 0, replayed: 0, liveInReplay: 0 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const deepseek = new URL('https://api.deepseek.com')
const proxy = createServer((req, res) => {
  const parts: Buffer[] = []
  req.on('data', c => parts.push(c))
  req.on('end', async () => {
    const body = Buffer.concat(parts)
    const key = createHash('sha256').update(proxyTag).update('\n').update(req.url ?? '').update('\n').update(body).digest('hex')
    const hit = proxyMode === 'replay' ? tape.get(key) : undefined
    let closed = false
    res.on('close', () => { closed = true })
    try {
      if (hit) {
        proxyStats.replayed++
        res.writeHead(hit.status, { 'content-type': hit.type })
        let last = 0
        for (const [t, chunk] of hit.chunks) { await sleep(t - last); last = t; if (closed) return; res.write(chunk) }
        res.end(); return
      }
      proxyStats.live++
      if (proxyMode === 'replay') proxyStats.liveInReplay++
      const started = performance.now()
      const controller = new AbortController()
      res.on('close', () => { if (!res.writableEnded) controller.abort() })
      const upstream = await fetch(new URL(req.url ?? '/', deepseek), { method: req.method, body, signal: controller.signal, headers: pick(req.headers, ['authorization', 'content-type', 'accept']) })
      const type = upstream.headers.get('content-type') ?? 'application/json'
      res.writeHead(upstream.status, { 'content-type': type })
      const recorded: Recorded = { status: upstream.status, type, chunks: [] }
      const reader = upstream.body!.getReader()
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = Buffer.from(value)
        recorded.chunks.push([performance.now() - started, chunk])
        if (!closed) res.write(chunk)
      }
      res.end()
      if (proxyMode === 'record' && upstream.ok) tape.set(key, recorded)
    } catch { if (!res.headersSent) res.writeHead(502); res.end() }
  })
})
function pick(headers: IncomingHttpHeaders, names: string[]) {
  const picked: Record<string, string> = {}
  for (const name of names) { const value = headers[name]; if (typeof value === 'string') picked[name] = value }
  return picked
}
proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening')
process.env.LLM_BASE_URL = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`

// ---- OpenAI Decisions: time every attempt, keep tokens and statuses (never bodies) ----
type DecisionCall = { run: string; kind: string; questions: number; ms: number; status: string; reservedUsd: number; chargedUsd: number; inputTokens?: number; outputTokens?: number; reasoningTokens?: number }
const calls: DecisionCall[] = []
let currentRun = ''
const kindOf = (names: string[]) => names.includes('gap_material') || names.some(n => /^c\d+_/.test(n)) ? 'candidates' : names.some(n => n.startsWith('coverage_')) ? 'coverage' : names.length === 1 && names[0] === 'addresses_gap' ? 'paid-relevance' : names.length === 3 ? 'candidate' : 'other'
const timedFetch: typeof fetch = async (url, init) => {
  const body = JSON.parse(String(init?.body ?? '{}')) as { questions?: { name: string }[] }
  const names = (body.questions ?? []).map(q => q.name)
  // Reserve before dispatch, including concurrent siblings. Unknown usage (including aborts/errors) keeps the full
  // hosted bound instead of silently counting as free. This guard is local to the measurement, never a product cap.
  const reservedUsd = ((Buffer.byteLength(String(init?.body ?? '')) + 1024) * RATES.decision.input + 8192 * RATES.decision.output) / 1e6
  if (openaiUsd() + reservedUsd > CAP_USD) throw Error('OpenAI measurement spend cap reached before dispatch')
  const record: DecisionCall = { run: currentRun, kind: kindOf(names), questions: names.length, ms: 0, status: 'pending', reservedUsd, chargedUsd: reservedUsd }
  calls.push(record)
  const started = performance.now()
  try {
    const response = await fetch(url, init)
    const text = await response.text()
    record.ms = Math.round(performance.now() - started)
    record.status = response.ok ? 'ok' : `HTTP ${response.status}`
    try {
      const usage = (JSON.parse(text) as { usage?: { input_tokens?: number; output_tokens?: number; output_tokens_details?: { reasoning_tokens?: number } } }).usage
      record.inputTokens = usage?.input_tokens; record.outputTokens = usage?.output_tokens; record.reasoningTokens = usage?.output_tokens_details?.reasoning_tokens
      if (response.ok && Number.isSafeInteger(usage?.input_tokens) && Number.isSafeInteger(usage?.output_tokens) && usage!.input_tokens! >= 0 && usage!.output_tokens! >= 0) record.chargedUsd = (usage!.input_tokens! * RATES.decision.input + usage!.output_tokens! * RATES.decision.output) / 1e6
    } catch { /* non-JSON error body */ }
    return new Response(text, { status: response.status, statusText: response.statusText, headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' } })
  } catch (error) {
    record.ms = Math.round(performance.now() - started)
    record.status = (error as Error).name === 'AbortError' ? (record.ms >= 4900 ? 'timeout' : 'aborted (sibling failed)') : 'transport failure'
    throw error
  }
}
const openaiUsd = () => calls.reduce((sum, c) => sum + c.chargedUsd, 0)

// ---- Hosted meter: per-question peak reservation and every cap refusal ----
const { HostedLimits, LIMITS } = await import('../../server/hosted/limits.js')
type MeterNote = { run: string; provider: string; code?: string; peakMicro?: number; peakDecisionInput?: number }
const meter: MeterNote[] = []
const attempt = HostedLimits.prototype.attempt
HostedLimits.prototype.attempt = function (this: InstanceType<typeof HostedLimits>, id: string, provider: string, model: string, input: number, output: number, micro: number) {
  try {
    const row = (() => {
      try { return attempt.call(this, id, provider, model, input, output, micro) } catch (error) {
        // openai-uncapped only: admit a decision attempt the per-question token ceiling refused, with the same money check.
        if (!(currentRun.startsWith('openai-uncapped:') && provider === 'decision' && (error as { code?: string }).code === 'question_token_cap')) throw error
        meter.push({ run: currentRun, provider, code: 'question_token_cap (lifted: measurement only)' })
        return this.store.hostedState(db => {
          const hold = db.prepare('SELECT model_used, model_envelope FROM hosted_holds WHERE id=?').get(id) as { model_used: number; model_envelope: number }
          if (hold.model_used + micro > Math.min(hold.model_envelope, LIMITS.questionModel)) throw Object.assign(new Error('question_model_cap'), { code: 'question_model_cap' })
          db.prepare('UPDATE hosted_holds SET model_used=model_used+? WHERE id=?').run(micro, id)
          return Number(db.prepare('INSERT INTO hosted_attempts (hold_id,provider,model,reserved,input_tokens,output_tokens,created) VALUES (?,?,?,?,?,?,?)').run(id, provider, model, micro, input, output, this.now()).lastInsertRowid)
        })
      }
    })()
    const state = this.store.hostedState(db => ({
      used: Number(db.prepare('SELECT model_used FROM hosted_holds WHERE id=?').get(id)!.model_used),
      input: Number(db.prepare("SELECT coalesce(sum(input_tokens),0) AS n FROM hosted_attempts WHERE hold_id=? AND provider='decision'").get(id)!.n),
    }))
    meter.push({ run: currentRun, provider, peakMicro: state.used, peakDecisionInput: state.input })
    return row
  } catch (error) {
    meter.push({ run: currentRun, provider, code: (error as { code?: string }).code ?? (error as Error).message })
    throw error
  }
}

// ---- Writers and the two gateways ----
const { createPublisherApp } = await import('../../publisher/routes.js')
const publisher = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} })
await publisher.locals.ready; await publisher.locals.writersReady
const writerServer = publisher.listen(0, '127.0.0.1'); await once(writerServer, 'listening')
const publisherUrl = `http://127.0.0.1:${(writerServer.address() as { port: number }).port}`
process.env.PUBLISHER_URL = publisherUrl
const { createApiApp } = await import('../../server/routes.js')
const { OpenAIDecisionsProvider } = await import('../../server/agents/openai-decisions.js')
type Gateway = { arm: Arm; port: number; api: Awaited<ReturnType<typeof createApiApp>>; close: () => Promise<void> }
async function gateway(arm: Arm): Promise<Gateway> {
  const api = await createApiApp({ dbPath: join(dir, `${arm}.db`), publisherUrl, hostedReadiness: async () => true, ...(arm !== 'fixture' ? { provider: new OpenAIDecisionsProvider({ allowLive: true, fetch: timedFetch, ...(MAX_QUESTIONS[arm] ? { maxQuestions: MAX_QUESTIONS[arm] } : {}) }) } : {}) })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  return { arm, api, port: (server.address() as { port: number }).port, close: async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await api.close() } }
}
const gateways = Object.fromEntries(await Promise.all(ARMS.map(async arm => [arm, await gateway(arm)]))) as Record<Arm, Gateway>

type Reply = { status: number; headers: IncomingHttpHeaders; text: string }
const wire = (g: Gateway, path: string, method = 'GET', headers: Record<string, string> = {}, body?: unknown) => new Promise<Reply>((done, fail) => {
  const req = httpRequest({ host: '127.0.0.1', port: g.port, path, method, headers: { Host: 'demo.example', 'Content-Type': 'application/json', ...headers } }, res => {
    let text = ''; res.setEncoding('utf8'); res.on('data', c => text += c); res.on('end', () => done({ status: res.statusCode!, headers: res.headers, text }))
  })
  req.on('error', fail); req.end(body === undefined ? undefined : JSON.stringify(body))
})

// ---- One hosted visitor asking one question, exactly as the web app does ----
type RunSnap = import('../../shared/contracts/index.js').RunSnapshot
let visitors = 0
async function ask(g: Gateway, q: Q, rep: number) {
  const ip = `198.51.100.${(visitors++ % 250) + 1}`
  const statusReply = await wire(g, '/api/demo/status', 'GET', { 'X-Forwarded-For': ip })
  const status = JSON.parse(statusReply.text) as { state: string; csrfToken: string; labels: { models: string; rail: string } }
  if (status.state !== 'ready') throw Error(`${g.arm} gateway is ${status.state}, not ready`)
  const visitor = { Cookie: statusReply.headers['set-cookie']![0].split(';')[0], Origin: ORIGIN, 'X-CSRF-Token': status.csrfToken, 'X-Forwarded-For': ip }
  const key = `live-dec-${g.arm}-${q.id}-${rep}-${Date.now()}`
  const t0 = performance.now()
  const scoped = DIRECT ? { status: 200, text: JSON.stringify({ label: 'direct (no scope)', questions: [], plan: { subqueries: [] } }), headers: {} } : await wire(g, '/api/scope', 'POST', { ...visitor, 'Idempotency-Key': key }, { question: q.question })
  const scopeMs = Math.round(performance.now() - t0)
  if (scoped.status !== 200) return { arm: g.arm, set: q.set, id: q.id, rep, question: q.question, outcome: `scope HTTP ${scoped.status} ${scoped.text.slice(0, 120)}`, scopeMs, chipModels: status.labels.models }
  const scope = JSON.parse(scoped.text) as { label: string; chat?: { reply: string }; questions: unknown[]; plan: { restatement?: string; subqueries: string[]; requirements?: { text: string }[] } }
  const base = { arm: g.arm, set: q.set, id: q.id, rep, question: q.question, chipModels: status.labels.models, scopeLabel: scope.label, scopeMs, clarifyOffered: scope.questions?.length ?? 0 }
  if (scope.chat) return { ...base, outcome: 'chat reply (no run)', chat: scope.chat.reply, bought: [] as string[], spentMinor: 0, totalMs: scopeMs }
  const t1 = performance.now()
  const posted = await wire(g, '/runs', 'POST', { ...visitor, 'Idempotency-Key': key }, { question: q.question, budgetMinor: 200, ...(DIRECT ? {} : { plan: scope.plan }) })
  if (posted.status !== 201) return { ...base, outcome: `runs HTTP ${posted.status} ${posted.text.slice(0, 160)}` }
  const runId = (JSON.parse(posted.text) as { runId: string }).runId
  currentRun = `${g.arm}:${q.id}:${rep}`
  let run: RunSnap
  for (const deadline = Date.now() + 240_000; ;) {
    run = JSON.parse((await wire(g, `/runs/${runId}`, 'GET', visitor)).text) as RunSnap
    if (['DONE', 'FAILED', 'STOPPED'].includes(run.phase) && run.intents.every(i => !['DECIDED', 'QUOTED', 'RESERVED', 'SUBMITTING', 'SETTLED', 'DELIVERY_PENDING'].includes(i.status))) break
    if (Date.now() > deadline) break
    await sleep(200)
  }
  const runMs = Math.round(performance.now() - t1)
  currentRun = ''
  const receiptReply = await wire(g, `/runs/${runId}/receipts.json`, 'GET', visitor)
  const receiptLabel = receiptReply.status === 200 ? (JSON.parse(receiptReply.text) as { label?: string }).label : `HTTP ${receiptReply.status}`
  const answer = run.answers.at(-1)
  const lead = (answer?.lead ?? []).map(l => l.text)
  const bought = run.intents.filter(i => i.status === 'VERIFIED' || i.status === 'REFUNDED').map(i => i.resourceId)
  const hold = g.api.store!.hostedState(db => {
    const h = db.prepare('SELECT id FROM hosted_holds WHERE run_id=?').get(runId) as { id: string } | undefined
    return h ? db.prepare('SELECT provider, count(*) AS calls, sum(reserved) AS micro, sum(input_tokens) AS input, sum(output_tokens) AS output FROM hosted_attempts WHERE hold_id=? GROUP BY provider').all(h.id) as { provider: string; calls: number; micro: number; input: number; output: number }[] : []
  })
  const tag = `${g.arm}:${q.id}:${rep}`
  const myCalls = calls.filter(c => c.run === tag)
  const myMeter = meter.filter(m => m.run === tag)
  const events = run.events.map(e => ({ type: e.type, label: e.label, at: e.at }))
  return {
    ...base, runId, phase: run.phase, stopReason: run.checkpoint?.stopReason ?? null, error: run.error ?? null,
    plan: DIRECT ? (run.events.find(e => e.type === 'PLAN')?.data ?? null) : { restatement: scope.plan.restatement, subqueries: scope.plan.subqueries, requirements: (scope.plan.requirements ?? []).map(r => r.text) },
    planEvents: run.events.filter(e => e.type === 'PLAN').length,
    bought, spentMinor: run.spentMinor, intents: run.intents.map(i => ({ resourceId: i.resourceId, status: i.status, priceMinor: (i as { priceMinor?: number }).priceMinor })),
    lead, conclusion: answer?.conclusion?.slice(0, 600) ?? '', openGaps: (answer?.openGaps ?? []).map(gap => gap.text),
    labels: run.labels, receiptLabel,
    decisions: run.decisions.map(d => ({ round: d.round, provider: d.provider, model: d.model, gap: d.gap, selected: d.selectedResourceId ?? null, rows: d.rows.map(r => ({ id: r.candidate.resourceId, verdict: r.verdict, value: Number(r.value.toFixed(3)), reason: r.reason })) })),
    fallbacks: run.events.filter(e => ['MODEL_FALLBACK', 'DECISION_UNAVAILABLE'].includes(e.type)).map(e => ({ type: e.type, label: e.label })),
    decisionCalls: myCalls.map(({ run: _run, ...c }) => c),
    meter: { byProvider: hold, peakMicro: Math.max(0, ...myMeter.map(m => m.peakMicro ?? 0)), peakDecisionInputTokens: Math.max(0, ...myMeter.map(m => m.peakDecisionInput ?? 0)), refusals: myMeter.filter(m => m.code).map(m => `${m.provider}: ${m.code}`) },
    runMs, totalMs: scopeMs + runMs, events,
  }
}
type Result = Awaited<ReturnType<typeof ask>> & { deepseek: { live: number; replayed: number } }

// ---- Run: interleaved, fixture arm first so the openai arm replays its DeepSeek tape ----
mkdirSync(out, { recursive: true })
const results: Result[] = []
const save = () => writeFileSync(join(out, 'raw-results.json'), JSON.stringify({ note: 'LIVE-DEC raw results. One row per arm × question × repetition. No request bodies, headers or keys.', startedAt, results, decisionCalls: calls, proxy: proxyStats, openaiUsdUpperBound: Number(openaiUsd().toFixed(4)) }, null, 1) + '\n')
const startedAt = new Date().toISOString()
let stopped = ''
try {
  for (const q of QUESTIONS) {
    const reps = q.set === 'presets' ? REPS : JUDGE_REPS
    for (let rep = 1; rep <= reps; rep++) {
      if (openaiUsd() > CAP_USD) { stopped = `OpenAI spend upper bound reached US$${openaiUsd().toFixed(2)} (cap ${CAP_USD})`; break }
      proxyTag = `${q.id}:${rep}`
      tape.clear()
      for (const arm of ARMS) {
        proxyMode = arm === ARMS[0] ? 'record' : 'replay'
        const before = { ...proxyStats }
        currentRun = `${arm}:${q.id}:${rep}`
        const result = { ...await ask(gateways[arm], q, rep), deepseek: { live: proxyStats.live - before.live, replayed: proxyStats.replayed - before.replayed } }
        currentRun = ''
        results.push(result)
        const r = result as Partial<{ bought: string[]; spentMinor: number; lead: string[]; phase: string; totalMs: number; fallbacks: unknown[]; outcome: string }>
        console.log(`${arm.padEnd(7)} ${q.id.padEnd(5)} r${rep} ${(r.phase ?? r.outcome ?? '').padEnd(8)} S$${((r.spentMinor ?? 0) / 100).toFixed(2)} ${JSON.stringify(r.bought ?? [])} ${Math.round((r.totalMs ?? 0) / 100) / 10}s fb=${(r.fallbacks ?? []).length} lead=${JSON.stringify((r.lead ?? [])[0] ?? '').slice(0, 90)}`)
        save()
      }
    }
    if (stopped) break
  }
} finally {
  save()
  if (stopped) console.log(`STOPPED: ${stopped}`)
  console.log(`OpenAI decision calls ${calls.length}, spend upper bound US$${openaiUsd().toFixed(4)}; DeepSeek proxy ${JSON.stringify(proxyStats)}`)
  for (const g of Object.values(gateways)) await g.close()
  writerServer.closeAllConnections(); await new Promise<void>(done => writerServer.close(() => done()))
  publisher.locals.journal?.close?.()
  proxy.closeAllConnections(); await new Promise<void>(done => proxy.close(() => done()))
  await resources.close()
}
