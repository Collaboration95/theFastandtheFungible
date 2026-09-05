import express, { type Request, type Response } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { candidates, MAX_DROPS, MANDATE_ID, PLACEMENT_START_MS, PRICE_DROPS, PROJECT_ID, PURCHASE_ID, type Candidate, type DemoPhase, type Scenario, type PurchaseState } from '../src/domain.js'
import { eventHash, hashValue, verifyEventChain } from './hash-chain.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const cleanAssetPath = join(root, 'server/assets/dawn-current-clean.mp3')
const odrlPolicyPath = join(root, 'server/assets/dawn-current.odrl.json')
const deliveryManifestPath = join(root, 'server/assets/delivery-manifest.json')
const port = Number(process.env.FAIRCUT_PORT ?? 8787)
const mode = process.env.FAIRCUT_MODE ?? 'demo-local'
const isProduction = process.argv.includes('--production')
const displayMode = mode === 'demo-local' ? 'FIXTURE DEMO · SIMULATION — NOT SETTLED' : mode === 'offline-rehearsal' ? 'OFFLINE SIMULATION' : mode === 'recorded-testnet' ? 'RECORDED TESTNET EVIDENCE' : 'LIVE · XRPL TESTNET'

type EventRecord = { sequence: number; type: string; actor: string; occurredAt: string; idempotencyKey: string; previousHash: string; payload: Record<string, unknown>; eventHash: string }
type IdempotencyRecord = { requestHash: string; statusCode: number; payload: unknown }
type State = {
  phase: DemoPhase
  discovered: boolean
  evaluated: boolean
  selectedCandidateId: Candidate['id'] | null
  purchaseState: PurchaseState
  scenario: Scenario
  invoiceId: string | null
  quoteHash: string | null
  transactionHash: string | null
  settlementStatus: 'NONE' | 'FIXTURE_SIMULATION' | 'VALIDATED_SUCCESS'
  eventChain: EventRecord[]
  lastReconciledAt: string
  delivery: { status: 'NOT_REQUESTED' | 'VERIFIED' | 'EXCEPTION'; assetHash?: string; policyHash?: string; detail?: string }
}

const now = () => new Date().toISOString()
const hash = hashValue
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64')

function initialState(): State {
  const isRecorded = mode === 'recorded-testnet' && Boolean(process.env.FAIRCUT_RECORDED_TX_HASH)
  return {
    phase: 'rough-cut', discovered: false, evaluated: false, selectedCandidateId: null,
    purchaseState: 'DRAFT', scenario: 'happy', invoiceId: null, quoteHash: null, transactionHash: isRecorded ? process.env.FAIRCUT_RECORDED_TX_HASH ?? null : null, settlementStatus: isRecorded ? 'VALIDATED_SUCCESS' : 'NONE',
    eventChain: [], lastReconciledAt: now(), delivery: { status: 'NOT_REQUESTED' },
  }
}

let state = initialState()
let livePaymentInFlight = false
const idempotencyLedger = new Map<string, IdempotencyRecord>()

function appendEvent(type: string, actor: string, payload: Record<string, unknown>, idempotencyKey = randomUUID()) {
  const previousHash = state.eventChain.at(-1)?.eventHash ?? 'GENESIS'
  const occurredAt = now()
  const sequence = state.eventChain.length + 1
  const record = { sequence, type, actor, occurredAt, idempotencyKey, previousHash, payload }
  state.eventChain.push({ ...record, eventHash: eventHash(record, PURCHASE_ID) })
}

function resetState() {
  state = initialState()
  appendEvent('DEMO_RESET', 'principal', { environment: mode })
}

function getSelected() {
  return candidates.find((candidate) => candidate.id === state.selectedCandidateId) ?? candidates[1]
}

function makeQuote(candidate: Candidate) {
  const invoiceId = state.invoiceId ?? `FC-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`
  state.invoiceId = invoiceId
  const quote = {
    schemaVersion: 'faircut.quote.v1', id: `quote_${candidate.id}_v1`, invoiceId, providerId: candidate.providerId,
    resourceSku: `sku_${candidate.id}_12s_clean`, network: 'xrpl:1', scheme: 'exact', asset: 'XRP',
    amountDrops: String(candidate.priceDrops), payTo: candidate.id === 'dawn-current' ? (process.env.FAIRCUT_XRPL_PAYEE ?? 'rMikaDemoPayee7Q') : 'rBlockedCreator9X',
    sourceTag: 804681468, rightsPolicyHash: candidate.policyHash, assetHash: candidate.assetDigest,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), maxTimeoutSeconds: 600, x402Version: 2,
  }
  state.quoteHash = hash(quote)
  return { ...quote, canonicalHash: state.quoteHash }
}

