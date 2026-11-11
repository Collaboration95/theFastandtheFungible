#!/usr/bin/env node
// Stage kit for the 18 Nov pitch: run it about ten minutes before the slot. It checks, in parallel and with 5 s each, what the
// pitch depends on, prints a GO / NO-GO table, and names the fallback tier (docs/stage.md, from FINAL-PUSH story §2.3) to use.
//
//   node scripts/stage-check.mjs [--video <file.mp4>] [--deck <file.pdf>] [--hosted <https url>] [--json]
//   node scripts/stage-check.mjs --serve-replay [--replay-dir <dir>] [--rebuild]
//
// It never asks a hosted question: its one hosted request is GET /api/demo/status, with ONE cookie jar kept between runs so
// repeated checks reuse a session instead of minting new ones. It never binds 5100, 8788 or 8790. Nothing is signed or paid.
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const CHECK_MS = 5000
export const KEY_TX = '4CCB4E56137D738847E853535B068329562AD490DA4D9F5551CEC2EB1AC70638'
export const RECEIPTS_SHA256 = '1f2fe4de4de58fedb68c8e04c9f2106fa0b66004c1839ae93f29bb0662ee13ee'
export const NODES = ['wss://s.altnet.rippletest.net:51233', 'wss://clio.altnet.rippletest.net:51233']
export const PAGES = 'https://collaboration95.github.io/theFastandtheFungible'
export const EXPLORER = 'https://testnet.xrpl.org'
export const FORBIDDEN_PORTS = [5100, 8788, 8790]
export const REPLAY_BASE = '/theFastandtheFungible/demo/'
const links = JSON.parse(readFileSync(join(ROOT, 'shared/links.json'), 'utf8'))
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
export const DEFAULTS = { hosted: links.hostedApp, deck: join(ROOT, 'docs/submission/ResearchAgent-SFF-deck.pdf'), receipts: join(ROOT, 'public/judge/hosted-run-nov11.receipts.json'), evidence: join(ROOT, 'docs/evidence/hosted-export-nov11/receipts.json') }

/** The fallback ladder (story §2.3). `say` is the label to speak; `show` is what is on screen. */
export const TIERS = {
  1: { name: 'Live', say: 'a run from ten minutes ago on our live Testnet sandbox', show: 'Tabs A to D as prepared: the x402 run, the validators refusal, its proof page, the EscrowFinish on the explorer. The live clicks are the explorer link and "Run the checks"; both read the public ledger.' },
  2: { name: 'Sandbox down', say: 'a recorded run from the live sandbox, 11 Nov', show: 'The prepared tabs if they are still open. Otherwise the Judges’ corner on the sandbox home (a committed run, verified in the browser) plus the explorer links from docs/evidence/hosted-export-nov11.' },
  3: { name: 'Explorer or public node down', say: 'replay of a recorded Testnet run, no backend', show: 'Tab E, the /demo/ replay (or serve it from this Mac: node scripts/stage-check.mjs --serve-replay), and offline "researchagent verify receipts.json" without --ledger.' },
  4: { name: 'No network', say: 'this is our recorded demo', show: 'The local video MP4 (0:09 to 1:27) and slides 3, 5 and 10 from the PDF. Offline verify in the terminal still works.' },
}

// ---------------------------------------------------------------------------------------------------------------------
// Small pieces

