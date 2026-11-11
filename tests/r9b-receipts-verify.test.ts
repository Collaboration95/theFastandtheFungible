// R9-B (round-9 mock judges, PR-B): receipts always verify, and paid-no-answer says so.
// - H9-02: a free source without a writer-signed delivery proof is never kept, so an export always verifies with the
//   unchanged verifier (TS CLI and the in-browser panel run the same code), on judge B's own question.
// - H9-03: after a purchase, an answer with no cited claim says what was bought, and the offline writer is labelled
//   with its reason.
// - H9-10: "Still unanswered" never lists what the lead answers. H9-14: the proof chip names how buying was decided.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { once } from 'node:events'
import { readFileSync } from 'node:fs'
import { createServer, request, type Server } from 'node:http'
import { createPublisherApp } from '../publisher/routes.js'
import { Store } from '../server/store.js'
import { PublisherClient } from '../server/publisher-client.js'
import { PurchaseManager } from '../server/purchases.js'
import { RunLoop } from '../server/agents/loop.js'
import { fixturePlan, freezeRequirements } from '../server/agents/scope.js'
import { followUpSearch, retrieve, UNSIGNED_FREE, writeAnswer, fallbackReason } from '../server/agents/research.js'
import { LlmHttpError } from '../server/agents/llm.js'
import { ProviderDeadlineError } from '../server/agents/provider-retry.js'
import { withModelUsage } from '../server/telemetry.js'
import { receiptBundle } from '../server/receipt-bundle.js'
import { verifyAnswer } from '../sdk/verify.js'
import { verifyInBrowser } from '../src/verify/browser.js'
import { proofEnvironmentLabel } from '../server/proof-page.js'
import { paidNoAnswerSummary } from '../shared/decline.js'
import { openGapsAfterLead } from '../shared/open-gaps.js'
import { PublicCandidateSchema, type ContentEnvelope, type PublicCandidate } from '../shared/contracts/index.js'
import type { SearchHit } from '../shared/contracts/manifest.js'

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('H9-02: only signed free sources are kept', () => {
  const hit = (n: number): SearchHit => ({ publisherSlug: 'records', writerSlug: 'records', articleId: `free-${n}`, version: 'v1', title: `Free ${n}`, abstract: 'x', tags: [], tier: 'FREE', priceMinor: 0, url: `/w/records/articles/free-${n}`, relevance: 1 - n / 100, family: `f${n}`, publishedAt: '2026-09-01', searchMode: 'keyword' } as SearchHit)
  // free-1 carries its signed proof (readFree checked it); free-2 is a legacy unsigned read.
  const client = {
    registry: async () => [{ slug: 'records', name: 'Records', kind: 'records' as const }],
    searchPublisher: async () => [hit(1), hit(2)],
    readFree: async (h: SearchHit) => ({ profileId: h.publisherSlug, resourceId: h.articleId, version: h.version, title: h.title, publisher: 'Records', body: `Body ${h.articleId}`, spans: [{ id: 'p1', text: `Body ${h.articleId}` }], ...(h.articleId === 'free-1' ? { verification: { manifest: {}, salts: [] } } : {}) }),
  } as unknown as PublisherClient
  it('drops an unsigned free read like a failed read: not read, not listed, reported', async () => {
    const found = await retrieve(client, 'q')
    expect(found.contents.map(c => c.resourceId)).toEqual(['free-1'])
    expect(found.candidates.map(c => c.resourceId)).toEqual(['free-1'])
    expect(found.dropped).toEqual([{ publisherSlug: 'records', resourceId: 'free-2', reason: UNSIGNED_FREE }])
  })
  it('the focused follow-up search keeps the same rule', async () => {
    const found = await followUpSearch(client, 'q', [])
    expect(found.contents.map(c => c.resourceId)).toEqual(['free-1'])
    expect(found.candidates.map(c => c.resourceId)).toEqual(['free-1'])
    expect(found.dropped.map(d => d.reason)).toEqual([UNSIGNED_FREE])
  })
})

