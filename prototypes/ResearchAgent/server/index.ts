import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client, Wallet, type TxResponse } from 'xrpl'
import { sources, rankSources, QUESTION, CANONICAL_THESIS, AFTER_NORTHSTAR, AFTER_MERIDIAN, GAP_QUESTION, DEFAULT_BUDGET_CENTS, MIN_BUDGET_CENTS, MAX_BUDGET_CENTS, type Run, type Source, type Decision, type Phase, type ResearchConfig, type DossierDraft } from '../src/domain.js'
import { premiumBodies } from './premium-store.js'
import { planPurchase, synthesizeDossier, type DossierEvidencePacket } from './llm.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'data')
const dataFile = join(dataDir, 'runs.json')
const port = Number(process.env.PORT ?? 8788)
const mode = process.env.APP_MODE ?? 'fixture'
const xrplMode = process.env.XRPL_MODE ?? 'fixture'
const xrplNetwork = process.env.XRPL_NETWORK ?? 'testnet'
const xrplRpcUrl = process.env.XRPL_RPC_URL ?? 'wss://s.altnet.rippletest.net:51233'
const xrplExplorerUrl = process.env.XRPL_EXPLORER_URL ?? 'https://testnet.xrpl.org/transactions'
const app = express()
app.use(express.json({ limit: '64kb' }))
app.use((_req, res, next) => { res.setHeader('X-ResearchAgent-Mode', mode); res.setHeader('X-Content-Type-Options', 'nosniff'); next() })

let runs = new Map<string, Run>()
let sourceCatalog: Source[] = sources
type MockArticle = { id: string; publisher: string; siteKey: string; title: string; date: string; kind: Source['kind']; accessTier: Source['accessTier']; priceCents: number; xrpDrops: number; preview: string; article: string; quote: string; tags: string[]; entities: string[]; authority: Source['authority']; originality: Source['originality']; familyId: string; familyLabel: string; relevance: number; gapMatch: number; novelty: number; trustNote: string }
let mockArticles = new Map<string, MockArticle>()
const clients = new Map<string, Set<Response>>()
const now = () => new Date().toISOString()
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)
const BOND_OPEN = 'Long-duration bonds are repricing a mix of fiscal supply, sticky inflation risk, and crowded positioning; the open evidence does not yet separate the dominant cause.'
const BOND_AFTER_PAID = 'The selloff looks primarily like a rates and duration shock, amplified by a higher term premium and thinner marginal demand; contained credit spreads argue against calling it a broad credit liquidation.'
const BOND_GAP = 'Which mechanism is doing the most work: fiscal supply, inflation expectations, term premium, or crowded duration positioning?'
function isBondQuestion(question: string) { return /bond|yield|duration|treasury|rates|term premium|fiscal/i.test(question) }

function makeConfig(input: Partial<ResearchConfig> = {}): ResearchConfig {
  return {
    question: String(input.question ?? QUESTION).trim() || QUESTION,
    decision: String(input.decision ?? 'What decision will this research support?').trim(),
    horizon: String(input.horizon ?? 'Through 2028').trim(),
    tokenLimit: Number.isFinite(Number(input.tokenLimit)) ? Math.max(8000, Math.min(256000, Number(input.tokenLimit))) : 64000,
    budgetCents: Number.isFinite(Number(input.budgetCents)) ? Math.max(MIN_BUDGET_CENTS, Math.min(MAX_BUDGET_CENTS, Math.round(Number(input.budgetCents)))) : DEFAULT_BUDGET_CENTS,
    sourceTypes: Array.isArray(input.sourceTypes) && input.sourceTypes.length ? input.sourceTypes.map(String) : ['primary', 'public', 'independent', 'specialist'],
    sourceAllowlist: Array.isArray(input.sourceAllowlist) ? input.sourceAllowlist.map(String) : ['financial-press', 'wire-services', 'central-banks', 'public-data', 'specialist-research', 'company-filings', 'macro-research', 'infrastructure-press'],
  }
}

async function loadSourceCatalog() {
  try {
    const raw = await readFile(join(dataDir, 'mock-articles.json'), 'utf8')
    const articles = JSON.parse(raw) as MockArticle[]
    mockArticles = new Map(articles.map((article) => [article.id, article]))
    sourceCatalog = articles.map(({ article: _article, quote: _quote, ...source }) => ({ ...source, fixture: true as const }))
  } catch {
    sourceCatalog = sources
  }
}

function sourceIsAllowed(source: Source, config: ResearchConfig) {
  return Boolean(config.sourceAllowlist?.length) && Boolean(source.siteKey) && config.sourceAllowlist!.includes(source.siteKey!)
}

