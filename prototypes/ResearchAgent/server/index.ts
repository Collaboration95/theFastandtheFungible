import express, { type Request, type Response } from 'express'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sources, rankSources, QUESTION, CANONICAL_THESIS, AFTER_NORTHSTAR, AFTER_MERIDIAN, GAP_QUESTION, type Run, type Source, type Decision, type Phase } from '../src/domain.js'
import { premiumBodies } from './premium-store.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'data')
const dataFile = join(dataDir, 'runs.json')
const port = Number(process.env.PORT ?? 8788)
const mode = process.env.APP_MODE ?? 'fixture'
const app = express()
app.use(express.json({ limit: '64kb' }))
app.use((_req, res, next) => { res.setHeader('X-ResearchAgent-Mode', mode); res.setHeader('X-Content-Type-Options', 'nosniff'); next() })

let runs = new Map<string, Run>()
const clients = new Map<string, Set<Response>>()
const now = () => new Date().toISOString()
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)

async function load() { try { const raw = await readFile(dataFile, 'utf8'); const parsed = JSON.parse(raw) as Run[]; runs = new Map(parsed.map((run) => [run.runId, run])) } catch { runs = new Map() } }
async function persist() { await mkdir(dataDir, { recursive: true }); await writeFile(dataFile, JSON.stringify([...runs.values()], null, 2)) }
function emit(run: Run, type: string, label: string) { const event = { id: `${run.events.length + 1}`, type, label, at: now() }; run.events.push(event); clients.get(run.runId)?.forEach((res) => res.write(`id: ${event.id}\nevent: ${type}\ndata: ${JSON.stringify(event)}\n\n`)) }
function publicSource(source: Source, run: Run): Source { const purchased = run.sources.find((item) => item.id === source.id); return { ...source, decision: purchased?.decision, reason: purchased?.reason, purchasedAt: purchased?.purchasedAt, evidenceSpans: purchased?.evidenceSpans } }
function state(run: Run) { return { runId: run.runId, phase: run.phase, paused: run.paused, cancelled: run.cancelled, budgetCents: run.budgetCents, spentCents: run.spentCents, remainingCents: run.budgetCents - run.spentCents, rawSourceCount: run.sources.length, familyCount: new Set(run.sources.map((source) => source.familyId)).size, gap: run.gap, thesis: run.thesis, claims: run.claims, events: run.events, dossierReady: run.dossierReady, llm: run.llm, semanticStatus: run.semanticStatus, sources: run.sources.map((source) => publicSource(source, run)) } }
function getRun(req: Request, res: Response) { const run = runs.get(String(req.params.runId)); if (!run) { res.status(404).json({ error: 'Research run not found' }); return null }; return run }
function initRun(): Run { const run: Run = { runId: `run_${randomUUID().slice(0, 8)}`, version: 1, phase: 'DRAFT', paused: false, cancelled: false, budgetCents: 200, spentCents: 0, sources: [], events: [], gap: { question: GAP_QUESTION, importance: 'HIGH', state: 'OPEN' }, thesis: { open: CANONICAL_THESIS, current: CANONICAL_THESIS }, claims: [], dossierReady: false, llm: { provider: process.env.LLM_PROVIDER ?? 'fixture', status: 'fixture fallback ready', model: process.env.LLM_MODEL ?? 'fixture-research-v1' }, semanticStatus: 'precomputed' }; emit(run, 'BRIEF_READY', 'Brief loaded for Elena Tan'); return run }
function save(run: Run) { runs.set(run.runId, run); return persist() }
function response(res: Response, run: Run) { return res.json(state(run)) }