// Judge B's D4 on the real writer server, served the way the hosted demo served it on 11 Nov: Open Records had no signing
// seed on the VM, so its free articles arrived without a delivery proof, and "Verify on XRPL" failed 6 of 34 checks. The
// sub-query is one a live planner writes for this question; it reads the same two free sources the VM did.
describe('H9-02: judge B\'s question exports receipts that verify, with Open Records unsigned', () => {
  const D4 = 'If my agent pays for an article and the writer never reveals the key, what happens to my money?'
  let app: ReturnType<typeof createPublisherApp>, writer: Server, proxy: Server, store: Store, loop: RunLoop
  const stripped = new Set<string>()
  beforeAll(async () => {
    app = createPublisherApp({ journal: ':memory:', rail: 'simulated', env: {} })
    await app.locals.ready; await app.locals.writersReady
    writer = app.listen(0, '127.0.0.1'); await once(writer, 'listening')
    const port = (writer.address() as { port: number }).port
    proxy = createServer((req, res) => {
      const headers = { ...req.headers }; delete headers['accept-encoding']
      const upstream = request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers }, up => {
        if (!(req.method === 'GET' && up.statusCode === 200 && req.url?.startsWith('/w/open-records/articles/'))) { res.writeHead(up.statusCode!, up.headers); up.pipe(res); return }
        let text = ''; up.setEncoding('utf8'); up.on('data', c => text += c)
        up.on('end', () => {
          const article = JSON.parse(text) as { tier?: string; verification?: unknown; articleId?: string }
          if (article.tier === 'FREE' && article.verification) { delete article.verification; stripped.add(article.articleId!) }
          const body = JSON.stringify(article)
          res.writeHead(200, { ...up.headers, 'content-length': String(Buffer.byteLength(body)) }); res.end(body)
        })
      })
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
      req.pipe(upstream)
    })
    proxy.listen(0, '127.0.0.1'); await once(proxy, 'listening')
    store = new Store(':memory:')
    const client = new PublisherClient({ baseUrl: `http://127.0.0.1:${(proxy.address() as { port: number }).port}` })
    loop = new RunLoop(store, client, new PurchaseManager(store, client))
  })
  afterAll(async () => {
    store?.close()
    for (const server of [proxy, writer]) if (server) { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())) }
    app?.locals.journal.close()
  })
  it('reads the unsigned records, keeps none of them, and every check passes in the TS verifier and the browser panel', async () => {
    const run = store.createRun(D4, 200), base = fixturePlan(D4), plan = { ...base, subqueries: [...base.subqueries, 'prepayment refund if the seller never delivers'] }
    store.updateRun(run.runId, { checkpoint: { plan, ...freezeRequirements(D4, plan) } })
    await loop.start(run.runId)
    const done = store.getRun(run.runId)
    expect(done.phase).toBe('DONE')
    expect([...stripped]).toContain('or-wafer-capacity-prepayment-explainer')
    expect(done.contents.some(c => c.profileId === 'open-records')).toBe(false)
    expect(done.candidates.some(c => c.profileId === 'open-records' && c.tier === 'FREE')).toBe(false)
    // The signed fictional free source the VM also read stays, with its proof.
    expect(done.contents.some(c => c.profileId === 'load-factor')).toBe(true)
    const bundle = receiptBundle(store, run.runId)
    expect(bundle.sources.every(s => bundle.proofs.some(p => p.resourceId === s.resourceId && p.version === s.version))).toBe(true)
    const offline = await verifyAnswer(bundle)
    expect(offline.checks.filter(c => c.status === 'FAIL')).toEqual([])
    expect(offline.ok).toBe(true)
    // The in-browser panel: the same verifier with the ledger online. A simulated run has nothing on a ledger, so no lookup.
    const ledger = { request: vi.fn(async () => { throw Error('no ledger lookup expected for a simulated run') }), endpoint: () => 'none', close: () => undefined }
    const browser = await verifyInBrowser(bundle, ledger as never)
    expect(browser.checks.filter(c => c.status === 'FAIL')).toEqual([])
    expect(browser.ok).toBe(true)
    expect(ledger.request).not.toHaveBeenCalled()
    // The verifier was not loosened: put an unsigned free source back in the bundle and it fails, as it did on 11 Nov.
    const unsigned: ContentEnvelope = { profileId: 'open-records', resourceId: 'or-wafer-capacity-prepayment-explainer', version: 'v1', title: 'Wafer capacity prepayment', publisher: 'Open Records', body: 'Unsigned text.', spans: [{ id: 'p1', text: 'Unsigned text.' }] }
    const tampered = { ...bundle, sources: [...bundle.sources, unsigned], candidates: [...bundle.candidates, PublicCandidateSchema.parse({ profileId: 'open-records', resourceId: unsigned.resourceId, version: 'v1', title: unsigned.title, publisher: 'Open Records', preview: 'x', price: { amountMinor: 0, currency: 'SGD' }, family: 'f', facets: [], authority: 2, tier: 'FREE', license: { kind: 'SYNTHETIC', attribution: 'Open Records' }, publisherSlug: 'open-records', writerSlug: 'open-records', url: '/w/open-records/articles/x', relevance: 1 })] }
    const failed = await verifyAnswer(tampered)
    expect(failed.ok).toBe(false)
    expect(failed.checks.filter(c => c.status === 'FAIL').map(c => c.check)).toEqual(expect.arrayContaining([`manifest ${unsigned.resourceId}@v1`, `passages ${unsigned.resourceId}@v1`]))
  }, 120_000)
})