function safeCandidate(candidate: Candidate) {
  return { ...candidate, cleanUrl: undefined, odrlPolicy: undefined }
}

function workspace() {
  const selected = getSelected()
  return {
    project: { schemaVersion: 'faircut.project.v1', id: PROJECT_ID, title: 'Japan Travel / Final 20s', ownerId: 'Leah Tan', durationMs: 20_000, placement: { startMs: 5_500, durationMs: 12_000 } },
    mandate: { id: MANDATE_ID, version: 1, principal: 'Leah Tan', agent: 'FairCut edit agent', workload: 'travel-campaign-042', use: 'Commercial social', territories: ['Singapore', 'Japan'], term: '6 months', placement: '12 seconds', capDrops: String(MAX_DROPS), displayBudget: 'S$1 demo estimate', prohibitedTraits: ['Voice replicas'], provenance: 'Required', expiresAt: '2026-09-05T23:59:00+08:00', canonicalHash: 'sha256:mandate-leah-launch-v1' },
    candidates: state.discovered ? candidates.map(safeCandidate) : [],
    state: { phase: state.phase, purchaseState: state.purchaseState, selectedCandidateId: state.selectedCandidateId, discovered: state.discovered, evaluated: state.evaluated, mode, settlementStatus: state.settlementStatus, lastReconciledAt: state.lastReconciledAt, scenario: state.scenario, delivery: state.delivery },
    receiptSummary: { status: state.purchaseState === 'FULFILMENT_VERIFIED' ? 'Settled and fulfilled' : state.purchaseState, transactionHash: state.transactionHash, eventHeadHash: state.eventChain.at(-1)?.eventHash ?? null },
    selectedQuote: state.evaluated && selected.id === 'dawn-current' ? makeQuote(selected) : null,
  }
}

function challenge(candidate: Candidate) {
  const quote = makeQuote(candidate)
  return {
    x402Version: 2,
    accepted: [{ scheme: 'exact', network: 'xrpl:1', asset: 'XRP', payTo: quote.payTo, amount: String(quote.amountDrops), maxTimeoutSeconds: quote.maxTimeoutSeconds, extra: { sourceTag: quote.sourceTag, invoiceId: quote.invoiceId, resourceSku: quote.resourceSku, rightsPolicyHash: quote.rightsPolicyHash, assetHash: quote.assetHash } }],
    quote,
  }
}

const app = express()
app.use(express.json({ limit: '64kb' }))
app.use((req, res, next) => { res.setHeader('X-FairCut-Mode', mode); next() })
app.use((req, res, next) => {
  if (req.method === 'GET') return next()
  const idempotencyKey = String(req.body?.idempotencyKey ?? req.header('Idempotency-Key') ?? '')
  if (!idempotencyKey) return next()
  const ledgerKey = `${req.method}:${req.path}:${idempotencyKey}`
  const requestHash = hash(req.body ?? {})
  const previous = idempotencyLedger.get(ledgerKey)
  if (previous && previous.requestHash !== requestHash) return res.status(409).json({ error: 'Idempotency key was reused with a different request body', state: 'IDEMPOTENCY_CONFLICT' })
  if (previous) return res.status(previous.statusCode).json(previous.payload)
  const sendJson = res.json.bind(res)
  res.json = ((payload: unknown) => { idempotencyLedger.set(ledgerKey, { requestHash, statusCode: res.statusCode, payload }); return sendJson(payload) }) as typeof res.json
  return next()
})

app.get('/health', (_req, res) => res.json({ ok: true, mode, xrpl: process.env.FAIRCUT_XRPL_SEED ? 'configured' : 'not-configured' }))

app.get('/api/projects/:projectId/workspace', (req, res) => {
  if (req.params.projectId !== PROJECT_ID) return res.status(404).json({ error: 'Project not found' })
  return res.json(workspace())
})