function scopedSources(config: ResearchConfig) {
  return rankSources(config.question, sourceCatalog).filter((source) => config.sourceTypes.includes(sourceType(source)) && sourceIsAllowed(source, config))
}

function quoteFor(run: Run, source: Source) {
  return { protocol: 'x402', x402Version: 2, network: `xrpl-${xrplNetwork}`, invoiceId: `invoice_${run.runId}_${source.id}`, resourceId: `resource_${source.id}`, amountDrops: source.xrpDrops ?? 0, payTo: process.env.XRPL_RECEIVER_ADDRESS ?? 'rFixturePublisherPayee7Q', quoteHash: hash({ runId: run.runId, id: source.id, priceCents: source.priceCents, xrpDrops: source.xrpDrops }) }
}

async function settleLivePayment(source: Source) {
  if (xrplNetwork !== 'testnet') throw new Error('Live XRPL mode is restricted to the Testnet for this demo.')
  const payerSeed = process.env.XRPL_PAYER_SEED
  const payerAddress = process.env.XRPL_PAYER_ADDRESS
  const receiverAddress = process.env.XRPL_RECEIVER_ADDRESS
  if (!payerSeed || !receiverAddress) throw new Error('XRPL live mode requires XRPL_PAYER_SEED and XRPL_RECEIVER_ADDRESS.')
  const wallet = Wallet.fromSeed(payerSeed)
  if (payerAddress && wallet.address !== payerAddress) throw new Error('XRPL_PAYER_ADDRESS does not match the configured payer seed.')
  if (wallet.address === receiverAddress) throw new Error('XRPL payer and receiver must be different accounts.')
  const amountDrops = source.xrpDrops ?? 0
  if (!amountDrops) throw new Error('Source has no XRP quote.')
  const client = new Client(xrplRpcUrl)
  try {
    await client.connect()
    const payment = { TransactionType: 'Payment' as const, Account: wallet.address, Destination: receiverAddress, Amount: String(amountDrops) }
    const result = await client.submitAndWait(payment, { wallet }) as TxResponse
    const envelope = result.result as unknown as Record<string, unknown>
    const tx = (envelope.tx_json ?? {}) as Record<string, unknown>
    const meta = (envelope.meta && typeof envelope.meta === 'object' ? envelope.meta : {}) as Record<string, unknown>
    const transactionResult = meta.TransactionResult ?? envelope.engine_result
    if (envelope.validated !== true || transactionResult !== 'tesSUCCESS') throw new Error('XRPL Testnet payment was not validated successfully.')
    if (tx.Account && tx.Account !== wallet.address) throw new Error('XRPL payer mismatch in validated transaction.')
    if (tx.Destination !== receiverAddress) throw new Error('XRPL destination mismatch in validated transaction.')
    const deliveredAmount = meta.delivered_amount ?? tx.Amount
    if (String(deliveredAmount) !== String(amountDrops)) throw new Error('XRPL delivered amount mismatch in validated transaction.')
    const transactionHash = typeof envelope.hash === 'string' ? envelope.hash : undefined
    if (!transactionHash) throw new Error('XRPL Testnet did not return a transaction hash.')
    const ledgerIndex = typeof envelope.ledger_index === 'number' ? envelope.ledger_index : undefined
    return { mode: 'live' as const, network: 'testnet', amountDrops, transactionHash, ledgerIndex, explorerUrl: `${xrplExplorerUrl}/${transactionHash}`, settlement: 'VALIDATED' }
  } finally {
    await client.disconnect()
  }
}