/** Runs `work(signal)` and gives up after `ms`, aborting what it started. */
export function timed(ms, work) {
  const control = new AbortController()
  let timer
  const limit = new Promise((_, reject) => { timer = setTimeout(() => { control.abort(); reject(new Error(`no answer in ${ms / 1000} s`)) }, ms) })
  return Promise.race([Promise.resolve().then(() => work(control.signal)), limit]).finally(() => clearTimeout(timer))
}
const reason = error => (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').slice(0, 160)
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

/** One cookie jar. It is kept in a file (mode 0600) so a second run sends the first run's session cookie back. */
export function cookieJar(file) {
  let cookies = {}
  if (file) { try { cookies = JSON.parse(readFileSync(file, 'utf8')) } catch { /* first run */ } }
  return {
    header: () => Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; '),
    absorb(response) {
      for (const line of response.headers?.getSetCookie?.() ?? []) {
        const [pair, ...attributes] = line.split(';'), eq = pair.indexOf('=')
        if (eq < 1) continue
        const name = pair.slice(0, eq).trim(), value = pair.slice(eq + 1).trim()
        if (!value || attributes.some(a => a.trim().toLowerCase() === 'max-age=0')) delete cookies[name]; else cookies[name] = value
      }
    },
    save() {
      if (!file) return
      try { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(cookies), { mode: 0o600 }); chmodSync(file, 0o600) } catch { /* a missing jar only costs one more session */ }
    },
    get size() { return Object.keys(cookies).length },
  }
}

const result = (id, name, status, detail, extra = {}) => ({ id, name, status, detail, ...extra })
const go = (id, name, detail, extra) => result(id, name, 'GO', detail, extra)
const nogo = (id, name, detail, extra) => result(id, name, 'NO-GO', detail, extra)

// ---------------------------------------------------------------------------------------------------------------------
// The checks. Each takes its own 5 s; none of them can ask a question or spend anything.

/** 1. The hosted sandbox's status. GET only, one cookie jar. The state is the tier-1 vs tier-2 decision. */
export async function checkHosted({ hosted, fetch, jar, ms }) {
  const name = 'Sandbox status (GET /api/demo/status only)'
  try {
    const { status, body } = await timed(ms, async signal => {
      const cookie = jar.header()
      const response = await fetch(`${hosted.replace(/\/$/, '')}/api/demo/status`, { method: 'GET', redirect: 'follow', signal, headers: { accept: 'application/json', 'user-agent': 'researchagent-stage-check', ...(cookie ? { cookie } : {}) } })
      jar.absorb(response); jar.save()
      let parsed
      try { parsed = await response.json() } catch { throw new Error(`HTTP ${response.status}, and not a status body`) }
      return { status: response.status, body: parsed }
    })
    if (!body || typeof body !== 'object' || body.hosted === false || typeof body.state !== 'string') throw new Error(`HTTP ${status}, not the hosted status`)
    const left = body.remaining ? `${body.remaining.questions} of 5 questions left, S$${(body.remaining.minor / 100).toFixed(2)}` : 'no allowance shown'
    const data = { state: body.state, questions: body.remaining?.questions, minor: body.remaining?.minor, ahead: body.wait?.ahead }
    const ok = body.state === 'ready' || body.state === 'busy'
    const note = body.state === 'busy' ? ' (a question is running: do not ask a new question)' : ''
    return (ok ? go : nogo)('hosted', name, `${body.state}${note} · ${left}`, { data })
  } catch (error) {
    return nogo('hosted', name, `unreachable: ${reason(error)}`, { data: { state: 'unreachable' } })
  }
}

/** 2. The pinned release assets answer a HEAD. `packaged` is what README and the install pages pin; `builders` is what the sandbox home shows. */
export async function checkRelease({ tag, fetch, ms, label }) {
  const v = tag.slice(1), base = `${links.repo}/releases/download/${tag}`
  const assets = [`researchagent-mcp-${v}.tgz`, `researchagent-${v}-py3-none-any.whl`]
  const name = `Release ${tag} (${label}): tgz and wheel`
  const rows = await Promise.all(assets.map(async asset => {
    try { return { asset, status: (await timed(ms, signal => fetch(`${base}/${asset}`, { method: 'HEAD', redirect: 'follow', signal, headers: { 'user-agent': 'researchagent-stage-check' } }))).status } }
    catch (error) { return { asset, status: 0, error: reason(error) } }
  }))
  const bad = rows.filter(row => row.status !== 200)
  return bad.length
    ? nogo(`release-${tag}`, name, bad.map(row => `${row.asset}: ${row.status ? `HTTP ${row.status}` : row.error}`).join('; '), { advisory: true })
    : go(`release-${tag}`, name, 'both answer 200', { advisory: true })
}

