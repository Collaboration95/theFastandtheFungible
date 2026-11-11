// Proof of refusal (lane W1): eligibility, snapshot sanitization, permalink immutability, hosted isolation between two
// sessions, and the public page. Fixture models, no network; the anchor is written to the DB the way AnswerAnchors does.
import { afterEach, expect, it, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFileSync, writeFileSync } from 'node:fs'
import { request as http } from 'node:http'
import { join } from 'node:path'
import { createApiApp } from '../server/routes.js'
import { HostedLimits } from '../server/hosted/limits.js'
import { loadConfig } from '../server/config.js'
import { Store } from '../server/store.js'
import { canonical } from '../server/audit.js'
import { RefusalProofs, ProofError, sanitizeBundle } from '../server/refusal-proof.js'
import { receiptBundle } from '../server/receipt-bundle.js'
import { renderProofPage } from '../server/proof-page.js'
import { verifyAnswer } from '../sdk/verify.js'
import { XRPL_LABEL } from '../shared/contracts/publisher.js'
import type { RunSnapshot } from '../shared/contracts/index.js'
import { refusalEligibility, PRIVATE_QUESTION, TEAM_WRITER_NAME } from '../shared/refusal-proof.js'
import { resources } from './helpers/resource-scope.js'

const sha = (text: string) => createHash('sha256').update(text).digest('hex')
const uc2 = JSON.parse(readFileSync('src/fixtures/uc/uc2.json', 'utf8')) as RunSnapshot
const QUESTION = 'Which Singapore banks are piloting RLUSD settlement in 2026?'
const labels = { research: 'fixture · extractive-fixture', decision: 'fixture · metadata-fixture', publisher: 'local', settlement: XRPL_LABEL }

/** A finished, anchored decline written the way the loop and AnswerAnchors write one (anchor transaction not on a real ledger). */
function declinedRun(store: Store, options: { principal?: string; question?: string; anchored?: boolean; settlement?: RunSnapshot['labels']['settlement'] } = {}) {
  const question = options.question ?? QUESTION, principal = options.principal ?? 'operator'
  const { run } = store.admit({ surface: 'web', principal, question, requestedMinor: 100, idempotencyKey: randomUUID(), maxMinor: 500, labels: { ...labels, settlement: options.settlement ?? XRPL_LABEL } })
  store.updateRun(run.runId, { candidates: uc2.candidates, labels: { ...labels, settlement: options.settlement ?? XRPL_LABEL } })
  store.addDecision(run.runId, uc2.decisions[0])
  store.addAnswer(run.runId, { version: 1, conclusion: 'Matched articles supplied no citable answer · nothing bought', claims: [], openGaps: [{ text: 'Which Singapore banks are piloting RLUSD settlement in 2026' }], provider: 'fixture', model: 'extractive-fixture' })
  store.appendEvent(run.runId, { type: 'DONE', label: 'Done' })
  store.updateRun(run.runId, { phase: 'DONE' })
  if (options.anchored !== false) anchor(store, run.runId)
  return run.runId
}
function anchor(store: Store, runId: string) {
  const answersHash = sha(canonical(store.getRun(runId).answers))
  store.recordAudit({ runId, kind: 'answer-anchor', data: { answersHash } })
  const tip = store.auditEntries().at(-1)!
  store.saveAnchor({ runId, head: tip.hash, seq: tip.seq, answersHash })
  store.updateRun(runId, { ledgerAnchor: { version: 'anchor-v1', network: 'xrpl:1', head: tip.hash, runIdHash: sha(runId), account: 'rNY14qvMuBi6CqU4wPbWaS5nztPLCxJTFn', txHash: sha(`tx:${runId}`).toUpperCase(), ledgerIndex: 22150001, feeDrops: '12' } })
}
const open = () => resources().own(new Store(join(resources().tempDir('w1-proof-'), 'app.db')))