async function load() { try { const raw = await readFile(dataFile, 'utf8'); const parsed = JSON.parse(raw) as Run[]; runs = new Map(parsed.map((run) => [run.runId, { ...run, config: makeConfig(run.config ?? {}), purchaseKeys: run.purchaseKeys ?? {} }])) } catch { runs = new Map() } }
async function persist() { await mkdir(dataDir, { recursive: true }); await writeFile(dataFile, JSON.stringify([...runs.values()], null, 2)) }
function emit(run: Run, type: string, label: string) { const event = { id: `${run.events.length + 1}`, type, label, at: now() }; run.events.push(event); clients.get(run.runId)?.forEach((res) => res.write(`id: ${event.id}\nevent: ${type}\ndata: ${JSON.stringify(event)}\n\n`)) }
function emitStream(run: Run, type: string, data: Record<string, unknown>) { const event = { id: `stream-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, runId: run.runId, type, ...data }; clients.get(run.runId)?.forEach((res) => res.write(`id: ${event.id}\nevent: ${type}\ndata: ${JSON.stringify(event)}\n\n`)) }
function publicSource(source: Source, run: Run): Source { const purchased = run.sources.find((item) => item.id === source.id); const openSpan = source.accessTier === 'OPEN' && mockArticles.get(source.id) ? [{ id: `${source.id}-open`, label: 'Open article excerpt', text: mockArticles.get(source.id)!.quote }] : undefined; return { ...source, decision: purchased?.decision, reason: purchased?.reason, purchasedAt: purchased?.purchasedAt, evidenceSpans: purchased?.evidenceSpans ?? openSpan } }
function sourceType(source: Source): string { if (source.familyId === 'family-company') return 'primary'; if (source.familyId === 'family-energy' || source.kind === 'DATASET_QUERY') return 'public'; if (source.familyId === 'family-northstar' || source.familyId === 'family-meridian') return 'independent'; return 'specialist' }
function state(run: Run) { return { runId: run.runId, phase: run.phase, paused: run.paused, cancelled: run.cancelled, budgetCents: run.budgetCents, spentCents: run.spentCents, remainingCents: run.budgetCents - run.spentCents, rawSourceCount: run.sources.length, familyCount: new Set(run.sources.map((source) => source.familyId)).size, gap: run.gap, thesis: run.thesis, claims: run.claims, events: run.events, dossierReady: run.dossierReady, dossier: run.dossier, llm: run.llm, semanticStatus: run.semanticStatus, purchasePlan: run.purchasePlan, config: run.config, sources: run.sources.map((source) => publicSource(source, run)) } }
function getRun(req: Request, res: Response) { const run = runs.get(String(req.params.runId)); if (!run) { res.status(404).json({ error: 'Research run not found' }); return null }; return run }
function initRun(input: Partial<ResearchConfig> = {}): Run {
  const config = makeConfig(input)
  const bondQuestion = isBondQuestion(config.question)
  const run: Run = { runId: `run_${randomUUID().slice(0, 8)}`, version: 1, phase: 'DRAFT', paused: false, cancelled: false, budgetCents: config.budgetCents, spentCents: 0, sources: [], events: [], gap: { question: bondQuestion ? BOND_GAP : GAP_QUESTION, importance: 'HIGH', state: 'OPEN' }, thesis: { open: bondQuestion ? BOND_OPEN : CANONICAL_THESIS, current: bondQuestion ? BOND_OPEN : CANONICAL_THESIS }, claims: [], dossierReady: false, llm: { provider: process.env.LLM_PROVIDER ?? 'fixture', status: 'fixture fallback ready', model: process.env.LLM_MODEL ?? 'fixture-research-v1' }, semanticStatus: 'precomputed', config, purchaseKeys: {} };
  emit(run, 'BRIEF_READY', `Brief ready · ${config.tokenLimit.toLocaleString()} token cap`); return run
}
function save(run: Run) { runs.set(run.runId, run); return persist() }
function response(res: Response, run: Run) { return res.json(state(run)) }

app.get('/api/health', (_req, res) => res.json({ ok: true, mode, persistence: 'json-file', llm: process.env.LLM_PROVIDER ?? 'fixture' }))
app.get('/api/v1/config/public', (_req, res) => res.json({ mode, llmProvider: process.env.LLM_PROVIDER ?? 'fixture', semanticRanker: 'precomputed', network: 'fixture', publicAppUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:5173' }))
app.get('/api/v1/scenarios/data-centre-2028', (_req, res) => res.json({ brief: { principal: 'Elena Tan', audience: 'Investment Committee', question: QUESTION, deliverable: 'Evidence-backed one-page dossier', budgetCents: 200, autoBuyMaxPerSourceCents: 100, sourceAboveThreshold: 'BLOCK', horizon: 2028, mode: 'FIXTURE RESEARCH' }, sources: sourceCatalog.map((source) => publicSource(source, { sources: [], spentCents: 0 } as unknown as Run)) }))
app.post('/api/v1/research-runs', async (req, res) => { const run = initRun(req.body ?? {}); await save(run); return response(res.status(201), run) })
app.get('/api/v1/research-runs/:runId', (req, res) => { const run = getRun(req, res); return run ? response(res, run) : undefined })
app.get('/api/v1/research-runs/:runId/sources', (req, res) => { const run = getRun(req, res); return run ? res.json(run.sources.map((source) => publicSource(source, run))) : undefined })
app.get('/api/v1/research-runs/:runId/sources/:sourceId', (req, res) => { const run = getRun(req, res); if (!run) return; const source = run.sources.find((item) => item.id === req.params.sourceId); if (!source) return res.status(404).json({ error: 'Source is outside this run scope' }); const visible = publicSource(source, run); if (source.accessTier === 'PREMIUM' && visible.decision !== 'BUY') return res.json({ ...visible, premium: { status: 'PAYMENT_REQUIRED', ...quoteFor(run, source) } }); return res.json({ ...visible, premium: source.accessTier === 'PREMIUM' ? { status: 'UNLOCKED', contentHash: hash(premiumBodies[source.id] ?? mockArticles.get(source.id)?.article), ...quoteFor(run, source) } : { status: 'OPEN' } }) })
app.post('/api/v1/research-runs/:runId/reset', async (req, res) => { const run = getRun(req, res); if (!run) return; const fresh = initRun(); fresh.runId = run.runId; fresh.events = [...run.events]; emit(fresh, 'RESEARCH_RESET', 'Fixture research reset; external evidence is preserved'); await save(fresh); return response(res, fresh) })
app.post('/api/v1/research-runs/:runId/cancel', async (req, res) => { const run = getRun(req, res); if (!run) return; run.cancelled = true; run.phase = 'CANCELLED'; emit(run, 'RESEARCH_CANCELLED', 'Research paused with completed purchases preserved'); await save(run); return response(res, run) })
app.post('/api/v1/research-runs/:runId/plan', async (req, res) => advance(req, res, 'plan'))
app.post('/api/v1/research-runs/:runId/discover', async (req, res) => advance(req, res, 'discover'))
app.post('/api/v1/research-runs/:runId/rank', async (req, res) => advance(req, res, 'rank'))
app.post('/api/v1/research-runs/:runId/gaps', async (req, res) => advance(req, res, 'gaps'))
app.post('/api/v1/research-runs/:runId/step', async (req, res) => { const action = String(req.body?.action ?? 'next'); return advance(req, res, action) })

async function advance(req: Request, res: Response, action: string) {
  const run = getRun(req, res); if (!run) return
  if (run.paused && action !== 'resume') return res.status(409).json({ error: 'Research is paused', state: 'PAUSED' })
  if (action === 'pause') { run.paused = true; emit(run, 'RESEARCH_PAUSED', 'Research paused; no decisions changed'); await save(run); return response(res, run) }
  if (action === 'resume') { run.paused = false; emit(run, 'RESEARCH_RESUMED', 'Research resumed from the last verified stage'); await save(run); return response(res, run) }
  if (action === 'run' || action === 'next') {
    if (run.phase === 'DRAFT') { run.phase = 'PLANNING'; emit(run, 'PLAN_CREATED', 'Query plan: demand, delivery constraints, and independent corroboration'); }
    else if (run.phase === 'PLANNING') { run.phase = 'DISCOVERING'; run.sources = scopedSources(run.config).map((source) => ({ ...source })); emit(run, 'SOURCES_DISCOVERED', `${run.sources.length} mock search previews found within the selected website allowlist`); }
    else if (run.phase === 'DISCOVERING') { run.phase = 'RANKING'; emit(run, 'SOURCES_RANKED', 'Deterministic relevance + TF-IDF lexical overlap + tags applied'); }
    else if (run.phase === 'RANKING') { run.phase = 'READING_OPEN'; emit(run, 'OPEN_EVIDENCE_READ', 'Open evidence read; premium bodies remain protected'); }
    else if (run.phase === 'READING_OPEN') { run.phase = 'GAP_ANALYSIS'; run.gap.state = 'OPEN'; emit(run, 'GAP_FOUND', isBondQuestion(run.config.question) ? `Open gap: ${BOND_GAP}` : 'Open gap: grid connection lead times and operating capacity by 2028'); }
    else if (run.phase === 'GAP_ANALYSIS') { run.phase = 'PURCHASE_PLANNING'; emit(run, 'PURCHASE_PLAN_READY', 'Marginal-value plan prepared; price is separate from relevance'); }
    else if (run.phase === 'SYNTHESIZING') { run.phase = 'DOSSIER_READY'; run.dossierReady = true; emit(run, 'DOSSIER_READY', 'Source-linked dossier verified and ready to read'); }
  }
  if (action === 'synthesize') { await synthesizeRun(run); return response(res, run) }
  await save(run); return response(res, run)
}

function buildClaims(run: Run): Source[] extends never[] ? never : Run['claims'] {
  if (isBondQuestion(run.config.question)) {
    const paidIds = new Set(run.sources.filter((source) => source.decision === 'BUY').map((source) => source.id))
    const hasRates = ['treasury-volatility', 'term-premium-desk', 'fiscal-monitor'].some((id) => paidIds.has(id))
    const hasCredit = run.sources.some((source) => source.id === 'credit-spread-watch' && source.decision === 'BUY')
    const rateSources = paidIds.has('term-premium-desk') ? ['term-premium-desk'] : paidIds.has('treasury-volatility') ? ['treasury-volatility'] : ['fiscal-monitor', 'central-bank-minutes']
    const creditSources = hasCredit ? ['credit-spread-watch'] : ['central-bank-minutes']
    const positionSources = paidIds.has('auction-absorption') ? ['auction-absorption'] : ['duration-allocator']
    return [
      { id:'claim-bond-driver', text: hasRates ? 'The selloff is best explained by a rates and duration repricing that combines fiscal supply, sticky inflation risk, and a higher term premium.' : 'Open evidence points to a combined fiscal-supply, inflation, and duration-positioning shock rather than one isolated catalyst.', stance:'CHALLENGES', materiality:'MATERIAL', sourceIds:rateSources, familyCount:rateSources.length, spanIds:rateSources },
      { id:'claim-credit-check', text: hasCredit ? 'Contained corporate spreads suggest the episode is primarily a rates shock, not a generalized credit liquidation.' : 'Corporate-credit confirmation remains the most useful missing cross-check for whether this is a rates shock or a broader risk-off event.', stance: hasCredit ? 'SUPPORTS' : 'UNCERTAIN', materiality:'MATERIAL', sourceIds:creditSources, familyCount:1, spanIds:creditSources },
      { id:'claim-positioning', text: 'Crowded duration and thinner marginal auction demand can amplify a modest yield repricing into a nonlinear move.', stance:'CHALLENGES', materiality:'MATERIAL', sourceIds:positionSources, familyCount:1, spanIds:positionSources },
    ]
  }
  const hasN = run.sources.some((source) => source.id === 'northstar-wire' && source.decision === 'BUY'); const hasM = run.sources.some((source) => source.id === 'meridian-ledger' && source.decision === 'BUY')
  return [
    { id:'claim-demand', text:'Announced demand and capital commitments support continued expansion.', stance:'SUPPORTS', materiality:'MATERIAL', sourceIds:['company-capex','energy-dataset'], familyCount:2, spanIds:['company-capex-open','energy-dataset-open'] },
    { id:'claim-bottleneck', text: hasN ? 'Supplier lead times add a near-term delivery bottleneck.' : 'Equipment delivery remains a relevant but incompletely evidenced constraint.', stance:'CHALLENGES', materiality:'MATERIAL', sourceIds: hasN ? ['northstar-wire'] : ['energy-dataset'], familyCount:1, spanIds: hasN ? ['northstar-s1'] : ['energy-dataset-open'] },
    { id:'claim-grid', text: hasM ? 'Interconnection and power availability can make operating capacity lag announced spending in grid-constrained markets.' : 'Power delivery is the key unresolved gap in the open-source baseline.', stance: hasM ? 'CHALLENGES' : 'UNCERTAIN', materiality:'MATERIAL', sourceIds: hasM ? ['meridian-ledger'] : ['energy-dataset'], familyCount:1, spanIds: hasM ? ['meridian-s1','meridian-s2'] : ['energy-dataset-open'] },
  ]
}

function evidencePacket(run: Run): DossierEvidencePacket {
  return {
    question: run.config.question,
    decision: run.config.decision,
    horizon: run.config.horizon,
    budgetCents: run.budgetCents,
    spentCents: run.spentCents,
    remainingCents: run.budgetCents - run.spentCents,
    activeGap: run.gap.question,
    thesis: run.thesis,
    purchasePlan: run.purchasePlan,
    sources: run.sources.map((source) => ({
      id: source.id,
      publisher: source.publisher,
      title: source.title,
      accessTier: source.accessTier,
      priceCents: source.priceCents,
      preview: source.preview,
      family: source.familyLabel,
      authority: source.authority,
      originality: source.originality,
      decision: source.decision,
      reason: source.reason,
      evidenceSpans: source.evidenceSpans ?? (source.accessTier === 'OPEN' && mockArticles.get(source.id) ? [{ id: `${source.id}-open`, label: 'Open article excerpt', text: mockArticles.get(source.id)!.quote }] : undefined),
    })),
  }
}

function fixtureDossier(run: Run): DossierDraft {
  const bondQuestion = isBondQuestion(run.config.question)
  return {
    mode: 'FIXTURE RESEARCH',
    title: bondQuestion ? 'The bond selloff is a duration shock with a fiscal amplifier.' : 'The boom can continue. The grid sets the pace.',
    conclusion: run.thesis.current,
    afterLabel: bondQuestion ? '+ paid rates evidence' : '+ Grid report',
    changedAfterPaidResearch: run.thesis.afterMeridian && !bondQuestion ? { before: run.thesis.open, afterNorthstar: run.thesis.afterNorthstar, after: run.thesis.afterMeridian } : { before: run.thesis.open, after: run.thesis.current },
    claims: buildClaims(run),
    uncertainty: run.gap.state === 'RESOLVED' ? (bondQuestion ? 'The relative contribution of term premium and future fiscal issuance remains model-dependent; a live flow dataset would be the next useful check.' : 'GridScope Asia remains desirable for regional queue benchmarks but was blocked by the S$1.00 per-source mandate ceiling.') : run.gap.question,
    method: 'Deterministic retrieval, evidence-family clustering, budget utility heuristic, and fixture synthesis. This is a research demonstration, not investment advice.',
    provider: 'fixture',
    model: 'fixture-research-v1',
    status: 'FALLBACK',
  }
}

function validateDossier(run: Run, draft: Awaited<ReturnType<typeof synthesizeDossier>>): DossierDraft {
  const sourceIds = new Set(run.sources.map((source) => source.id))
  const spanIds = new Set(run.sources.flatMap((source) => {
    const spans = source.evidenceSpans ?? (source.accessTier === 'OPEN' && mockArticles.get(source.id) ? [{ id: `${source.id}-open` }] : [])
    return spans.map((span) => span.id)
  }))
  for (const claim of draft.claims) {
    if (claim.sourceIds.some((id) => !sourceIds.has(id))) throw new Error(`Groq cited an unknown source: ${claim.sourceIds.join(', ')}`)
    if (claim.spanIds.some((id) => !spanIds.has(id))) throw new Error(`Groq cited an unknown evidence span: ${claim.spanIds.join(', ')}`)
  }
  return {
    ...draft,
    claims: draft.claims.map((claim) => ({ ...claim, familyCount: new Set(claim.sourceIds.map((id) => run.sources.find((source) => source.id === id)?.familyId)).size })),
    mode: 'GROQ RESEARCH',
    afterLabel: isBondQuestion(run.config.question) ? '+ paid rates evidence' : '+ Grid report',
    changedAfterPaidResearch: { ...draft.changedAfterPaidResearch, before: run.thesis.open },
    provider: 'groq',
    model: process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile',
    status: 'LIVE',
  }
}

async function synthesizeRun(run: Run) {
  run.phase = 'SYNTHESIZING'
  run.dossierReady = false
  run.gap.state = run.sources.some((source) => source.id === 'meridian-ledger' && source.decision === 'BUY') ? 'RESOLVED' : 'PARTIAL'
  emit(run, 'DOSSIER_SYNTHESIS_STARTED', 'Groq is drafting a cited dossier from the accessible evidence packet')
  await save(run)
  try {
    const draft = await synthesizeDossier(evidencePacket(run), (delta) => emitStream(run, 'DOSSIER_TOKEN', { delta }))
    run.dossier = validateDossier(run, draft)
    run.claims = run.dossier.claims
    run.thesis.current = run.dossier.conclusion
    run.llm = { provider: 'groq', status: 'Groq streamed and validated dossier', model: run.dossier.model }
    emit(run, 'DOSSIER_SYNTHESIS_COMPLETED', 'Groq dossier stream complete; citations and evidence spans validated')
  } catch (error) {
    console.error(`Groq dossier synthesis fallback: ${(error as Error).message}`)
    run.dossier = fixtureDossier(run)
    run.claims = run.dossier.claims
    run.llm = { provider: 'fixture', status: 'Groq synthesis fallback used', model: 'fixture-research-v1' }
    emit(run, 'DOSSIER_SYNTHESIS_FALLBACK', 'Groq synthesis was unavailable; deterministic cited fallback used')
  }
  await save(run)
}

app.post('/api/v1/research-runs/:runId/purchase-decisions', async (req, res) => { const run = getRun(req, res); if (!run) return; const ranked = run.sources.length ? run.sources : scopedSources(run.config); const remainingCents = run.budgetCents - run.spentCents; const action = await planPurchase(run.config.question, ranked, remainingCents); run.purchasePlan = action; run.llm = { provider: action.provider, status: action.status === 'LIVE' ? 'Groq evaluated retrieved metadata' : 'Fixture fallback used', model: action.model }; emit(run, 'AGENT_ACTION_READY', `${action.provider === 'groq' ? 'Groq' : 'Fixture'} chose a purchase action from mock retrieval metadata`); await save(run); return res.json({ formula: 'utility-v1', remainingCents, action, state: state(run), decisions: ranked.filter((source) => source.accessTier === 'PREMIUM').map((source) => ({ sourceId: source.id, expectedEvidenceValue: source.relevance / 100, utilityPerCent: source.priceCents ? (source.relevance / source.priceCents).toFixed(3) : '0', suggestedAction: source.id === 'circuit-note' ? 'SKIP' : source.priceCents > remainingCents || source.priceCents > 100 ? 'BLOCKED' : 'BUY', reason: source.id === 'circuit-note' ? 'Redundant evidence family.' : source.priceCents > 100 ? 'Blocked: exceeds the S$1.00 per-source mandate ceiling.' : 'Expected to resolve or materially narrow the active research gap.' })) }) })
app.post('/api/v1/research-runs/:runId/purchases', async (req, res) => { const run = getRun(req, res); if (!run) return; const source = run.sources.find((item) => item.id === req.body?.sourceId); if (!source) return res.status(404).json({ error: 'Source is outside this run scope' }); const action = String(req.body?.action ?? 'BUY') as Decision; const idempotencyKey = String(req.body?.idempotencyKey ?? ''); const remaining = run.budgetCents - run.spentCents
  if (source.accessTier !== 'PREMIUM') return res.status(400).json({ error: 'Open evidence does not require a purchase' })
  if (idempotencyKey && run.purchaseKeys?.[idempotencyKey]) return response(res, run)
  if (source.decision === 'BUY') return response(res, run)
  if (action === 'SKIP' || source.id === 'circuit-note') { const current = run.sources.find((item) => item.id === source.id); if (current) { current.decision = 'SKIP'; current.reason = 'Skipped because it repeats Northstar Wire; no new independent family.' } emit(run, 'SOURCE_SKIPPED', 'Circuit Note skipped · redundant with Northstar Wire'); await save(run); return response(res, run) }
  if (source.priceCents > 100 || source.priceCents > remaining) { const current = run.sources.find((item) => item.id === source.id); if (current) { current.decision = 'BLOCKED'; current.reason = `Blocked: S$${(source.priceCents/100).toFixed(2)} exceeds the remaining S$${(remaining/100).toFixed(2)}.` } emit(run, 'PURCHASE_BLOCKED', `${source.publisher} blocked by deterministic budget guard`); await save(run); return response(res, run) }
  if (action !== 'BUY') return res.status(400).json({ error: 'Unsupported purchase action' })
  let payment: Source['payment'] = { mode: 'fixture', network: 'testnet', amountDrops: source.xrpDrops ?? 0, settlement: 'SIMULATION_NOT_SETTLED' }
  if (xrplMode === 'live') {
    try {
      payment = await settleLivePayment(source)
    } catch (error) {
      return res.status(502).json({ error: `XRPL Testnet payment failed: ${(error as Error).message}` })
    }
  }
  const current = run.sources.find((item) => item.id === source.id); if (current) { current.decision = 'BUY'; current.reason = source.id === 'northstar-wire' ? 'Bought for independent supplier reporting and marginal delivery evidence.' : 'Bought because the article adds material evidence to the active gap.'; current.purchasedAt = now(); current.evidenceSpans = premiumBodies[source.id]?.spans ?? (mockArticles.get(source.id) ? [{ id: `${source.id}-quote`, label: 'Mock article excerpt', text: mockArticles.get(source.id)!.quote }] : undefined); current.payment = payment }
  run.spentCents += source.priceCents; run.phase = 'PURCHASED'; if (idempotencyKey) run.purchaseKeys = { ...(run.purchaseKeys ?? {}), [idempotencyKey]: source.id }; if (source.id === 'northstar-wire') run.thesis.afterNorthstar = `${run.thesis.open} ${AFTER_NORTHSTAR}`; if (source.id === 'meridian-ledger') { run.thesis.afterMeridian = AFTER_MERIDIAN; run.thesis.current = AFTER_MERIDIAN; run.gap.state = 'RESOLVED' }
  if (isBondQuestion(run.config.question)) { run.thesis.current = BOND_AFTER_PAID; if (source.id === 'term-premium-desk' || source.id === 'treasury-volatility' || source.id === 'credit-spread-watch') run.gap.state = 'RESOLVED' }
  emit(run, 'PREMIUM_PURCHASE_SETTLED', `${source.publisher} unlocked via x402 ${payment.mode} payment · ${source.xrpDrops?.toLocaleString() ?? '—'} drops`); await save(run); return response(res, run)
})
app.get('/api/v1/research-runs/:runId/purchases/:purchaseId', (req, res) => { const run = getRun(req, res); if (!run) return; const source = run.sources.find((item) => item.id === req.params.purchaseId); if (!source) return res.status(404).json({ error: 'Purchase not found' }); const live = source.payment?.mode === 'live'; res.json({ purchaseId: req.params.purchaseId, settlement: source.payment?.settlement ?? 'NONE', label: live ? 'XRPL TESTNET PAYMENT' : 'FIXTURE PAYMENT · NOT A REAL PUBLISHER PAYMENT', invoiceId: `invoice_${run.runId}_${req.params.purchaseId}`, exactResource: source.decision === 'BUY' ? source.id : null, delivery: source.decision === 'BUY' ? 'SEPARATE_ACCESS_GRANT' : 'NOT_DELIVERED', transactionHash: source.payment?.transactionHash, ledgerIndex: source.payment?.ledgerIndex, explorerUrl: source.payment?.explorerUrl }) })
app.post('/api/v1/research-runs/:runId/synthesize', async (req, res) => advance(req, res, 'synthesize'))
app.get('/api/v1/research-runs/:runId/dossier', (req, res) => { const run = getRun(req, res); if (!run) return; if (!run.dossierReady) return res.status(409).json({ error: 'Dossier is not ready' }); const dossier = run.dossier ?? fixtureDossier(run); res.json({ ...dossier, sourceLedger: run.sources.filter((source) => source.accessTier === 'PREMIUM').map((source) => ({ publisher: source.publisher, priceCents: source.priceCents, decision: source.decision ?? 'PENDING', family: source.familyLabel, authority: source.authority, originality: source.originality, access: source.decision === 'BUY' ? 'UNLOCKED' : 'PREVIEW_ONLY' })) }) })
app.get('/api/v1/research-runs/:runId/receipt', (req, res) => { const run = getRun(req, res); if (!run) return; const live = xrplMode === 'live'; res.json({ runId: run.runId, mode: live ? 'XRPL TESTNET RESEARCH' : 'FIXTURE RESEARCH', spend: { spentCents: run.spentCents, remainingCents: run.budgetCents - run.spentCents }, paymentProtocol: { name: 'x402', network: `xrpl-${xrplNetwork}`, payTo: process.env.XRPL_RECEIVER_ADDRESS ?? 'rFixturePublisherPayee7Q', settlement: live ? 'VALIDATED' : 'SIMULATION_NOT_SETTLED', note: live ? 'Testnet XRP payment submitted and validated on the XRPL Testnet.' : 'Fixture quotes model the payment boundary; no wallet seed or real publisher payment is used.' }, purchases: run.sources.filter((source) => source.decision).map((source) => ({ sourceId: source.id, publisher: source.publisher, decision: source.decision, amountCents: source.decision === 'BUY' ? source.priceCents : 0, amountDrops: source.decision === 'BUY' ? source.xrpDrops ?? 0 : 0, invoiceId: `fixture_${run.runId}_${source.id}`, resourceId: `resource_${source.id}`, settlement: source.payment?.settlement ?? (source.decision === 'BUY' ? 'SIMULATION_NOT_SETTLED' : 'NONE'), transactionHash: source.payment?.transactionHash, ledgerIndex: source.payment?.ledgerIndex, explorerUrl: source.payment?.explorerUrl })), limitations: live ? ['Testnet XRP has no S$ equivalence.', 'This dossier is not investment advice.'] : ['Fixture payment did not pay a real publisher.', 'Premium text is synthetic and fictional.', 'Testnet XRP has no S$ equivalence.', 'This dossier is not investment advice.'] }) })
app.get('/api/v1/research-runs/:runId/stream', (req, res) => { const run = getRun(req, res); if (!run) return; res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache'); res.setHeader('Connection','keep-alive'); res.flushHeaders?.(); clients.set(run.runId, clients.get(run.runId) ?? new Set()); clients.get(run.runId)!.add(res); res.write(`event: connected\ndata: ${JSON.stringify({ runId: run.runId })}\n\n`); req.on('close', () => clients.get(run.runId)?.delete(res)) })

await loadSourceCatalog()
await load()
app.listen(port, () => console.log(`ResearchAgent API listening on http://localhost:${port} · mode=${mode} · persistence=${dataFile}`))