app.get('/api/health', (_req, res) => res.json({ ok: true, mode, persistence: 'json-file', llm: process.env.LLM_PROVIDER ?? 'fixture' }))
app.get('/api/v1/config/public', (_req, res) => res.json({ mode, llmProvider: process.env.LLM_PROVIDER ?? 'fixture', semanticRanker: 'precomputed', network: 'fixture', publicAppUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:5173' }))
app.get('/api/v1/scenarios/data-centre-2028', (_req, res) => res.json({ brief: { principal: 'Elena Tan', audience: 'Investment Committee', question: QUESTION, deliverable: 'Evidence-backed one-page dossier', budgetCents: 200, autoBuyMaxPerSourceCents: 100, sourceAboveThreshold: 'BLOCK', horizon: 2028, mode: 'FIXTURE RESEARCH' }, sources: sources.map((source) => publicSource(source, { sources: [], spentCents: 0 } as unknown as Run)) }))
app.post('/api/v1/research-runs', async (_req, res) => { const run = initRun(); await save(run); return response(res.status(201), run) })
app.get('/api/v1/research-runs/:runId', (req, res) => { const run = getRun(req, res); return run ? response(res, run) : undefined })
app.get('/api/v1/research-runs/:runId/sources', (req, res) => { const run = getRun(req, res); return run ? res.json(run.sources.map((source) => publicSource(source, run))) : undefined })
app.get('/api/v1/research-runs/:runId/sources/:sourceId', (req, res) => { const run = getRun(req, res); if (!run) return; const source = sources.find((item) => item.id === req.params.sourceId); if (!source) return res.status(404).json({ error: 'Source not found' }); const visible = publicSource(source, run); if (source.accessTier === 'PREMIUM' && visible.decision !== 'BUY') return res.json({ ...visible, premium: { status: 'PAYMENT_REQUIRED', resourceId: `resource_${source.id}`, quoteHash: hash({ id: source.id, priceCents: source.priceCents, payee: source.publisher }) } }); return res.json({ ...visible, premium: source.accessTier === 'PREMIUM' ? { status: 'UNLOCKED', contentHash: hash(premiumBodies[source.id]) } : { status: 'OPEN' } }) })
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
    else if (run.phase === 'PLANNING') { run.phase = 'DISCOVERING'; run.sources = rankSources(QUESTION).map((source) => ({ ...source })); emit(run, 'SOURCES_DISCOVERED', '12 candidates found across 6 independent evidence families'); }
    else if (run.phase === 'DISCOVERING') { run.phase = 'RANKING'; emit(run, 'SOURCES_RANKED', 'Deterministic BM25 + tags + precomputed semantic rank applied'); }
    else if (run.phase === 'RANKING') { run.phase = 'READING_OPEN'; emit(run, 'OPEN_EVIDENCE_READ', 'Open evidence read; premium bodies remain protected'); }
    else if (run.phase === 'READING_OPEN') { run.phase = 'GAP_ANALYSIS'; run.gap.state = 'OPEN'; emit(run, 'GAP_FOUND', 'Open gap: grid connection lead times and operating capacity by 2028'); }
    else if (run.phase === 'GAP_ANALYSIS') { run.phase = 'PURCHASE_PLANNING'; emit(run, 'PURCHASE_PLAN_READY', 'Marginal-value plan prepared; price is separate from relevance'); }
    else if (run.phase === 'SYNTHESIZING') { run.phase = 'DOSSIER_READY'; run.dossierReady = true; emit(run, 'DOSSIER_READY', 'Source-linked dossier verified and ready to read'); }
  }
  if (action === 'synthesize') { run.phase = 'SYNTHESIZING'; run.claims = buildClaims(run); run.gap.state = run.sources.some((source) => source.id === 'meridian-ledger' && source.decision === 'BUY') ? 'RESOLVED' : 'PARTIAL'; emit(run, 'DOSSIER_SYNTHESIS_STARTED', 'Fixture synthesis grounded only in accessible evidence'); }
  await save(run); return response(res, run)
}

function buildClaims(run: Run): Source[] extends never[] ? never : Run['claims'] {
  const hasN = run.sources.some((source) => source.id === 'northstar-wire' && source.decision === 'BUY'); const hasM = run.sources.some((source) => source.id === 'meridian-ledger' && source.decision === 'BUY')
  return [
    { id:'claim-demand', text:'Announced demand and capital commitments support continued expansion.', stance:'SUPPORTS', materiality:'MATERIAL', sourceIds:['company-capex','energy-dataset'], familyCount:2, spanIds:['company-capex-open','energy-dataset-open'] },
    { id:'claim-bottleneck', text: hasN ? 'Supplier lead times add a near-term delivery bottleneck.' : 'Equipment delivery remains a relevant but incompletely evidenced constraint.', stance:'CHALLENGES', materiality:'MATERIAL', sourceIds: hasN ? ['northstar-wire'] : ['energy-dataset'], familyCount:1, spanIds: hasN ? ['northstar-s1'] : ['energy-dataset-open'] },
    { id:'claim-grid', text: hasM ? 'Interconnection and power availability can make operating capacity lag announced spending in grid-constrained markets.' : 'Power delivery is the key unresolved gap in the open-source baseline.', stance: hasM ? 'CHALLENGES' : 'UNCERTAIN', materiality:'MATERIAL', sourceIds: hasM ? ['meridian-ledger'] : ['energy-dataset'], familyCount:1, spanIds: hasM ? ['meridian-s1','meridian-s2'] : ['energy-dataset-open'] },
  ]
}

app.post('/api/v1/research-runs/:runId/purchase-decisions', async (req, res) => { const run = getRun(req, res); if (!run) return; const ranked = run.sources.length ? run.sources : rankSources(QUESTION); return res.json({ formula: 'utility-v1', remainingCents: run.budgetCents - run.spentCents, decisions: ranked.filter((source) => source.accessTier === 'PREMIUM').map((source) => ({ sourceId: source.id, expectedEvidenceValue: source.relevance / 100, utilityPerCent: source.priceCents ? (source.relevance / source.priceCents).toFixed(3) : '0', suggestedAction: source.id === 'circuit-note' ? 'SKIP' : source.priceCents > run.budgetCents - run.spentCents || source.priceCents > 100 ? 'BLOCKED' : 'BUY', reason: source.id === 'circuit-note' ? 'Redundant: same evidence family and tested overlap with Northstar Wire.' : source.priceCents > 100 ? 'Blocked: exceeds the S$1.00 per-source mandate ceiling.' : 'Expected to resolve or materially narrow the active grid-delivery gap.' })) }) })
app.post('/api/v1/research-runs/:runId/purchases', async (req, res) => { const run = getRun(req, res); if (!run) return; const source = run.sources.find((item) => item.id === req.body?.sourceId) ?? sources.find((item) => item.id === req.body?.sourceId); if (!source) return res.status(404).json({ error: 'Source not found' }); const action = String(req.body?.action ?? 'BUY') as Decision; const remaining = run.budgetCents - run.spentCents
  if (source.accessTier !== 'PREMIUM') return res.status(400).json({ error: 'Open evidence does not require a purchase' })
  if (action === 'SKIP' || source.id === 'circuit-note') { const current = run.sources.find((item) => item.id === source.id); if (current) { current.decision = 'SKIP'; current.reason = 'Skipped because it repeats Northstar Wire; no new independent family.' } emit(run, 'SOURCE_SKIPPED', 'Circuit Note skipped · redundant with Northstar Wire'); await save(run); return response(res, run) }
  if (source.priceCents > 100 || source.priceCents > remaining) { const current = run.sources.find((item) => item.id === source.id); if (current) { current.decision = 'BLOCKED'; current.reason = `Blocked: S$${(source.priceCents/100).toFixed(2)} exceeds the remaining S$${(remaining/100).toFixed(2)}.` } emit(run, 'PURCHASE_BLOCKED', `${source.publisher} blocked by deterministic budget guard`); await save(run); return response(res, run) }
  if (action !== 'BUY') return res.status(400).json({ error: 'Unsupported purchase action' })
  const current = run.sources.find((item) => item.id === source.id); if (current) { current.decision = 'BUY'; current.reason = source.id === 'northstar-wire' ? 'Bought for independent supplier reporting and marginal delivery evidence.' : 'Bought because operator interviews materially resolve the grid-capacity gap.'; current.purchasedAt = now(); current.evidenceSpans = premiumBodies[source.id]?.spans }
  run.spentCents += source.priceCents; run.phase = 'PURCHASED'; if (source.id === 'northstar-wire') run.thesis.afterNorthstar = `${run.thesis.open} ${AFTER_NORTHSTAR}`; if (source.id === 'meridian-ledger') { run.thesis.afterMeridian = AFTER_MERIDIAN; run.thesis.current = AFTER_MERIDIAN; run.gap.state = 'RESOLVED' }
  emit(run, 'PREMIUM_PURCHASE_SETTLED', `${source.publisher} unlocked via fixture payment · S$${(source.priceCents/100).toFixed(2)}`); await save(run); return response(res, run)
})
app.get('/api/v1/research-runs/:runId/purchases/:purchaseId', (req, res) => { const run = getRun(req, res); if (!run) return; res.json({ purchaseId: req.params.purchaseId, settlement: 'FIXTURE_SIMULATION', label: 'FIXTURE PAYMENT · NOT A REAL PUBLISHER PAYMENT', invoiceId: `invoice_${run.runId}_${req.params.purchaseId}`, exactResource: run.sources.find((source) => source.decision === 'BUY')?.id ?? null, delivery: 'SEPARATE_ACCESS_GRANT' }) })
app.post('/api/v1/research-runs/:runId/synthesize', async (req, res) => advance(req, res, 'synthesize'))
app.get('/api/v1/research-runs/:runId/dossier', (req, res) => { const run = getRun(req, res); if (!run) return; if (!run.dossierReady) return res.status(409).json({ error: 'Dossier is not ready' }); res.json({ mode: 'FIXTURE RESEARCH', title: 'The boom can continue. The grid sets the pace.', conclusion: run.thesis.current, changedAfterPaidResearch: run.thesis.afterMeridian ? { before: run.thesis.open, afterNorthstar: run.thesis.afterNorthstar, after: run.thesis.afterMeridian } : { before: run.thesis.open, after: run.thesis.current }, claims: run.claims, uncertainty: run.gap.state === 'RESOLVED' ? 'GridScope Asia remains desirable for regional queue benchmarks but was blocked by the S$1.00 per-source mandate ceiling.' : run.gap.question, sourceLedger: run.sources.filter((source) => source.accessTier === 'PREMIUM').map((source) => ({ publisher: source.publisher, priceCents: source.priceCents, decision: source.decision ?? 'PENDING', family: source.familyLabel, authority: source.authority, originality: source.originality, access: source.decision === 'BUY' ? 'UNLOCKED' : 'PREVIEW_ONLY' })), method: 'Deterministic retrieval, evidence-family clustering, budget utility heuristic, and fixture synthesis. This is a research demonstration, not investment advice.' }) })
app.get('/api/v1/research-runs/:runId/receipt', (req, res) => { const run = getRun(req, res); if (!run) return; res.json({ runId: run.runId, mode: 'FIXTURE RESEARCH', spend: { spentCents: run.spentCents, remainingCents: run.budgetCents - run.spentCents }, purchases: run.sources.filter((source) => source.decision).map((source) => ({ sourceId: source.id, publisher: source.publisher, decision: source.decision, amountCents: source.decision === 'BUY' ? source.priceCents : 0, invoiceId: `fixture_${run.runId}_${source.id}`, settlement: source.decision === 'BUY' ? 'SIMULATION_NOT_SETTLED' : 'NONE' })), limitations: ['Fixture payment did not pay a real publisher.', 'Premium text is synthetic and fictional.', 'Testnet XRP has no S$ equivalence.', 'This dossier is not investment advice.'] }) })
app.get('/api/v1/research-runs/:runId/stream', (req, res) => { const run = getRun(req, res); if (!run) return; res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache'); res.setHeader('Connection','keep-alive'); res.flushHeaders?.(); clients.set(run.runId, clients.get(run.runId) ?? new Set()); clients.get(run.runId)!.add(res); res.write(`event: connected\ndata: ${JSON.stringify({ runId: run.runId })}\n\n`); req.on('close', () => clients.get(run.runId)?.delete(res)) })

await load()
app.listen(port, () => console.log(`ResearchAgent API listening on http://localhost:${port} · mode=${mode} · persistence=${dataFile}`))