it('shares an anchored decline as a sanitized snapshot whose receipts verify on their own', async () => {
  const store = open(), runId = declinedRun(store)
  const { proof, created } = await new RefusalProofs(store).create(runId, { hosted: false, principal: 'operator' })
  const s = proof.snapshot
  expect(created).toBe(true)
  expect(s).toMatchObject({ version: 'refusal-proof-v1', question: QUESTION, bought: { count: 0, spentMinor: 0, currency: 'SGD' }, environment: { surface: 'local', network: 'XRPL Testnet', models: 'fixture', label: 'XRPL Testnet demo · rule-based buying · no real value' } })
  expect(s.found.paid).toBe(12)
  expect(s.found.writers).toBeGreaterThan(1)
  expect(s.found.items.length + s.found.more).toBe(12)
  expect(s.found.items.every(item => item.verdict && !/SKIP_/.test(item.verdict))).toBe(true)
  expect(s.outcome.summary).toMatch(/^Nothing was bought/)
  expect(s.anchor.txHash).toBe(store.getRun(runId).ledgerAnchor!.txHash)
  // The stored bundle is verifiable without our server: same checks as `verify:answer`.
  expect((await verifyAnswer(s.bundle)).ok).toBe(true)
  expect(s.bundle.receipts).toEqual([]); expect(s.bundle.payments).toEqual([]); expect(s.bundle.grants).toEqual([])
})

it('keeps premium text, keys and other people’s data out of a snapshot', async () => {
  const store = open()
  // Another session's run and money sit in the same audit log, between this run's rows and its anchor.
  const runId = declinedRun(store, { principal: 'visitor-a-principal', anchored: false })
  const other = declinedRun(store, { principal: 'visitor-b-principal', question: 'A private question from visitor B' })
  anchor(store, runId)
  const { proof } = await new RefusalProofs(store).create(runId, { hosted: true, principal: 'visitor-a-principal' })
  const text = JSON.stringify(proof.snapshot)
  expect(text).not.toContain('visitor-b-principal'); expect(text).not.toContain('private question from visitor B'); expect(text).not.toContain(other)
  for (const entry of proof.snapshot.bundle.audit.entries) expect('commitment' in entry || entry.runId === runId).toBe(true)
  expect(proof.snapshot.bundle.audit.entries.some(entry => 'commitment' in entry)).toBe(true) // the other run is present only as an opaque hash link
  // No candidate preview text beyond what the public search already shows, no keys, no signed blobs.
  expect(text).not.toMatch(/keyReveal|txBlob|ciphertext|"seed"|XRPL_PAYER_SEED/)
  expect(proof.snapshot.bundle.sources.every(source => !uc2.candidates.some(c => c.tier === 'PAID' && c.resourceId === source.resourceId))).toBe(true)
  // Defensive checks refuse an export that carries paid text or a payment, even if upstream rules were bypassed.
  const bundle = receiptBundle(store, runId), run = store.getRun(runId)
  const paid = uc2.candidates.find(c => c.tier === 'PAID')!
  const leaked = { ...bundle, sources: [...bundle.sources, { profileId: paid.profileId, resourceId: paid.resourceId, version: paid.version, title: paid.title, publisher: paid.publisher, body: 'PREMIUM BODY CANARY', spans: [{ id: 's1', text: 'PREMIUM BODY CANARY' }] }] }
  expect(() => sanitizeBundle(leaked as never, run)).toThrow(ProofError)
  expect(() => sanitizeBundle({ ...bundle, receipts: [{ receiptId: 'r1' }] } as never, run)).toThrow(/paid a writer/)
  expect(() => sanitizeBundle({ ...bundle, audit: { ...bundle.audit, entries: [...bundle.audit.entries, { ...bundle.audit.entries[0], runId: other }] } } as never, run)).toThrow(/another run/)
})