describe('H9-03: a forced writer fallback after a purchase says so', () => {
  const corpus = (id: string) => JSON.parse(readFileSync(`data/corpus/v2/articles/team-xrpl-explainers/${id}.json`, 'utf8')) as { articleId: string; version: string; title: string; body: string; tags: string[]; passages: { id: string; text: string }[] }
  const paid = (id: string): { content: ContentEnvelope; candidate: PublicCandidate } => {
    const a = corpus(id)
    return {
      content: { profileId: 'team-xrpl-explainers', resourceId: a.articleId, version: a.version, title: a.title, publisher: 'XRPL explainers', body: a.body, spans: a.passages.map(p => ({ id: p.id, text: p.text })) },
      candidate: PublicCandidateSchema.parse({ profileId: 'team-xrpl-explainers', resourceId: a.articleId, version: a.version, title: a.title, publisher: 'XRPL explainers', preview: 'x', price: { amountMinor: 40, currency: 'SGD' }, family: a.articleId, facets: a.tags, authority: 1, tier: 'PAID', license: { kind: 'AUTHOR SUPPLIED', attribution: 'XRPL explainers' }, publisherSlug: 'team-xrpl-explainers', writerSlug: 'team-xrpl-explainers', url: `/w/team-xrpl-explainers/articles/${a.articleId}`, relevance: 1 }),
    }
  }
  const live = () => { vi.stubEnv('LLM_PROVIDER', 'groq'); vi.stubEnv('GROQ_API_KEY', 'mock'); vi.stubEnv('LLM_BASE_URL', '') }
  it('judge V\'s C1: the bought article fails the topic guard, so the model is not asked; it says what was bought, with the reason', async () => {
    live()
    const transport = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('the model must not be asked'))
    const { content, candidate } = paid('product-key-reveal-trust')
    const events: Record<string, unknown>[] = []
    const { answer } = await withModelUsage(usage => events.push(usage), () => writeAnswer({ question: 'How does the writer get paid, and what stops the agent from reading the article and then refusing to pay?', contents: [content], candidates: [candidate], version: 2 }))
    expect(transport).not.toHaveBeenCalled()
    expect(answer).toMatchObject({ claims: [], provider: 'fixture', conclusion: 'Bought 1 article; it gave no citable answer to this question.' })
    expect(answer.conclusion).not.toMatch(/nothing bought/i)
    expect(events).toEqual([{ fallback: true, reason: 'guard' }])
  })
  it('a provider error after a purchase is the "http" fallback, and the offline writer still cites the bought passage', async () => {
    live()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('PRIVATE', { status: 401 }))
    const { content, candidate } = paid('product-key-reveal-trust')
    const events: Record<string, unknown>[] = []
    const { answer } = await withModelUsage(usage => events.push(usage), () => writeAnswer({ question: 'What does key-reveal escrow guarantee, and who must refund a bad article?', contents: [content], candidates: [candidate], version: 2 }))
    expect(answer.provider).toBe('fixture')
    expect(answer.claims.length).toBeGreaterThan(0)
    expect(events).toEqual([{ fallback: true, reason: 'http' }])
  })
  it('names each fallback reason', () => {
    expect(fallbackReason(new ProviderDeadlineError('LLM', 45000))).toBe('timeout')
    expect(fallbackReason(new LlmHttpError(503, 0))).toBe('http')
    expect(fallbackReason(Object.assign(Error('question_model_cap'), { code: 'question_model_cap' }))).toBe('cap')
    expect(fallbackReason(new SyntaxError('Unexpected token'))).toBe('invalid')
    expect(fallbackReason(Error('LLM JSON truncated'))).toBe('invalid')
    expect(fallbackReason(Error('LLM returned no stream'))).toBe('unavailable')
  })
  it('counts plainly', () => {
    expect([1, 2, 3].map(paidNoAnswerSummary)).toEqual([
      'Bought 1 article; it gave no citable answer to this question.',
      'Bought 2 articles; neither gave a citable answer to this question.',
      'Bought 3 articles; none gave a citable answer to this question.',
    ])
  })
})

