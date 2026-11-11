// Release acceptance (H8-02): fresh receipts exported the way the hosted judge demo exports them, offline.
//   node --import tsx scripts/hosted-export-fixture.ts <out-dir>
// Runs the HOSTED=1 gateway in this process with fixture models, the simulated rail and the fixture writer server,
// all on ephemeral loopback ports (never 5100/8788/8790). An anonymous visitor (session cookie + CSRF) asks two
// questions; each answer's receipts come from GET /runs/:id/receipts.json, exactly as the Export menu fetches them:
//   hosted-purchase.receipts.json          a run that buys one article (simulated settlement, so no anchor);
//   hosted-anchored-decline.receipts.json  a run that buys nothing, promoted with the test-only stand-in anchor
//     (tests/helpers/stand-in-anchor.ts): a synthetic transaction that is never on a ledger. It carries `ledgerAnchor`
//     and the `answer-anchor` commitment, so the offline "anchor binding" check runs: the check v1.0.2 failed on
//     hosted exports. A purchase run cannot take the stand-in, because anchor binding also requires the anchor account
//     to be the payer and the simulated rail has no payer account; the committed real Testnet export covers that case.
//   hosted-unsigned-free.receipts.json     H9-02: a purchase run while the fictional writers serve their free articles
//     WITHOUT a signed delivery proof, as Open Records did on the hosted demo on 11 Nov (no signing seed on the VM):
//     "Verify on XRPL" then failed 6 of 34 checks on judge B's "writer never reveals the key" question. A loopback proxy
//     in front of the fixture writer server strips the proof from every fictional free read during this one run (the
//     team writers keep theirs); the run must read at least one, drop it, and its export must still verify.
// Run it in its own process: it sets HOSTED=1.
import { createServer as createHttpServer, request } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { ResourceScope } from '../shared/resource-scope.js'

const out = resolve(process.argv[2] ?? '')
if (!process.argv[2]) throw Error('Usage: node --import tsx scripts/hosted-export-fixture.ts <out-dir>')
const BUY = "What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC?"
const DECLINE = 'Who won the 2026 Singapore Grand Prix?'
// Under the fixture planner this question reads fictional free records (the Open Records filing) and buys one article.
const UNSIGNED = BUY
const fictional = (url = '') => /^\/w\/(?!team-)[a-z0-9-]+\/articles\//.test(url)
const ORIGIN = 'https://demo.example'

async function freePort() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const { port } = server.address() as { port: number }
  await new Promise<void>(done => server.close(() => done()))
  if ([5100, 8788, 8790].includes(port)) return freePort()
  return port
}