it('never changes a permalink: one proof per run, frozen bytes, tamper-evident, kept until its end date', async () => {
  const store = open(), runId = declinedRun(store), proofs = new RefusalProofs(store)
  const first = await proofs.create(runId, { hosted: true, principal: 'a', now: Date.parse('2026-11-12T00:00:00Z') })
  const again = await proofs.create(runId, { hosted: true, principal: 'a', now: Date.parse('2026-11-13T00:00:00Z') })
  expect(again).toMatchObject({ created: false }); expect(again.proof.id).toBe(first.proof.id)
  expect(canonical(again.proof.snapshot)).toBe(canonical(first.proof.snapshot))
  expect(first.proof.snapshot.createdAt).toBe('2026-11-12T00:00:00.000Z')
  // Later changes to the run (history cleared, run pruned) cannot reach the stored snapshot.
  store.setRunMeta(runId, { hidden: true })
  expect(proofs.get(first.proof.id, Date.parse('2026-11-14T00:00:00Z'))?.snapshot.question).toBe(QUESTION)
  const raw = (sql: string, ...args: (string | number)[]) => store.hostedState(db => db.prepare(sql).run(...args))
  expect(() => raw('UPDATE refusal_proofs SET json=? WHERE id=?', '{}', first.proof.id)).toThrow(/immutable/)
  expect(() => raw('DELETE FROM refusal_proofs WHERE id=?', first.proof.id)).toThrow(/retention/)
  // A row altered behind the triggers' back no longer matches its digest, so it is not served at all.
  store.hostedState(db => { db.exec('DROP TRIGGER refusal_proofs_immutable'); db.prepare("UPDATE refusal_proofs SET json=replace(json, 'RLUSD', 'XRP') WHERE id=?").run(first.proof.id) })
  expect(proofs.get(first.proof.id, Date.parse('2026-11-14T00:00:00Z'))).toBeUndefined()
  // Past the retention date it is gone for good.
  expect(proofs.get(first.proof.id, Date.parse('2027-01-01T00:00:00Z'))).toBeUndefined()
})

it('only a finished, unpaid, unanswered, anchored decline can be shared, and says why not', async () => {
  const store = open(), proofs = new RefusalProofs(store)
  const base = { ...uc2, phase: 'DONE', answers: [], receipts: [], intents: [], grants: [], contents: [], spentMinor: 0, reservedMinor: 0, labels: { ...uc2.labels, settlement: XRPL_LABEL }, events: [{ id: 1, runId: 'x', type: 'DONE', label: 'Done', at: new Date(Date.now() - 5_000).toISOString() }],
    ledgerAnchor: { version: 'anchor-v1', network: 'xrpl:1', txHash: 'B'.repeat(64), account: 'rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf', head: 'b'.repeat(64), runIdHash: 'c'.repeat(64), ledgerIndex: 1, feeDrops: '12' } } as unknown as RunSnapshot
  expect(refusalEligibility(base)).toEqual({ ok: true })
  const code = (patch: Partial<RunSnapshot>, now?: number) => { const r = refusalEligibility({ ...base, ...patch }, now); return r.ok ? 'ok' : r.code }
  expect(code({ phase: 'READ_FREE' })).toBe('not_finished')
  expect(code({ phase: 'STOPPED' })).toBe('not_finished')
  expect(code({ spentMinor: 30 })).toBe('purchased')
  expect(code({ budgetMinor: 0 })).toBe('no_budget') // a Free question had nothing to refuse (H5)
  expect(code({ receipts: uc2.receipts.length ? uc2.receipts : [{ receiptId: 'r' } as never] })).toBe('purchased')
  expect(code({ answers: uc2.answers })).toBe('answered')
  expect(code({ labels: { ...base.labels, settlement: 'SIMULATED SGD · no real funds' } })).toBe('simulated')
  expect(code({ question: 'mail me at someone@example.com about RLUSD' })).toBe('private_question')
  expect(PRIVATE_QUESTION.test('sk-' + 'a'.repeat(24))).toBe(true)
  // No anchor yet: wait while the run is fresh, then report it missing; a recorded failure is final at once.
  expect(code({ ledgerAnchor: undefined })).toBe('anchor_pending')
  expect(code({ ledgerAnchor: undefined }, Date.now() + 300_000)).toBe('anchor_missing')
  expect(code({ ledgerAnchor: undefined, events: [...base.events, { id: 2, runId: 'x', type: 'SNAPSHOT', label: 'Anchor unavailable (failed)', at: new Date().toISOString() }] })).toBe('anchor_missing')
  // The server refuses with the same reason instead of storing anything.
  const simulated = declinedRun(store, { settlement: 'SIMULATED SGD · no real funds', anchored: false })
  await expect(proofs.create(simulated, { hosted: false, principal: 'operator' })).rejects.toMatchObject({ status: 409, code: 'simulated' })
  const pending = declinedRun(store, { anchored: false })
  await expect(proofs.create(pending, { hosted: false, principal: 'operator' })).rejects.toMatchObject({ status: 409, code: 'anchor_pending' })
  await expect(proofs.create('no-such-run', { hosted: false, principal: 'operator' })).rejects.toMatchObject({ status: 404 })
  expect(store.hostedState(db => Number(db.prepare('SELECT count(*) AS n FROM refusal_proofs').get()!.n))).toBe(0)
})