app.post('/api/projects/:projectId/discover', (req, res) => {
  if (req.params.projectId !== PROJECT_ID) return res.status(404).json({ error: 'Project not found' })
  state.discovered = true; state.phase = 'compare'; state.purchaseState = 'DISCOVERED'
  appendEvent('CANDIDATES_DISCOVERED', 'faircut-agent', { providerIds: ['nightjar-direct', 'mika-direct', 'open-loom'], candidateCount: 3 }, req.body?.idempotencyKey)
  return res.status(202).json({ operationId: `op_${randomUUID()}`, candidates: candidates.map(safeCandidate), state: workspace().state })
})

app.post('/api/projects/:projectId/evaluate', (req, res) => {
  if (req.params.projectId !== PROJECT_ID) return res.status(404).json({ error: 'Project not found' })
  if (!state.discovered) return res.status(409).json({ error: 'Discover candidates first' })
  state.evaluated = true; state.phase = 'blocked'; state.selectedCandidateId = 'neon-pilgrim'; state.purchaseState = 'BLOCKED'
  appendEvent('CREATIVE_ASSESSMENTS_RECORDED', 'recorded-demo-agent', { modelProvider: 'recorded-demo-assessment', candidateIds: candidates.map((candidate) => candidate.id), outputHash: hash(candidates.map((candidate) => candidate.creative)) }, req.body?.idempotencyKey)
  appendEvent('RIGHTS_ASSESSMENTS_RECORDED', 'deterministic-rights-evaluator', { blocked: 'neon-pilgrim', eligible: ['dawn-current', 'paper-horizon'], reasonCodes: ['COMMERCIAL_USE_NOT_PERMITTED', 'TERRITORY_MISSING_JP', 'RIGHTS_HOLDER_PAYEE_MISMATCH'] }, req.body?.idempotencyKey)
  return res.json({ assessments: candidates.map((candidate) => ({ candidateId: candidate.id, creative: candidate.creative, rights: { decision: candidate.rightDecision, checks: candidate.rights, evaluatorVersion: 'faircut-rights-v1' } })), state: workspace().state })
})

app.post('/api/projects/:projectId/select', (req, res) => {
  const candidate = candidates.find((item) => item.id === req.body?.candidateId)
  if (!candidate) return res.status(400).json({ error: 'Unknown candidate' })
  state.selectedCandidateId = candidate.id
  state.phase = candidate.id === 'neon-pilgrim' ? 'blocked' : 'license'
  state.purchaseState = candidate.rightDecision === 'BLOCKED' ? 'BLOCKED' : 'ELIGIBLE'
  appendEvent('CANDIDATE_SELECTED', 'principal', { candidateId: candidate.id, rightDecision: candidate.rightDecision }, req.body?.idempotencyKey)
  return res.json({ candidate: safeCandidate(candidate), state: workspace().state, quote: candidate.id === 'dawn-current' ? challenge(candidate).quote : null })
})

app.get('/api/candidates/:candidateId/preview', (req, res) => {
  const candidate = candidates.find((item) => item.id === req.params.candidateId)
  if (!candidate) return res.status(404).send('Preview not found')
  return res.redirect(candidate.previewUrl)
})

app.get('/api/providers/:providerId/assets/:sku/master', async (req, res) => {
  const candidate = candidates.find((item) => item.providerId === req.params.providerId)
  if (!candidate || !candidate.cleanUrl) return res.status(404).json({ error: 'Resource not found' })
  if (state.purchaseState !== 'SIMULATED_SETTLED' && state.purchaseState !== 'FULFILMENT_VERIFIED' && state.purchaseState !== 'FULFILMENT_EXCEPTION') {
    const payload = challenge(candidate)
    res.setHeader('PAYMENT-REQUIRED', b64(payload))
    return res.status(402).json({ error: 'Payment required', contract: 'PAYMENT-REQUIRED', x402Version: 2 })
  }
  if (state.purchaseState === 'FULFILMENT_EXCEPTION') return res.status(409).json({ error: 'Clean asset withheld after delivery verification failure', state: 'FULFILMENT_EXCEPTION' })
  const fixtureEvidence = req.header('X-FairCut-Fixture-Payment') === 'SIMULATED_SETTLED'
  const liveEvidence = state.settlementStatus === 'VALIDATED_SUCCESS' && req.header('PAYMENT-SIGNATURE') === state.transactionHash
  if (state.purchaseState !== 'FULFILMENT_VERIFIED' && !fixtureEvidence && !liveEvidence) return res.status(402).json({ error: 'Valid x402 payment evidence required after settlement', contract: 'PAYMENT-SIGNATURE or X-FairCut-Fixture-Payment' })
  const asset = await readFile(cleanAssetPath)
  const assetDigest = `sha256:${createHash('sha256').update(asset).digest('hex')}`
  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store', 'X-FairCut-Asset': 'clean-after-payment', 'X-FairCut-Asset-Digest': assetDigest })
  return res.send(asset)
})