const scope = new ResourceScope()
try {
  const dir = scope.tempDir('ra-hosted-export-')
  const pub = await freePort()
  Object.assign(process.env, {
    HOSTED: '1', HOSTED_ORIGIN: ORIGIN, HOSTED_TRUSTED_PROXY: '127.0.0.2', HOSTED_IP_HMAC_KEY: 'release-acceptance-only-'.padEnd(40, 'x'), HOSTED_CONTROL_PATH: join(dir, 'control.json'),
    SETTLEMENT_RAIL: 'simulated', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', DOTENV_CONFIG_PATH: join(dir, 'no-env'),
    PUBLISHER_URL: `http://127.0.0.1:${pub}`, PUBLISHER_PORT: String(pub), PUBLISHER_DB: join(dir, 'publisher.db'), APP_DB: join(dir, 'app.db'), REPORT_DIR: join(dir, 'reports'),
  })
  for (const key of Object.keys(process.env)) if (/(?:API_KEY|TOKEN|SEED|SECRET)$/.test(key)) delete process.env[key]
  writeFileSync(process.env.HOSTED_CONTROL_PATH!, JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'release_acceptance', expiresAt: new Date(Date.now() + 86_400_000).toISOString() }))

  const publisher = scope.spawn(process.execPath, ['--import', 'tsx', 'publisher/server.ts'], { env: process.env })
  publisher.stdout.resume(); publisher.stderr.resume()
  for (let i = 0; ; i++) {
    try { if ((await fetch(`http://127.0.0.1:${pub}/health`)).ok) break } catch { /* starting */ }
    if (i > 150) throw Error('fixture writer server did not start')
    await new Promise(r => setTimeout(r, 200))
  }
  // H9-02: the writers as the hosted demo served Open Records. While `unsigned` is on, fictional free article reads lose
  // their signed delivery proof; every other byte passes through unchanged.
  let unsigned = false
  const stripped = new Set<string>()
  const proxy = createHttpServer((req, res) => {
    const headers = { ...req.headers }; delete headers['accept-encoding']
    const upstream = request({ host: '127.0.0.1', port: pub, path: req.url, method: req.method, headers }, up => {
      if (!(unsigned && req.method === 'GET' && up.statusCode === 200 && fictional(req.url))) { res.writeHead(up.statusCode!, up.headers); up.pipe(res); return }
      let text = ''; up.setEncoding('utf8'); up.on('data', c => text += c)
      up.on('end', () => {
        const article = JSON.parse(text) as { tier?: string; verification?: unknown; publisherSlug?: string; articleId?: string }
        if (article.tier === 'FREE' && article.verification) { delete article.verification; stripped.add(`${article.publisherSlug}/${article.articleId}`) }
        const body = JSON.stringify(article)
        res.writeHead(200, { ...up.headers, 'content-length': String(Buffer.byteLength(body)) }); res.end(body)
      })
    })
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
    req.pipe(upstream)
  })
  proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening')
  scope.defer(() => new Promise<void>(done => { proxy.closeAllConnections(); proxy.close(() => done()) }))
  process.env.PUBLISHER_URL = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`
  const { createApiApp } = await import('../server/routes.js')
  const { standInAnchor } = await import('../tests/helpers/stand-in-anchor.js')
  const api = await createApiApp({ dbPath: join(dir, 'app.db'), publisherUrl: process.env.PUBLISHER_URL, hostedReadiness: async () => true })
  scope.defer(() => api.close())
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  scope.defer(() => new Promise<void>(done => { server.closeAllConnections(); server.close(() => done()) }))
  const port = (server.address() as { port: number }).port

  type Reply = { status: number; headers: import('node:http').IncomingHttpHeaders; text: string }
  const wire = (path: string, method = 'GET', headers: Record<string, string> = {}, body?: unknown) => new Promise<Reply>((done, fail) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { Host: 'demo.example', 'Content-Type': 'application/json', ...headers } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', c => text += c); res.on('end', () => done({ status: res.statusCode!, headers: res.headers, text }))
    })
    req.on('error', fail); req.end(body === undefined ? undefined : JSON.stringify(body))
  })
  // An anonymous visitor: the status call mints the session cookie and its CSRF token.
  const status = await wire('/api/demo/status')
  const visitor = { Cookie: status.headers['set-cookie']![0].split(';')[0], Origin: ORIGIN, 'X-CSRF-Token': (JSON.parse(status.text) as { csrfToken: string }).csrfToken }
  const ask = async (question: string, key: string) => {
    const posted = await wire('/runs', 'POST', { ...visitor, 'Idempotency-Key': key }, { question, budgetMinor: 200 })
    if (posted.status !== 201) throw Error(`hosted POST /runs → ${posted.status} ${posted.text.slice(0, 200)}`)
    const runId = (JSON.parse(posted.text) as { runId: string }).runId
    let phase: string
    for (const deadline = Date.now() + 120_000; ;) {
      phase = (JSON.parse((await wire(`/runs/${runId}`, 'GET', visitor)).text) as { phase: string }).phase
      if (['DONE', 'FAILED', 'STOPPED'].includes(phase)) break
      if (Date.now() > deadline) throw Error(`hosted run did not finish (phase ${phase})`)
      await new Promise(r => setTimeout(r, 250))
    }
    if (phase !== 'DONE') throw Error(`hosted run ended ${phase}`)
    return runId
  }
  type Bundle = { ledgerAnchor?: { txHash: string }; payments: { kind: string }[]; answers: { lead?: unknown }[]; sources: { profileId: string; resourceId: string }[]; proofs: { resourceId: string }[] }
  const download = async (runId: string, file: string) => {
    const exported = await wire(`/runs/${runId}/receipts.json`, 'GET', visitor)
    if (exported.status !== 200) throw Error(`hosted receipts.json → ${exported.status}`)
    writeFileSync(join(out, file), exported.text.trimEnd() + '\n')
    return JSON.parse(exported.text) as Bundle
  }
  mkdirSync(out, { recursive: true })
  const bought = await download(await ask(BUY, 'release-hosted-buy'), 'hosted-purchase.receipts.json')
  if (!bought.payments.some(p => p.kind === 'purchase')) throw Error('hosted fixture purchase run bought nothing')
  const declinedId = await ask(DECLINE, 'release-hosted-decline')
  const { anchor } = standInAnchor(api.store!, declinedId)
  const declined = await download(declinedId, 'hosted-anchored-decline.receipts.json')
  if (declined.payments.some(p => p.kind === 'purchase')) throw Error('hosted fixture decline bought something')
  if (declined.ledgerAnchor?.txHash !== anchor.txHash) throw Error('decline export does not carry the stand-in anchor')
  if (!declined.answers.some(a => a.lead !== undefined)) throw Error('hosted export has no answer lead: the anchor-binding regression is not exercised')
  unsigned = true
  const unsignedId = await ask(UNSIGNED, 'release-hosted-unsigned-free')
  unsigned = false
  if (!stripped.size) throw Error('no fictional writer served an unsigned free article: the H9-02 regression is not exercised')
  const unsignedBundle = await download(unsignedId, 'hosted-unsigned-free.receipts.json')
  if (!unsignedBundle.payments.some(p => p.kind === 'purchase')) throw Error('hosted unsigned-free run bought nothing')
  // Every exported source carries its proof, and none of the unsigned reads is among them.
  if (unsignedBundle.sources.some(source => !unsignedBundle.proofs.some(proof => proof.resourceId === source.resourceId))) throw Error('hosted export carries a source without a proof')
  if (unsignedBundle.sources.some(source => stripped.has(`${source.profileId}/${source.resourceId}`))) throw Error('hosted export carries an unsigned free source')
  console.log(JSON.stringify({ purchase: 'hosted-purchase.receipts.json', anchoredDecline: 'hosted-anchored-decline.receipts.json', unsignedFree: 'hosted-unsigned-free.receipts.json', unsignedReads: [...stripped], anchor: 'synthetic stand-in (simulated rail; not on any ledger)', out }))
} finally { await scope.close() }