it('prints the team’s writers under one label, even for a proof stored with the older names', async () => {
  const store = open()
  const { proof } = await new RefusalProofs(store).create(declinedRun(store), { hosted: false, principal: 'operator' })
  const stored = structuredClone(proof.snapshot), item = stored.found.items[0]
  stored.found.items = [{ ...item, writer: 'ResearchAgent builders' }, { ...item, writer: 'ResearchAgent builders (team-authored)' }, { ...item, writer: 'The Fab Floor' }]
  const writers = [...renderProofPage(stored, { mode: 'page', origin: 'https://demo.example', nonce: 'N0NCE' }).matchAll(/<small>([^<]*?) · S\$/g)].map(match => match[1])
  expect(writers).toEqual([TEAM_WRITER_NAME, TEAM_WRITER_NAME, 'The Fab Floor'])
})

it('renders a safe, complete public page and a self-contained card', async () => {
  const store = open(), hostile = 'What is <script>alert(1)</script> & "RLUSD" on XRPL?'
  const { proof } = await new RefusalProofs(store).create(declinedRun(store, { question: hostile }), { hosted: false, principal: 'operator' })
  const page = renderProofPage(proof.snapshot, { mode: 'page', origin: 'https://demo.example', nonce: 'N0NCE' })
  expect(page).not.toContain('<script>alert(1)</script>'); expect(page).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  expect(page).toContain('<meta property="og:title" content="Refused to spend · verified on XRPL">')
  expect(page).toMatch(/og:description" content="[^"]*12 paid articles found, none bought\. S\$0\.00 spent\./)
  expect(page).toContain('og:image" content="https://demo.example/og/refusal-proof.png"')
  expect(page).toContain(`https://testnet.xrpl.org/transactions/${proof.snapshot.anchor.txHash}`)
  expect(page).toContain('S$0.00'); expect(page).toContain('Verify on XRPL in your browser')
  expect(page.match(/<script/g)).toHaveLength(1)
  const card = renderProofPage(proof.snapshot, { mode: 'card' })
  expect(card).not.toContain('<script'); expect(card).not.toMatch(/src=|href="https?:\/\/(?!testnet\.xrpl\.org)/)
  const saved = card.match(/href="data:application\/json;base64,([^"]+)"/)![1]
  expect(JSON.parse(Buffer.from(saved, 'base64').toString())).toEqual(JSON.parse(JSON.stringify(proof.snapshot.bundle)))
})

it('says one thing about the checks: "N passed · K not checked", never "7 of 9 passed" in green, and what it skips', async () => {
  const store = open()
  const { proof } = await new RefusalProofs(store).create(declinedRun(store), { hosted: false, principal: 'operator' })
  const { passed, skipped, total } = proof.snapshot.verification
  expect(passed + skipped).toBe(total)
  expect(skipped).toBeGreaterThan(0)
  const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  const page = text(renderProofPage(proof.snapshot, { mode: 'page', origin: 'https://demo.example', nonce: 'N0NCE' }))
  expect(page).toContain(`Checks ${passed} passed · ${skipped} not checked yet: they need the ledger or a writer lookup. The browser check below runs the ledger ones`)
  // A skipped check is not a failure and is not counted as a pass: no "7 of 9 checks passed" reading as two failures (H8-15).
  expect(page).not.toMatch(/\d+ of \d+ checks passed/)
  // The button's result keeps the same total, says "N passed · K not checked" when something is skipped, and names what it skips.
  const script = renderProofPage(proof.snapshot, { mode: 'page', nonce: 'N0NCE' }).match(/<script type="module"[^>]*>([\s\S]*)<\/script>/)![1]
  expect(script).toContain("passed === total ? 'All ' + total + ' checks passed' : passed + ' passed · ' + skipped.length + ' not checked'")
  expect(script).toContain("' Skipped here: ' + skipped.join(' and ')")
  expect(script).toContain("failed + ' of ' + total + ' checks failed'")
  // With nothing skipped the count is stated once, plainly.
  expect(text(renderProofPage({ ...proof.snapshot, verification: { ...proof.snapshot.verification, passed: total, skipped: 0 } }, { mode: 'page', nonce: 'N0NCE' }))).toContain(`Checks All ${total} checks passed when shared`)
  // The card (no browser check on it) states the count without pointing at a button that is not there.
  expect(text(renderProofPage(proof.snapshot, { mode: 'card' }))).toContain(`${passed} passed · ${skipped} not checked yet: they need the ledger or a writer lookup`)
  expect(text(renderProofPage(proof.snapshot, { mode: 'card' }))).not.toContain('the browser check below')
})

it('shows times in Singapore time, with the machine-readable time kept in UTC', async () => {
  const store = open()
  const { proof } = await new RefusalProofs(store).create(declinedRun(store), { hosted: false, principal: 'operator', now: Date.parse('2026-11-11T06:35:00Z') })
  const page = renderProofPage({ ...proof.snapshot, askedAt: '2026-11-11T16:05:00Z' }, { mode: 'page', nonce: 'N0NCE' })
  expect(page).toContain('<time datetime="2026-11-11T16:05:00.000Z">12 Nov 2026, 00:05 SGT</time>')
  expect(page).toContain('<time datetime="2026-11-11T06:35:00.000Z">11 Nov 2026, 14:35 SGT</time>')
  expect(page).not.toMatch(/\d{2}:\d{2} UTC/)
})

it('keeps the environment chip on a phone, in a short form, and never links a downloaded card to a page that is not there', async () => {
  const store = open()
  const { proof } = await new RefusalProofs(store).create(declinedRun(store), { hosted: false, principal: 'operator' })
  const page = renderProofPage(proof.snapshot, { mode: 'page', origin: 'https://demo.example', nonce: 'N0NCE' })
  expect(page).toContain(`<span class="chip"><i></i><span class="full">${proof.snapshot.environment.label}</span><span class="short">Testnet demo · no real value</span></span>`)
  expect(page).toContain('@media (max-width:620px)'); expect(page).toContain('.chip .full{display:none}.chip .short{display:inline}')
  expect(page).not.toMatch(/\.chip\{display:none\}/)
  // Local and desktop have no public address: the card carries the receipts and no dead "live page" link.
  expect(renderProofPage(proof.snapshot, { mode: 'card' })).not.toContain('Open the live page')
  expect(renderProofPage(proof.snapshot, { mode: 'card', origin: 'https://demo.example' })).toContain(`href="https://demo.example/proof/${proof.id}">Open the live page`)
})

// --- Hosted: two sessions, one public page ---------------------------------------------------------------------------
const cleanup: (() => unknown)[] = []
afterEach(async () => { for (const f of cleanup.splice(0).reverse()) await f(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
const wire = (url: string, method = 'GET', headers: Record<string, string> = {}, body?: unknown) => new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; text: string; json: <T = Record<string, unknown>>() => T }>((resolve, reject) => {
  const req = http(url, { method, headers: { Host: 'demo.example', 'Content-Type': 'application/json', ...headers } }, res => { let text = ''; res.on('data', c => text += c); res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, text, json: <T>() => JSON.parse(text) as T })) })
  req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body))
})
async function hosted() {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-12T12:00:00Z'))
  const dir = resources().tempDir('w1-hosted-')
  for (const [k, v] of Object.entries({ HOSTED: '1', HOSTED_ORIGIN: 'https://demo.example', HOSTED_TRUSTED_PROXY: '127.0.0.2', HOSTED_IP_HMAC_KEY: 'a'.repeat(32), HOSTED_CONTROL_PATH: join(dir, 'control.json'), SETTLEMENT_RAIL: 'simulated', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', DEMO_PORT_OFFSET: '2900' })) vi.stubEnv(k, v)
  writeFileSync(process.env.HOSTED_CONTROL_PATH!, JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'test_ready', expiresAt: '2026-11-19T16:00:00Z' }))
  const api = await createApiApp({ dbPath: join(dir, 'app.db'), publisherUrl: 'http://127.0.0.1:1', hostedReadiness: async () => true })
  const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
  cleanup.push(async () => { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await api.close() })
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const jar = async () => { const r = await wire(url + '/api/demo/status'); return { Cookie: r.headers['set-cookie']![0].split(';')[0], Origin: 'https://demo.example', 'X-CSRF-Token': r.json<{ csrfToken: string }>().csrfToken } }
  const a = await jar(), b = await jar(), limits = new HostedLimits(api.store, loadConfig())
  const principal = (j: Record<string, string>) => limits.session(j.Cookie.split('=')[1]).principal
  /** A finished anchored decline owned by this visitor, registered with the gateway the way POST /runs does. */
  const seed = (j: Record<string, string>, question = QUESTION) => {
    const p = principal(j), id = declinedRun(api.store, { principal: p, question })
    api.store.hostedState(db => db.prepare("INSERT INTO hosted_holds (id,principal,request_key,question,ip,day,created,minor,run_id,state) VALUES (?,?,?,?,?,?,?,?,?,'done')").run(randomUUID(), p, randomUUID(), sha(question), '', '2026-11-12', Date.now(), 0, id))
    return id
  }
  return { url, a, b, seed, api, principal }
}

it('hosted: two sessions are isolated, a public link needs no session, and shares are capped', async () => {
  const { url, a, b, seed, principal, api } = await hosted()
  const own = seed(a), foreign = seed(b, 'Visitor B asks something private about their own business plan')
  // A foreign session can neither read, create nor learn anything about someone else's proof.
  for (const [method, path] of [['GET', `/api/runs/${own}/proof`], ['POST', `/api/runs/${own}/proof`]] as const) {
    const r = await wire(url + path, method, b); expect(r.status, `${method} ${path}`).toBe(404); expect(r.json()).toEqual({ error: 'Not found.' })
  }
  expect((await wire(url + `/api/runs/${own}/proof`, 'POST', { ...a, 'X-CSRF-Token': 'wrong' })).status).toBe(403)
  expect((await wire(url + `/api/runs/${own}/proof`, 'POST', { Host: 'demo.example' })).status).toBe(403) // no session, no CSRF
  const before = await wire(url + `/api/runs/${own}/proof`, 'GET', a)
  expect(before.json()).toEqual({ eligible: true })
  const created = await wire(url + `/api/runs/${own}/proof`, 'POST', a)
  expect(created.status).toBe(201)
  const { id, path } = created.json<{ proof: { id: string; path: string } }>().proof
  expect(path).toBe(`/proof/${id}`)
  expect(id).toMatch(/^[a-f0-9]{32}$/)
  const again = await wire(url + `/api/runs/${own}/proof`, 'POST', a)
  expect(again.status).toBe(200); expect(again.json<{ proof: { id: string } }>().proof.id).toBe(id)
  expect((await wire(url + `/api/runs/${own}/proof`, 'GET', a)).json<{ proof: { id: string } }>().proof.id).toBe(id)
  // The public page: no cookie, no session minted, no Set-Cookie, strict headers, nothing from the other visitor.
  const sessions = () => api.store.hostedState(db => Number(db.prepare('SELECT count(*) AS n FROM hosted_sessions').get()!.n))
  const known = sessions()
  const page = await wire(url + `/proof/${id}`)
  expect(page.status).toBe(200)
  expect(sessions()).toBe(known)
  expect(page.headers['set-cookie']).toBeUndefined()
  expect(page.headers['content-type']).toMatch(/text\/html/)
  expect(page.headers['content-security-policy']).toMatch(/default-src 'none'.*script-src 'self' 'nonce-/)
  expect(page.headers['x-robots-tag']).toBe('noindex')
  expect(page.text).toContain(QUESTION); expect(page.text).toContain('og:image" content="https://demo.example/og/refusal-proof.png"')
  expect(page.text).not.toContain('Visitor B asks'); expect(page.text).not.toContain(principal(a)); expect(page.text).not.toContain(principal(b))
  const receipts = await wire(url + `/proof/${id}/receipts.json`)
  expect(receipts.status).toBe(200); expect((await verifyAnswer(receipts.json())).ok).toBe(true)
  expect(receipts.text).not.toContain(principal(b)); expect(receipts.text).not.toContain('visitor B')
  const card = await wire(url + `/proof/${id}/card.html`)
  expect(card.status).toBe(200); expect(card.headers['content-disposition']).toMatch(/^attachment; filename="proof-of-refusal-[a-f0-9]{8}\.html"$/)
  // The same link works for another visitor, but read-only: no writes, no queries, no guessing.
  expect((await wire(url + `/proof/${id}`, 'GET', b)).status).toBe(200)
  expect((await wire(url + `/proof/${id}`, 'POST', b, {})).status).toBe(404)
  expect((await wire(url + `/proof/${id}?x=1`)).status).toBe(404)
  expect((await wire(url + `/proof/${'0'.repeat(32)}`)).status).toBe(404)
  expect((await wire(url + `/proof/${id}/other.json`)).status).toBe(404)
  expect((await wire(url + '/proof/not-an-id')).status).toBe(404)
  // B's own run stays B's: it has no proof until B shares it, and A cannot share it.
  expect((await wire(url + `/api/runs/${foreign}/proof`, 'POST', a)).status).toBe(404)
  expect((await wire(url + `/api/runs/${foreign}/proof`, 'GET', b)).json()).toEqual({ eligible: true })
  // Each session may publish a few proofs a day.
  for (let i = 1; i < 5; i++) expect((await wire(url + `/api/runs/${seed(a, QUESTION + i)}/proof`, 'POST', a)).status).toBe(201)
  const sixth = await wire(url + `/api/runs/${seed(a, QUESTION + 'last')}/proof`, 'POST', a)
  expect(sixth.status).toBe(429); expect(sixth.json()).toMatchObject({ error: 'proof_limit' })
  expect((await wire(url + `/api/runs/${seed(b, QUESTION + 'b2')}/proof`, 'POST', b)).status).toBe(201)
})

it('hosted: public reads are rate limited per address like the writer pages', async () => {
  const { url, a, seed } = await hosted()
  const id = (await wire(url + `/api/runs/${seed(a)}/proof`, 'POST', a)).json<{ proof: { id: string } }>().proof.id
  let last = 0
  for (let i = 0; i < 121; i++) last = (await wire(url + `/proof/${id}`)).status
  expect(last).toBe(429)
})

it('serves /proof/ through every front: Vite, local nginx, hosted nginx, the app server and the desktop shell', () => {
  expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/'\/proof': backend/)
  expect(readFileSync('docker/nginx.conf', 'utf8')).toContain('^/(runs|api|proof)(/|$)')
  expect(readFileSync('docker/hosted/nginx.conf', 'utf8')).toContain('^/(api|runs|w|proof|livez|startupz|readyz)')
  expect(readFileSync('mcp/app.ts', 'utf8')).toContain('/^\\/(?:runs|api|proof)(?:\\/|$)/')
  expect(readFileSync('desktop/main.mjs', 'utf8')).toContain('proof(?:\\/|$)')
})