/** 3. testnet.xrpl.org answers. It is a single-page app, so this proves the site is up; check 5 proves the transaction is on the ledger. */
export async function checkExplorer({ fetch, ms }) {
  const name = `Explorer loads ${KEY_TX.slice(0, 8)}…`
  try {
    const response = await timed(ms, signal => fetch(`${EXPLORER}/transactions/${KEY_TX}`, { method: 'GET', redirect: 'follow', signal, headers: { 'user-agent': 'researchagent-stage-check' } }))
    await response.body?.cancel?.().catch?.(() => undefined)
    return response.status === 200 ? go('explorer', name, 'testnet.xrpl.org answers 200') : nogo('explorer', name, `HTTP ${response.status}`)
  } catch (error) { return nogo('explorer', name, reason(error)) }
}

/** One read-only WebSocket to the public Testnet nodes (the same two the browser verifier uses). */
export function ledgerSession({ WebSocket, ms }) {
  let socket, endpoint, opening, sequence = 0
  const pending = new Map()
  const connect = url => new Promise((resolveOpen, rejectOpen) => {
    let candidate
    const timer = setTimeout(() => { try { candidate?.close() } catch { /* already closed */ } rejectOpen(new Error('timeout')) }, ms)
    if (!WebSocket) { clearTimeout(timer); rejectOpen(new Error('this Node has no WebSocket; use Node 22 or later')); return }
    try { candidate = new WebSocket(url) } catch (error) { clearTimeout(timer); rejectOpen(error); return }
    candidate.addEventListener('open', () => { clearTimeout(timer); resolveOpen(candidate) }, { once: true })
    candidate.addEventListener('error', () => { clearTimeout(timer); rejectOpen(new Error('unavailable')) }, { once: true })
  })
  const open = () => opening ??= (async () => {
    let last
    for (const url of NODES) {
      try {
        const ws = await connect(url)
        ws.addEventListener('message', event => {
          let body
          try { body = JSON.parse(String(event.data)) } catch { return }
          const item = pending.get(body.id)
          if (!item) return
          pending.delete(body.id); item.resolve(body)
        })
        ws.addEventListener('close', () => { for (const item of pending.values()) item.reject(new Error('connection closed')); pending.clear() })
        endpoint = new URL(url).hostname
        return socket = ws
      } catch (error) { last = error /* then the next public node */ }
    }
    throw new Error(`no public Testnet node answered${last ? ` (${reason(last)})` : ''}`)
  })()
  return {
    endpoint: () => endpoint,
    async request(command) {
      const ws = await open(), id = ++sequence
      return await new Promise((resolveRequest, rejectRequest) => { pending.set(id, { resolve: resolveRequest, reject: rejectRequest }); ws.send(JSON.stringify({ ...command, id })) })
    },
    close() { try { socket?.close() } catch { /* nothing to close */ } for (const item of pending.values()) item.reject(new Error('closed')); pending.clear() },
  }
}

/** 4. A public node answers ledger_current. */
export async function checkNode({ session, ms }) {
  const name = 'Public Testnet node answers (ledger_current)'
  try {
    const body = await timed(ms, () => session.request({ command: 'ledger_current' }))
    const index = body?.result?.ledger_current_index
    if (!Number.isInteger(index)) throw new Error('no ledger index in the answer')
    return go('node', name, `${session.endpoint()} · ledger ${index}`)
  } catch (error) { return nogo('node', name, reason(error)) }
}

/** 5. The EscrowFinish the pitch opens is on the ledger: validated, with the key in Fulfillment. The same lookup "Run the checks" makes. */
export async function checkKeyTx({ session, ms }) {
  const name = 'Key transaction is on the ledger (EscrowFinish)'
  try {
    const body = await timed(ms, () => session.request({ command: 'tx', transaction: KEY_TX, binary: false }))
    const tx = body?.result?.tx_json ?? body?.result ?? {}
    if (body?.error === 'txnNotFound' || body?.result?.error === 'txnNotFound') throw new Error('not found on this node')
    const ok = body?.result?.validated === true && tx.TransactionType === 'EscrowFinish' && typeof tx.Fulfillment === 'string' && tx.Fulfillment.length > 8
    return ok ? go('key-tx', name, `validated, ledger ${body.result.ledger_index ?? '?'}, Fulfillment present`, { advisory: true }) : nogo('key-tx', name, 'answered, but not a validated EscrowFinish with a Fulfillment', { advisory: true })
  } catch (error) { return nogo('key-tx', name, reason(error), { advisory: true }) }
}