app.post('/api/purchases/:purchaseId/authorize', (req, res) => {
  if (req.params.purchaseId !== PURCHASE_ID && req.params.purchaseId !== 'purchase_japan_travel_20s') return res.status(404).json({ error: 'Purchase not found' })
  const candidate = getSelected()
  if (candidate.id === 'neon-pilgrim' || candidate.rightDecision === 'BLOCKED') {
    state.purchaseState = 'BLOCKED'; state.phase = 'blocked'
    appendEvent('PAYMENT_DENIED', 'spend-guard', { reasonCodes: candidate.rights.filter((check) => check.result === 'FAIL').map((check) => check.code), noSignature: true }, req.body?.idempotencyKey)
    return res.status(403).json({ state: 'BLOCKED', title: 'Blocked before signing', message: 'This cue fails commercial rights and payee binding. No transaction was signed or submitted.', reasonCodes: candidate.rights.filter((check) => check.result === 'FAIL').map((check) => check.code) })
  }
  if (state.scenario === 'quote_changed') {
    state.purchaseState = 'BLOCKED'; state.phase = 'license'
    appendEvent('QUOTE_CHANGED', 'merchant-adapter', { changedField: 'amountDrops', expected: String(PRICE_DROPS), observed: '9000', authorizationInvalidated: true }, req.body?.idempotencyKey)
    return res.status(409).json({ state: 'REQUOTED_REVIEW_REQUIRED', changedField: 'amountDrops', message: 'The quote changed after evaluation. Authorization is invalid; restart review against the new terms.' })
  }
  if (state.scenario === 'risk_unavailable') {
    appendEvent('RISK_PROVIDER_UNAVAILABLE', 'local-policy-adapter', { source: 'LOCAL_DEMO_POLICY', failClosed: true }, req.body?.idempotencyKey)
    return res.status(503).json({ state: 'CHALLENGE_REQUIRED', message: 'Risk provider unavailable. The local demo policy is not silently used as a live sponsor decision.' })
  }
  state.purchaseState = 'AUTHORIZED'; state.phase = 'license'
  const quote = challenge(candidate).quote
  appendEvent('PAYMENT_INTENT_AUTHORIZED', 'spend-guard', { purchaseId: PURCHASE_ID, quoteHash: quote.canonicalHash, amountDrops: quote.amountDrops, payTo: quote.payTo, invoiceId: quote.invoiceId, network: quote.network }, req.body?.idempotencyKey)
  return res.json({ state: 'AUTHORIZED', quote, source: 'LOCAL_DEMO_POLICY', signerBoundary: 'server-only' })
})