describe('H9-10: open gaps never contradict the lead', () => {
  const lead = (text: string) => [{ text, claim: { id: 'c', text, stance: 'SUPPORTS' as const, citations: [{ resourceId: 'r', version: 'v1', spanId: 'p1' }] } }]
  it('closes a gap that restates the question, or whose fact the lead states; keeps the rest', () => {
    const q = 'How can I stop a prompt-injected AI agent from draining its wallet?'
    expect(openGapsAfterLead(q, { lead: lead('Prompt injection cannot increase spending authorization: the user budget is the only authorization.'), openGaps: [{ text: 'How can I stop a prompt-injected AI agent from draining its wallet?' }, { text: 'Which wallets support multisig recovery' }] }))
      .toEqual([{ text: 'Which wallets support multisig recovery' }])
    const token = 'Which XRPL amendment and issuer flag does token escrow need?'
    expect(openGapsAfterLead(token, { lead: lead('Token escrow needs the TokenEscrow amendment, and the issuer must set the asfAllowTrustLineLocking flag.'), openGaps: [{ text: 'Identify the issuer flag token escrow needs' }] })).toEqual([])
  })
  it('a gap that asks for a quantity stays open until the lead carries a figure', () => {
    const q = 'How much XRP reserve does an agent wallet need?'
    const gaps = [{ text: 'The base XRP reserve amount' }]
    expect(openGapsAfterLead(q, { lead: lead('An XRPL wallet needs a base reserve plus applicable owner reserves.'), openGaps: gaps })).toEqual(gaps)
    expect(openGapsAfterLead(q, { lead: lead('The base reserve is 1 XRP, and each owned object adds an owner reserve of 0.2 XRP.'), openGaps: gaps })).toEqual([])
  })
  it('without a lead nothing is closed', () => {
    expect(openGapsAfterLead('q', { openGaps: [{ text: 'q' }] })).toEqual([{ text: 'q' }])
  })
})

describe('H9-14: the proof chip names how buying was decided, never "fixture models"', () => {
  it('reads the same on every proof, old or new', () => {
    expect(proofEnvironmentLabel({ surface: 'hosted', models: 'fixture' })).toBe('Shared XRPL Testnet demo · rule-based buying · no real value')
    expect(proofEnvironmentLabel({ surface: 'local', models: 'live' })).toBe('XRPL Testnet demo · model-judged buying · no real value')
  })
})