/** 6. The explainer site's replay and ledger pages load (Tab E). */
export async function checkPages({ fetch, ms }) {
  const name = 'Replay and ledger pages (/demo/, /ledger/)'
  const rows = await Promise.all(['demo', 'ledger'].map(async page => {
    try { const response = await timed(ms, signal => fetch(`${PAGES}/${page}/`, { method: 'GET', redirect: 'follow', signal, headers: { 'user-agent': 'researchagent-stage-check' } })); await response.body?.cancel?.().catch?.(() => undefined); return { page, status: response.status } }
    catch (error) { return { page, status: 0, error: reason(error) } }
  }))
  const bad = rows.filter(row => row.status !== 200)
  return bad.length ? nogo('pages', name, bad.map(row => `/${row.page}/: ${row.status ? `HTTP ${row.status}` : row.error}`).join('; '), { advisory: true }) : go('pages', name, 'both answer 200', { advisory: true })
}

/** 7. Local files: the deck, the video (given as an argument), and the committed recorded run. */
export function checkFiles({ deck, video, receipts, evidence, exists, readFile, replay = [] }) {
  const size = file => { try { return statSync(file).size } catch { return 0 } }
  const out = []
  out.push(exists(deck) ? go('deck', 'Deck PDF is on this Mac', `${deck.replace(ROOT + sep, '')} (${Math.round(size(deck) / 1024)} KiB)`) : nogo('deck', 'Deck PDF is on this Mac', `missing: ${deck}`))
  if (!video) out.push(result('video', 'Demo video MP4 is on this Mac', 'NOT CHECKED', 'pass --video <file.mp4>; tier 4 depends on it'))
  else out.push(exists(video) ? go('video', 'Demo video MP4 is on this Mac', `${video} (${(size(video) / 1048576).toFixed(1)} MiB)`) : nogo('video', 'Demo video MP4 is on this Mac', `missing: ${video}`))
  try {
    const served = readFile(receipts), recorded = readFile(evidence)
    const same = sha256(served) === sha256(recorded), pinned = sha256(served) === RECEIPTS_SHA256
    out.push(same && pinned ? go('receipts', 'Committed recorded run (receipts.json)', `sha256 ${RECEIPTS_SHA256.slice(0, 8)}…${RECEIPTS_SHA256.slice(-6)}, served copy matches the evidence copy`) : nogo('receipts', 'Committed recorded run (receipts.json)', pinned ? 'the served copy differs from docs/evidence' : 'sha256 is not the pinned one'))
  } catch (error) { out.push(nogo('receipts', 'Committed recorded run (receipts.json)', reason(error))) }
  // The replay is served from a build: one that is already there, or one the script makes in a few seconds from this checkout.
  const built = replay.find(dir => exists(join(dir, 'index.html')))
  out.push(built ? go('replay', 'Replay can be served from this Mac', `built: ${built}`) : replay.length && exists(join(ROOT, 'node_modules/vite/bin/vite.js')) ? go('replay', 'Replay can be served from this Mac', 'not built yet; --serve-replay builds it in a few seconds') : nogo('replay', 'Replay can be served from this Mac', 'no built replay and vite is not installed: run npm ci'))
  return out
}

/** 8. Offline verify of that run passes (no network, no --ledger). */
export async function checkOfflineVerify({ run, receipts, ms }) {
  const name = 'Offline verify of the recorded run (no --ledger)'
  try {
    const { code, output } = await timed(ms, signal => run(receipts, signal))
    return code === 0 && /RESULT PASS/.test(output) ? go('verify', name, 'RESULT PASS') : nogo('verify', name, code === 0 ? 'ran, but did not say RESULT PASS' : /Cannot find|ERR_MODULE_NOT_FOUND|tsx/.test(output) ? 'dependencies missing: run npm ci' : `exit ${code}: ${output.trim().split('\n').at(-1)?.slice(0, 120)}`)
  } catch (error) { return nogo('verify', name, reason(error)) }
}