app.post('/api/purchases/:purchaseId/pay', async (req, res) => {
  if (req.params.purchaseId !== PURCHASE_ID) return res.status(404).json({ error: 'Purchase not found' })
  if (state.purchaseState === 'SIMULATED_SETTLED' || state.purchaseState === 'FULFILMENT_VERIFIED') return res.json(paymentProjection())
  if (state.purchaseState !== 'AUTHORIZED') return res.status(409).json({ error: 'Payment intent is not authorized', state: state.purchaseState })
  if (state.scenario === 'payment_failed') {
    state.purchaseState = 'PAYMENT_FAILED'; appendEvent('PAYMENT_FAILED', 'x402-adapter', { reason: 'facilitator_unavailable', retrySafe: true }, req.body?.idempotencyKey)
    return res.status(503).json(paymentProjection())
  }
  if (state.scenario === 'payment_unconfirmed') {
    state.purchaseState = 'PAYMENT_UNCONFIRMED'; appendEvent('PAYMENT_UNCONFIRMED', 'ledger-reconciler', { reason: 'validation_timeout', doNotDuplicate: true }, req.body?.idempotencyKey)
    return res.status(202).json(paymentProjection())
  }
  if (mode === 'recorded-testnet') return res.status(409).json({ state: 'RECORDED_EVIDENCE_READ_ONLY', message: 'Recorded Testnet evidence is read-only. Switch to testnet-live for a fresh payment or demo-local for fixture rehearsal.' })
  if (mode === 'testnet-live' && !process.env.FAIRCUT_XRPL_SEED) {
    appendEvent('LIVE_CONFIGURATION_REQUIRED', 'xrpl-testnet-signer', { required: ['FAIRCUT_XRPL_SEED', 'FAIRCUT_XRPL_PAYEE'], failClosed: true }, req.body?.idempotencyKey)
    return res.status(503).json({ state: 'LIVE_CONFIGURATION_REQUIRED', mode: 'LIVE · XRPL TESTNET', message: 'Live Testnet mode is not configured with a server-only signer. No fixture settlement was used.' })
  }
  if (mode === 'testnet-live' && process.env.FAIRCUT_XRPL_SEED) {
    if (livePaymentInFlight) return res.status(202).json({ ...paymentProjection(), state: 'PAYMENT_UNCONFIRMED', doNotDuplicate: true, message: 'A payment attempt is already in flight. Reconcile before retrying.' })
    livePaymentInFlight = true
    try {
      const liveResult = await executeLivePayment(getSelected())
      if (liveResult.ok) {
        state.transactionHash = liveResult.hash
        state.purchaseState = 'SIMULATED_SETTLED'; state.settlementStatus = 'VALIDATED_SUCCESS'
        appendEvent('SETTLED', 'xrpl-testnet-reconciler', { validated: true, transactionResult: 'tesSUCCESS', transactionHash: liveResult.hash, ledgerIndex: liveResult.ledgerIndex }, req.body?.idempotencyKey)
        return res.json({ ...paymentProjection(), mode: 'LIVE · XRPL TESTNET', recorded: false })
      }
      if (liveResult.hash) state.transactionHash = liveResult.hash
      state.purchaseState = 'PAYMENT_UNCONFIRMED'; appendEvent('PAYMENT_UNCONFIRMED', 'xrpl-testnet-reconciler', { reason: liveResult.error ?? 'unknown', doNotDuplicate: true }, req.body?.idempotencyKey)
      return res.status(202).json(paymentProjection())
    } finally {
      livePaymentInFlight = false
    }
  }
  state.purchaseState = 'SIMULATED_SETTLED'; state.settlementStatus = 'FIXTURE_SIMULATION'
  appendEvent('SIMULATED_SETTLEMENT', 'fixture-ledger', { simulation: true, validated: false, transactionResult: 'NOT_APPLICABLE', doNotRepresentAsLive: true }, req.body?.idempotencyKey)
  return res.json({ ...paymentProjection(), mode: 'FIXTURE DEMO', recorded: false })
})

app.get('/api/purchases/:purchaseId/payment', (req, res) => req.params.purchaseId === PURCHASE_ID ? res.json(paymentProjection()) : res.status(404).json({ error: 'Purchase not found' }))

function paymentProjection() {
  const selected = getSelected()
  const liveSettled = state.settlementStatus === 'VALIDATED_SUCCESS'
  return { state: state.purchaseState, settlementStatus: state.settlementStatus, amountDrops: selected.priceDrops, network: 'xrpl:1', asset: 'XRP', payTo: process.env.FAIRCUT_XRPL_PAYEE ?? 'rMikaDemoPayee7Q', invoiceId: state.invoiceId, transactionHash: state.transactionHash, validated: liveSettled, transactionResult: liveSettled ? 'tesSUCCESS' : null, source: mode === 'demo-local' ? 'LOCAL_FIXTURE_LEDGER' : mode, lastCheckedAt: state.lastReconciledAt, safeRetry: state.purchaseState === 'PAYMENT_FAILED' }
}