/** The real offline verifier: the packaged TypeScript CLI's own entry, in this checkout. */
export function runVerifyChild(file, signal) {
  return new Promise(resolveRun => {
    const child = spawn(process.execPath, ['--import', 'tsx', join(ROOT, 'scripts/verify-answer.ts'), file], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RA_BACKEND_URL: '' } })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk }); child.stderr.on('data', chunk => { output += chunk })
    signal?.addEventListener('abort', () => child.kill('SIGKILL'), { once: true })
    child.on('close', code => resolveRun({ code: code ?? 1, output })); child.on('error', error => resolveRun({ code: 1, output: String(error) }))
  })
}

// ---------------------------------------------------------------------------------------------------------------------
// Running everything, deciding the tier, printing

export function defaultDeps() {
  return { fetch: globalThis.fetch, WebSocket: globalThis.WebSocket, exists: existsSync, readFile: file => readFileSync(file), run: runVerifyChild }
}

/** All checks in parallel. `options`: hosted, deck, video, ms, jarFile. */
export async function runChecks(options = {}, deps = defaultDeps()) {
  const { hosted = DEFAULTS.hosted, deck = DEFAULTS.deck, video, ms = CHECK_MS, jarFile } = options
  const jar = cookieJar(jarFile)
  const session = ledgerSession({ WebSocket: deps.WebSocket, ms })
  const tags = [[`v${pkg.version}`, 'what README and the install pages pin']]
  if (links.release !== tags[0][0]) tags.push([links.release, 'what the sandbox home tells builders'])
  const files = checkFiles({ deck, video, receipts: DEFAULTS.receipts, evidence: DEFAULTS.evidence, exists: deps.exists, readFile: deps.readFile, replay: [join(tmpdir(), 'researchagent-stage-replay'), join(ROOT, 'site/demo')] })
  try {
    const remote = await Promise.all([
      checkHosted({ hosted, fetch: deps.fetch, jar, ms }),
      checkExplorer({ fetch: deps.fetch, ms }),
      checkNode({ session, ms }),
      checkKeyTx({ session, ms }),
      checkPages({ fetch: deps.fetch, ms }),
      ...tags.map(([tag, label]) => checkRelease({ tag, label, fetch: deps.fetch, ms })),
      checkOfflineVerify({ run: deps.run, receipts: DEFAULTS.receipts, ms }),
    ])
    return [...remote.slice(0, -1), ...files, remote.at(-1)]
  } finally { session.close() }
}

const NETWORK = ['hosted', 'explorer', 'node', 'pages']
const needs = {
  1: results => ['hosted', 'explorer', 'node'].filter(id => !ok(results, id)),
  2: results => ['explorer', 'node', 'receipts'].filter(id => !ok(results, id)),
  3: results => ['replay', 'verify'].filter(id => !ok(results, id)),
  4: results => ['deck', 'video', 'verify'].filter(id => !ok(results, id)),
}
const ok = (results, id) => results.find(row => row.id === id)?.status === 'GO'
const tell = { hosted: 'sandbox ready', explorer: 'explorer', node: 'public node', receipts: 'committed run', replay: 'replay build', verify: 'offline verify', deck: 'deck PDF', video: 'video MP4 (pass --video)' }

/** Which tier to use (story §2.3), the lowest that is true: no network 4, explorer or node down 3, sandbox not ready 2, else 1. */
export function decideTier(results) {
  const network = results.filter(row => NETWORK.includes(row.id))
  const noNetwork = network.every(row => row.status === 'NO-GO')
  const tier = noNetwork ? 4 : !ok(results, 'explorer') || !ok(results, 'node') ? 3 : ok(results, 'hosted') ? 1 : 2
  const hosted = results.find(row => row.id === 'hosted')?.data?.state
  const notes = []
  if (tier === 2 && (hosted === 'unreachable' || !hosted)) notes.push('The sandbox page is not answering at all, so the Judges’ corner on it will not load either: only tabs that are already open will work. If they are not open, use tier 3.')
  if (tier === 1 && hosted === 'busy') notes.push('The sandbox is busy with another visitor. Do not ask a new question; the prepared tabs are unaffected.')
  const advisory = results.filter(row => row.advisory && row.status === 'NO-GO')
  if (advisory.length) notes.push(`Not part of the tier, but fix or avoid: ${advisory.map(row => row.name).join('; ')}.`)
  const fallbacks = [2, 3, 4].filter(n => n > tier).map(n => ({ tier: n, ready: needs[n](results).length === 0, missing: needs[n](results).map(id => tell[id]) }))
  return { tier, ...TIERS[tier], fallbacks, notes }
}

const pad = (text, width) => text.length >= width ? text : text + ' '.repeat(width - text.length)
export function renderReport(results, decision, { hosted = DEFAULTS.hosted, when = new Date() } = {}) {
  const sgt = when.toLocaleString('en-GB', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' })
  const width = Math.max(...results.map(row => row.name.length)) + 2
  const lines = [`ResearchAgent stage check · ${sgt} SGT · ${hosted}`, '', `${pad('Check', width)}${pad('Result', 13)}Detail`]
  for (const row of results) lines.push(`${pad(row.name, width)}${pad(row.status + (row.advisory && row.status === 'NO-GO' ? ' *' : ''), 13)}${row.detail}`)
  lines.push('', '* advisory: it does not change the tier', '', `USE TIER ${decision.tier} · ${decision.name}`, `Say:  "${decision.say}"`, `Show: ${decision.show}`)
  for (const note of decision.notes) lines.push(`Note: ${note}`)
  lines.push('Below it: ' + (decision.fallbacks.length ? decision.fallbacks.map(f => `tier ${f.tier} ${f.ready ? 'ready' : `NOT READY (${f.missing.join(', ')})`}`).join(' · ') : 'nothing; this is the last tier'))
  return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------------------------------
// --serve-replay: the /demo/ replay from this Mac, with nothing outside this machine reachable.

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' }
/** Sent on every response: the browser itself refuses any request that leaves this origin, so the replay cannot reach the network. */
export const REPLAY_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"

/** Static server for a built replay, on an ephemeral port of 127.0.0.1 only (never 5100, 8788 or 8790). Resolves to { url, port, close }. */
export async function serveReplay({ dir, base = REPLAY_BASE }) {
  const root = resolve(dir)
  if (!existsSync(join(root, 'index.html'))) throw new Error(`no replay build in ${root} (index.html missing)`)
  const headers = { 'Content-Security-Policy': REPLAY_CSP, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); res.end(); return }
    let path
    try { path = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname) } catch { res.writeHead(400, headers); res.end(); return }
    if (path === '/') { res.writeHead(302, { ...headers, Location: base }); res.end(); return }
    if (!path.startsWith(base)) { res.writeHead(404, headers); res.end('Not found'); return }
    const relative = path.slice(base.length) || 'index.html'
    const file = resolve(root, relative.endsWith('/') ? `${relative}index.html` : relative)
    if ((file !== root && !file.startsWith(root + sep)) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404, headers); res.end('Not found'); return }
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(req.method === 'HEAD' ? undefined : readFileSync(file))
  })
  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((resolveListen, rejectListen) => { server.once('error', rejectListen); server.listen(0, '127.0.0.1', () => { server.off('error', rejectListen); resolveListen() }) })
    const { port } = server.address()
    if (!FORBIDDEN_PORTS.includes(port)) return { port, url: `http://127.0.0.1:${port}${base}`, close: () => new Promise(done => server.close(() => done())) }
    await new Promise(done => server.close(() => done()))
  }
  throw new Error('could not get an ephemeral port that is not reserved')
}