app.post('/api/purchases/:purchaseId/fulfil', async (req, res) => {
  if (req.params.purchaseId !== PURCHASE_ID) return res.status(404).json({ error: 'Purchase not found' })
  if (state.purchaseState !== 'SIMULATED_SETTLED' && state.purchaseState !== 'FULFILMENT_EXCEPTION') return res.status(409).json({ error: 'Settlement evidence required before delivery' })
  if (state.scenario === 'delivery_mismatch') {
    state.purchaseState = 'FULFILMENT_EXCEPTION'; state.phase = 'deliver'; state.delivery = { status: 'EXCEPTION', detail: 'Asset SHA-256 does not match the frozen quote.' }
    appendEvent('FULFILMENT_EXCEPTION', 'fulfilment-evaluator', { exceptionCode: 'DELIVERY_ASSET_HASH_MISMATCH', cleanInserted: false, settlementPreserved: true }, req.body?.idempotencyKey)
    return res.json({ state: state.purchaseState, delivery: state.delivery, message: 'Payment settled; delivery did not verify.' })
  }
  const verification = await verifyFulfilment(getSelected())
  if (!verification.valid) {
    state.purchaseState = 'FULFILMENT_EXCEPTION'; state.phase = 'deliver'; state.delivery = { status: 'EXCEPTION', detail: verification.detail }
    appendEvent('FULFILMENT_EXCEPTION', 'fulfilment-evaluator', { exceptionCode: 'DELIVERY_VERIFICATION_FAILED', cleanInserted: false, settlementPreserved: true, checks: verification.checks }, req.body?.idempotencyKey)
    return res.json({ state: state.purchaseState, delivery: state.delivery, message: 'Payment settled; delivery did not verify.' })
  }
  state.purchaseState = 'FULFILMENT_VERIFIED'; state.phase = 'final-cut'; state.delivery = { status: 'VERIFIED', assetHash: verification.assetDigest, policyHash: verification.policyDigest, detail: verification.detail }
  appendEvent('FULFILMENT_VERIFIED', 'fulfilment-evaluator', { assetHash: state.delivery.assetHash, policyHash: state.delivery.policyHash, durationMs: verification.containerDurationMs, effectiveStemDurationMs: verification.effectiveStemDurationMs, mimeType: verification.mimeType, orderReference: verification.purchaseId }, req.body?.idempotencyKey)
  appendEvent('TIMELINE_UPDATED', 'project-service', { placementId: 'placement_reveal_12s', cleanStemInserted: true }, req.body?.idempotencyKey)
  return res.json({ state: state.purchaseState, delivery: state.delivery, cleanAssetUrl: '/api/providers/mika-direct/assets/sku_dawn-current_12s_clean/master' })
})

async function verifyFulfilment(candidate: Candidate) {
  const [asset, policy, manifestText] = await Promise.all([
    readFile(cleanAssetPath), readFile(odrlPolicyPath), readFile(deliveryManifestPath, 'utf8'),
  ])
  const manifest = JSON.parse(manifestText) as { purchaseId?: string; asset?: { sha256?: string; mimeType?: string; durationMs?: number; effectiveStemDurationMs?: number; placementStartMs?: number }; licence?: { odrlSha256?: string }; attribution?: string }
  const assetDigest = `sha256:${createHash('sha256').update(asset).digest('hex')}`
  const policyDigest = `sha256:${createHash('sha256').update(policy).digest('hex')}`
  const checks = {
    assetDigest: manifest.asset?.sha256 === assetDigest && candidate.assetDigest === assetDigest,
    licenceDigest: manifest.licence?.odrlSha256 === policyDigest && candidate.policyHash === policyDigest,
    orderReference: manifest.purchaseId === PURCHASE_ID,
    mimeType: manifest.asset?.mimeType === 'audio/mpeg',
    containerDuration: manifest.asset?.durationMs === 20_000,
    effectiveStemDuration: manifest.asset?.effectiveStemDurationMs === candidate.durationMs,
    placementStart: manifest.asset?.placementStartMs === PLACEMENT_START_MS,
    attribution: manifest.attribution === candidate.attribution,
  }
  const valid = Object.values(checks).every(Boolean)
  return { valid, checks, assetDigest, policyDigest, purchaseId: manifest.purchaseId, mimeType: manifest.asset?.mimeType, containerDurationMs: manifest.asset?.durationMs, effectiveStemDurationMs: manifest.asset?.effectiveStemDurationMs, detail: valid ? 'Bytes, duration, MIME type, policy, attribution, and order reference match.' : 'Delivered bytes or licence manifest did not match the frozen order.' }
}

app.use('/api/purchases/:purchaseId/receipt', (_req, res, next) => {
  const sendJson = res.json.bind(res)
  res.json = ((body: unknown) => {
    if (body && typeof body === 'object' && 'payment' in body) {
      const receipt = body as { modeLabel?: string; payment?: { payTo?: string; validation?: { validated?: boolean; transactionResult?: string | null; label?: string } } }
      receipt.modeLabel = displayMode
      if (receipt.payment) {
        receipt.payment.payTo = process.env.FAIRCUT_XRPL_PAYEE ?? receipt.payment.payTo
        if (state.settlementStatus !== 'VALIDATED_SUCCESS' && receipt.payment.validation) {
          receipt.payment.validation = { validated: false, transactionResult: receipt.payment.validation.transactionResult === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'UNKNOWN', label: receipt.payment.validation.label ?? 'Payment not independently validated' }
        }
      }
    }
    return sendJson(body)
  }) as typeof res.json
  next()
})

app.get('/api/purchases/:purchaseId/receipt', (req, res) => {
  if (req.params.purchaseId !== PURCHASE_ID) return res.status(404).json({ error: 'Purchase not found' })
  const selected = getSelected()
  return res.json({ schemaVersion: 'faircut.receipt.v1', environment: mode, modeLabel: displayMode, headline: state.purchaseState === 'FULFILMENT_EXCEPTION' ? 'Payment settled; delivery did not verify.' : state.purchaseState === 'FULFILMENT_VERIFIED' ? 'Settled and fulfilled' : selected.rightDecision === 'BLOCKED' ? 'Blocked before signing' : 'Purchase in progress', mandate: { id: MANDATE_ID, version: 1, hash: 'sha256:mandate-leah-launch-v1', summary: '12 seconds · commercial social · Singapore + Japan · six months · cap 10,000 drops' }, decision: { candidate: selected.title, creator: selected.creator, provider: selected.provider, creativeSummary: selected.creative.summary, rightsDecision: selected.rightDecision, reasonCodes: selected.rights.filter((check) => check.result === 'FAIL').map((check) => check.code), modelSource: state.evaluated ? 'Recorded demo assessment · no chain-of-thought stored' : null, policyEvaluator: 'FairCut deterministic rights evaluator v1' }, licence: { odrlPolicyHash: selected.policyHash, attribution: selected.attribution, provenance: selected.provenanceLabel, limitation: 'Provenance assertions do not prove legal ownership, consent, or authority to license.' }, payment: { source: mode === 'demo-local' ? 'Local FairCut policy (demo)' : mode, x402Version: 2, network: 'xrpl:1', asset: 'XRP', amountDrops: selected.priceDrops, invoiceId: state.invoiceId, payTo: selected.id === 'dawn-current' ? 'rMikaDemoPayee7Q' : 'rBlockedCreator9X', transactionHash: state.transactionHash, validation: state.transactionHash ? { validated: state.settlementStatus === 'VALIDATED_SUCCESS', transactionResult: state.settlementStatus === 'VALIDATED_SUCCESS' ? 'tesSUCCESS' : 'UNKNOWN' } : { validated: false, transactionResult: 'NOT_APPLICABLE', label: 'SIMULATION — NOT SETTLED' }, sourceTag: 804681468, explorerUrl: state.transactionHash && state.settlementStatus === 'VALIDATED_SUCCESS' ? `https://testnet.xrpl.org/transactions/${state.transactionHash}` : null }, delivery: state.delivery, audit: { eventCount: state.eventChain.length, headHash: state.eventChain.at(-1)?.eventHash ?? null, chainValid: verifyEventChain(state.eventChain, PURCHASE_ID), events: state.eventChain.map(({ sequence, type, actor, occurredAt, eventHash }) => ({ sequence, type, actor, occurredAt, eventHash })) }, limitations: ['ODRL represents the licensor’s asserted permission; it does not by itself guarantee legal enforceability.', 'The signed provenance fixture records an assertion; it does not prove copyright ownership, consent, or authority to license.', 'SHA-256 identifies delivered bytes; it is not an ISCC or proof of ownership.', 'XRPL proves an exact validated payment only; it does not determine rights, creative fit, provenance, or fulfilment.'] })
})

app.post('/api/demo/reset', (_req, res) => { resetState(); return res.json(workspace()) })
app.post('/api/demo/scenario', (req, res) => { const requested = req.body?.scenario as Scenario; if (!['happy', 'quote_changed', 'payment_failed', 'payment_unconfirmed', 'delivery_mismatch', 'risk_unavailable'].includes(requested)) return res.status(400).json({ error: 'Unknown scenario' }); state.scenario = requested; appendEvent('SCENARIO_SELECTED', 'principal', { scenario: requested }); return res.json(workspace()) })