/** Builds the replay into `outDir` with the repo's own demo config (no change under site/). It takes a few seconds of CPU. */
export function buildReplay(outDir) {
  return new Promise((resolveBuild, rejectBuild) => {
    const vite = join(ROOT, 'node_modules/vite/bin/vite.js')
    if (!existsSync(vite)) { rejectBuild(new Error('vite is not installed: run npm ci')); return }
    const child = spawn(process.execPath, [vite, 'build', '--config', 'demo/vite.config.ts', '--mode', 'browser-demo', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('close', code => code === 0 ? resolveBuild() : rejectBuild(new Error(`replay build failed (exit ${code})`)))
    child.on('error', rejectBuild)
  })
}

// ---------------------------------------------------------------------------------------------------------------------

export function parseArgs(argv) {
  const out = { json: false, serveReplay: false, rebuild: false }
  const value = (i, flag) => { const v = argv[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${flag} needs a value`); return v }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') out.json = true
    else if (a === '--serve-replay') out.serveReplay = true
    else if (a === '--rebuild') out.rebuild = true
    else if (a === '--help' || a === '-h') out.help = true
    else if (a === '--video') out.video = resolve(value(i++, a))
    else if (a === '--deck') out.deck = resolve(value(i++, a))
    else if (a === '--replay-dir') out.replayDir = resolve(value(i++, a))
    else if (a === '--jar') out.jarFile = resolve(value(i++, a))
    else if (a === '--hosted') { out.hosted = value(i++, a); if (!/^https:\/\/[^\s/]+(?:\/\S*)?$/.test(out.hosted) && !/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(out.hosted)) throw new Error('--hosted must be an https URL') }
    else if (a === '--timeout') { out.ms = Number(value(i++, a)); if (!(out.ms >= 500 && out.ms <= CHECK_MS)) throw new Error(`--timeout is 500 to ${CHECK_MS} ms`) }
    else throw new Error(`unknown option ${a} (try --help)`)
  }
  return out
}
const HELP = `Usage: node scripts/stage-check.mjs [--video <file.mp4>] [--deck <file.pdf>] [--hosted <https url>] [--json] [--timeout <ms>]
       node scripts/stage-check.mjs --serve-replay [--replay-dir <built replay>] [--rebuild]

Prints GO / NO-GO for what the pitch needs and the fallback tier to use. Exit 0 for tier 1, 1 for any other tier.
It asks no hosted question (one GET of /api/demo/status, cookie jar kept in the temp directory) and binds no fixed port.`

export async function main(argv = process.argv.slice(2), deps = defaultDeps(), io = { out: text => console.log(text), err: text => console.error(text) }) {
  let args
  try { args = parseArgs(argv) } catch (error) { io.err(`stage-check: ${reason(error)}`); return 2 }
  if (args.help) { io.out(HELP); return 0 }
  if (args.serveReplay) {
    const dir = args.replayDir ?? join(tmpdir(), 'researchagent-stage-replay')
    try {
      if (!args.replayDir && (args.rebuild || !existsSync(join(dir, 'index.html')))) { io.out('Building the replay (once; a few seconds)…'); await buildReplay(dir) }
      const server = await serveReplay({ dir })
      io.out(`Replay: ${server.url}\nServed from ${dir} on 127.0.0.1 only; the page cannot reach anything outside this Mac. Ctrl-C to stop.`)
      const stop = () => { void server.close().then(() => process.exit(0)) }
      process.once('SIGINT', stop); process.once('SIGTERM', stop)
      return await new Promise(() => undefined)
    } catch (error) { io.err(`stage-check: ${reason(error)}`); return 1 }
  }
  const jarFile = args.jarFile ?? join(tmpdir(), 'researchagent-stage-check.cookies.json')
  const results = await runChecks({ ...args, jarFile }, deps)
  const decision = decideTier(results)
  io.out(args.json ? JSON.stringify({ at: new Date().toISOString(), hosted: args.hosted ?? DEFAULTS.hosted, results, decision }, null, 2) : renderReport(results, decision, { hosted: args.hosted ?? DEFAULTS.hosted }))
  return decision.tier === 1 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main())