async function executeLivePayment(candidate: Candidate): Promise<{ ok: true; hash: string; ledgerIndex: number } | { ok: false; error: string; hash?: string }> {
  let submittedHash: string | undefined
  try {
    const xrpl = await import('xrpl')
    const xrplUrl = process.env.FAIRCUT_XRPL_URL ?? 'wss://s.altnet.rippletest.net:51233'
    if (xrplUrl !== 'wss://s.altnet.rippletest.net:51233' && xrplUrl !== 'wss://s.altnet.rippletest.net/') return { ok: false, error: 'XRPL URL is not on the Testnet allowlist' }
    const client = new xrpl.Client(xrplUrl)
    await client.connect()
    const wallet = xrpl.Wallet.fromSeed(process.env.FAIRCUT_XRPL_SEED as string)
    const invoiceId = state.invoiceId ?? `FC-${randomUUID()}`
    const payee = process.env.FAIRCUT_XRPL_PAYEE
    if (!payee) return { ok: false, error: 'FAIRCUT_XRPL_PAYEE is required for live Testnet mode' }
    if (!xrpl.isValidAddress(payee)) return { ok: false, error: 'FAIRCUT_XRPL_PAYEE is not a valid XRPL address' }
    const currentLedger = await client.getLedgerIndex()
    const lastLedgerSequence = currentLedger + 4
    const prepared = await client.autofill({ TransactionType: 'Payment', Account: wallet.address, Destination: payee, Amount: String(candidate.priceDrops), SourceTag: 804681468, LastLedgerSequence: lastLedgerSequence, Memos: [{ Memo: { MemoData: Buffer.from(invoiceId, 'utf8').toString('hex').toUpperCase() } }] }) as unknown as { TransactionType: string; Account: string; Destination: string; Amount: string; SourceTag: number; LastLedgerSequence: number; Memos: unknown[]; Fee?: string; Flags?: number }
    if (!prepared.Fee || Number(prepared.Fee) > 20 || prepared.TransactionType !== 'Payment' || 'Flags' in prepared && Number(prepared.Flags) !== 0 || prepared.LastLedgerSequence < currentLedger || prepared.LastLedgerSequence > lastLedgerSequence) throw new Error('Signer guard rejected the prepared payment')
    const signed = wallet.sign(prepared as Parameters<typeof wallet.sign>[0])
    submittedHash = signed.hash
    appendEvent('SIGNED', 'server-only-signer', { transactionHash: signed.hash, accountSuffix: wallet.address.slice(-4), amountDrops: String(candidate.priceDrops), invoiceId })
    await client.submitAndWait(signed.tx_blob)
    const result = await client.request({ command: 'tx', transaction: signed.hash, binary: false })
    await client.disconnect()
    const metadata = typeof result.result.meta === 'string' ? undefined : result.result.meta as { TransactionResult?: string } | undefined
    const tx = result.result.tx_json as { TransactionType?: string; Account?: string; Destination?: string; Amount?: string; DeliverMax?: string; SourceTag?: number; LastLedgerSequence?: number; Memos?: Array<{ Memo?: { MemoData?: string } }> } | undefined
    const expectedMemo = Buffer.from(state.invoiceId ?? '', 'utf8').toString('hex').toUpperCase()
    const actualAmount = tx?.Amount ?? tx?.DeliverMax
    const invoiceBound = tx?.Memos?.some((memo) => memo.Memo?.MemoData === expectedMemo) ?? false
    const termsMatch = tx?.TransactionType === 'Payment' && tx.Destination === payee && tx.Account === wallet.address && actualAmount === String(candidate.priceDrops) && tx.SourceTag === 804681468 && typeof tx.LastLedgerSequence === 'number' && invoiceBound
    if (!result.result.validated || metadata?.TransactionResult !== 'tesSUCCESS' || !termsMatch) return { ok: false, error: 'XRPL validation or frozen payment terms did not match', hash: signed.hash }
    return { ok: true, hash: signed.hash, ledgerIndex: Number(result.result.ledger_index) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.replace(process.env.FAIRCUT_XRPL_SEED ?? 'never', '[redacted]') : 'XRPL request failed', ...(submittedHash ? { hash: submittedHash } : {}) }
  }
}

if (isProduction) app.use(express.static(join(root, 'dist')))
if (isProduction) app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) return res.sendFile(join(root, 'dist/index.html'))
  return next()
})

app.listen(port, () => console.log(`FairCut server listening on http://localhost:${port} (${mode})`))
