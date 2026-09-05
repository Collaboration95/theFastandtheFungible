import express, { type NextFunction, type Request, type Response } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { z } from 'zod'
import {
  MANDATE, MISSION, VEHICLE, FAILURE_FIXTURES, RUN_STATES, type ChargerOffer, type CreditDecision, type EventRecord,
  type FailureFixture, type MissionReceipt, type OfferAssessment, type PaymentIntent, type Run, type RunState, type Settlement,
  type ChargeSession, assessOffer, arrivalAt, batteryKwh, canonicalQuote, formatTime, phaseForState, stableJson, underwrite,
} from '../shared/domain'

type AppMode = 'fixture' | 'recorded-testnet' | 'live-testnet'
type StoreDocument = { run: Run; idempotency: Record<string, { requestHash: string; status: number; body: unknown }> }
type MutationResult = { status: number; body: unknown }

const PORT = Number(process.env.PORT ?? 8787)
const mode: AppMode = process.env.APP_MODE === 'recorded' ? 'recorded-testnet' : process.env.APP_MODE === 'live' ? 'live-testnet' : 'fixture'
const modeLabel = mode === 'fixture' ? 'FIXTURE DEMO' : mode === 'recorded-testnet' ? 'RECORDED TESTNET' : 'LIVE · XRPL TESTNET'
const DATA_FILE = resolve(process.cwd(), String(process.env.DATABASE_URL ?? 'file:./data/fleetcredit.json').replace(/^file:/, ''))
const DEMO_PAYEE = process.env.XRPL_CHARGER_DESTINATION ?? 'rVoltFastFixturePayee9Q'
const DEFAULT_LLM_PROVIDER = process.env.LLM_PROVIDER ?? (process.env.GROQ_API_KEY ? 'groq' : process.env.OPENAI_API_KEY ? 'openai' : 'fixture')

function hash(value: unknown): string { return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}` }
function timestamp(): string { return new Date().toISOString() }
function makeId(prefix: string): string { return `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 18)}` }
function isoAt(minutes: number): string { return new Date(new Date(MISSION.referenceTime).getTime() + minutes * 60_000).toISOString() }

function seedOffers(): ChargerOffer[] {
  const common = { connector: 'CCS2' as const, detourKm: 0.8, energyKwh: 8, registeredDestinationAccount: DEMO_PAYEE, trustState: 'APPROVED' as const, quoteExpiresAt: MANDATE.expiresAt, quoteVersion: 1 }
  const raw: ChargerOffer[] = [
    { ...common, quoteId: 'quote-chargenow-v1', operatorId: 'chargenow-central', operatorName: 'ChargeNow Central', chargerId: 'CN-08', detourMinutes: 2, queueMinutes: 17, powerKw: 50, basePriceSgdCents: 420, occupancyFeeSgdCentsPerMinute: 10, destinationAccount: 'rChargeNowFixturePayee', resourceId: 'resource-chargenow-8kwh', providerEstimateMinutes: 5, onwardTravelMinutes: 2, quoteHash: '' },
    { ...common, quoteId: 'quote-voltfast-v1', operatorId: 'voltfast-sg', operatorName: 'VoltFast SG-1042', chargerId: 'SG-1042', detourMinutes: 5, queueMinutes: 0, powerKw: 150, basePriceSgdCents: 740, occupancyFeeSgdCentsPerMinute: 20, destinationAccount: DEMO_PAYEE, resourceId: 'resource-voltfast-8kwh', providerEstimateMinutes: 5, onwardTravelMinutes: 1, quoteHash: '' },
    { ...common, quoteId: 'quote-rapidplug-v1', operatorId: 'rapidplug', operatorName: 'RapidPlug', chargerId: 'RP-77', detourMinutes: 3, queueMinutes: 0, powerKw: 120, basePriceSgdCents: 590, occupancyFeeSgdCentsPerMinute: 15, destinationAccount: DEMO_PAYEE, resourceId: 'resource-rapidplug-8kwh', providerEstimateMinutes: 5, onwardTravelMinutes: 1, quoteHash: '' },
  ]
  return raw.map((offer) => ({ ...offer, quoteHash: hash(canonicalQuote(offer)) }))
}

const OFFERS = seedOffers()
const OFFER_BY_ID = new Map(OFFERS.map((offer) => [offer.quoteId, offer]))

function buildRun(failureFixture: FailureFixture = 'happy'): Run {
  const now = timestamp()
  return {
    runId: makeId('run'), version: 0, state: 'READY', failureFixture, selectedOfferId: null, offersDiscovered: false, offersEvaluated: false,
    finalQuoteByOffer: Object.fromEntries(OFFERS.map((offer) => [offer.quoteId, offer])), assessments: [], creditDecision: null, paymentIntent: null,
    settlement: null, chargeSession: null, mission: { ...MISSION, predictedArrivalAt: null, status: 'AT_RISK' }, missionBefore: { ...MISSION, predictedArrivalAt: null, status: 'AT_RISK' },
    blockedQuoteEvidence: null, events: [], createdAt: now, updatedAt: now, noSignatureOrSubmission: true, receipt: null,
    llm: { provider: 'fixture', model: 'deterministic-fallback', fallback: true },
  }
}

function appendEvent(run: Run, actor: string, reasonCode: string, payload: Record<string, unknown>): void {
  const previousEventHash = run.events.at(-1)?.eventHash ?? 'GENESIS'
  const eventBase = { eventId: makeId('evt'), aggregateVersion: run.version, timestamp: timestamp(), actor, reasonCode, mode: modeLabel, previousEventHash, payload }
  const event: EventRecord = { ...eventBase, eventHash: hash(eventBase) }
  run.events.push(event)
  run.updatedAt = event.timestamp
}

function transition(run: Run, next: RunState, actor: string, reasonCode: string, payload: Record<string, unknown> = {}): void {
  if (!RUN_STATES.includes(next)) throw new Error(`Unknown state ${next}`)
  run.version += 1
  run.state = next
  appendEvent(run, actor, reasonCode, payload)
}

function transitionIf(run: Run, next: RunState, actor: string, reasonCode: string, payload: Record<string, unknown> = {}): void {
  if (run.state !== next) transition(run, next, actor, reasonCode, payload)
}

async function loadDocument(dataFile: string): Promise<StoreDocument> {
  try {
    const parsed = JSON.parse(await readFile(dataFile, 'utf8')) as StoreDocument
    if (parsed.run && parsed.idempotency) return parsed
  } catch { /* first run or a removed fixture file */ }
  const run = buildRun()
  appendEvent(run, 'scenario-service', 'SCENARIO_READY', { missionId: MISSION.missionId, mode: modeLabel })
  const document = { run, idempotency: {} }
  await saveDocument(dataFile, document)
  return document
}

async function saveDocument(dataFile: string, document: StoreDocument): Promise<void> {
  await mkdir(dirname(dataFile), { recursive: true })
  const temporary = `${dataFile}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(document, null, 2), 'utf8')
  await rename(temporary, dataFile)
}

function publicAssessment(assessment: OfferAssessment): OfferAssessment { return assessment }
function currentOffers(run: Run): ChargerOffer[] { return OFFERS.map((offer) => run.finalQuoteByOffer[offer.quoteId] ?? offer) }
function getAssessment(run: Run, offer: ChargerOffer): OfferAssessment { return run.assessments.find((item) => item.quoteId === offer.quoteId) ?? assessOffer(offer) }
function scenarioPayload(run: Run): Record<string, unknown> {
  const offers = currentOffers(run)
  return {
    run: { ...run, events: run.events }, mandate: MANDATE, vehicle: VEHICLE, offers, assessments: run.assessments.length ? run.assessments.map(publicAssessment) : offers.map((offer) => assessOffer(offer)),
    phaseIndex: phaseForState(run.state), phaseLabels: ['Mission risk', 'Compare', 'Safety check', 'Credit', 'Purchase', 'Charge', 'On schedule'], mode: modeLabel,
    config: { mode, modeLabel, network: process.env.XRPL_NETWORK ?? 'testnet', llmProvider: run.llm.provider, llmAvailable: Boolean(process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY), signerAvailable: Boolean(process.env.XRPL_PAYER_SEED) },
  }
}

function receiptFor(run: Run): MissionReceipt {
  const selected = run.selectedOfferId ? run.finalQuoteByOffer[run.selectedOfferId] : null
  return {
    receiptId: `receipt_${run.runId}`, modeLabel, mandateSnapshot: MANDATE, offerAssessments: run.assessments,
    blockedQuoteEvidence: run.blockedQuoteEvidence, creditDecision: run.creditDecision, paymentIntent: run.paymentIntent, settlement: run.settlement,
    chargeFulfilment: run.chargeSession, missionBefore: run.missionBefore, missionAfter: run.mission, limitations: [
      'Fixture underwriting is a contextual policy simulation, not a real lending decision.',
      'Fixture settlement is local evidence and is not a validated XRPL transaction.',
      'Delivered energy is simulated telemetry; it does not prove physical charger hardware.',
      'A payment proves the specified invoice binding only; it does not prove creditworthiness, merchant identity, or mission safety.',
    ], publicFields: ['mandate snapshot', 'quote assessments', 'reason codes', 'invoice binding', 'fixture settlement state', 'metered energy', 'mission recalculation'],
    privateFieldsExcluded: ['wallet seeds', 'provider secrets', 'private telemetry', 'model chain-of-thought'], eventCount: run.events.length,
  }
}

function errorBody(code: string, message: string, extra: Record<string, unknown> = {}): Record<string, unknown> { return { error: code, message, ...extra } }

function requestKey(req: Request): string { return String(req.header('Idempotency-Key') ?? req.body?.idempotencyKey ?? '') }

function createMutation(document: StoreDocument, req: Request, expectedVersion: number | undefined, operation: () => MutationResult): MutationResult {
  const key = requestKey(req)
  const requestHash = hash(req.body ?? {})
  if (key) {
    const previous = document.idempotency[key]
    if (previous && previous.requestHash !== requestHash) return { status: 409, body: errorBody('IDEMPOTENCY_CONFLICT', 'This idempotency key was reused with different input.') }
    if (previous) return { status: previous.status, body: previous.body }
  }
  if (expectedVersion !== undefined && expectedVersion !== document.run.version) return { status: 409, body: errorBody('VERSION_CONFLICT', 'This run changed in another tab. Refresh to review the current evidence.', { currentVersion: document.run.version }) }
  const result = operation()
  if (key) document.idempotency[key] = { requestHash, status: result.status, body: result.body }
  return result
}

function versionFromRequest(req: Request): number | undefined {
  const header = req.header('If-Match')
  if (!header) return undefined
  const parsed = Number(header.replaceAll('"', ''))
  return Number.isFinite(parsed) ? parsed : undefined
}

function chosenOffer(run: Run): ChargerOffer | null { return run.selectedOfferId ? run.finalQuoteByOffer[run.selectedOfferId] ?? null : null }

function compare(run: Run): void {
  if (run.state === 'READY') transition(run, 'RISK_DETECTED', 'mission-engine', 'MISSION_RISK_DETECTED', { batteryPercent: VEHICLE.batteryPercent, rangeKm: VEHICLE.remainingRangeKm, requiredRangeKm: MISSION.distanceRemainingKm + MISSION.requiredReserveKm })
  if (!run.offersDiscovered) { run.offersDiscovered = true; transition(run, 'OFFERS_DISCOVERED', 'offer-discovery-service', 'OFFERS_DISCOVERED', { offerCount: OFFERS.length }) }
  if (!run.offersEvaluated) {
    run.offersEvaluated = true; run.assessments = currentOffers(run).map((offer) => assessOffer(offer));
    run.llm = { provider: DEFAULT_LLM_PROVIDER, model: process.env.LLM_MODEL ?? (DEFAULT_LLM_PROVIDER === 'groq' ? 'llama-3.3-70b-versatile' : DEFAULT_LLM_PROVIDER === 'openai' ? 'gpt-4o-mini' : 'deterministic-fallback'), fallback: DEFAULT_LLM_PROVIDER === 'fixture' }
    transition(run, 'OFFERS_EVALUATED', 'deterministic-evaluator', 'OFFERS_EVALUATED', { selectedBy: 'deterministic-score', modelMayExplain: true })
  }
}

function finalizeRapidPlug(run: Run): MutationResult {
  compare(run)
  const initial = OFFER_BY_ID.get('quote-rapidplug-v1')!
  const final: ChargerOffer = { ...initial, quoteVersion: 2, occupancyFeeSgdCentsPerMinute: 45, destinationAccount: 'rRapidPlugChangedPayee', quoteHash: hash({ ...canonicalQuote(initial), quoteVersion: 2, occupancyFeeSgdCentsPerMinute: 45, destinationAccount: 'rRapidPlugChangedPayee' }) }
  run.finalQuoteByOffer[final.quoteId] = final
  run.assessments = currentOffers(run).map((offer) => assessOffer(offer))
  run.selectedOfferId = final.quoteId
  run.blockedQuoteEvidence = { quoteId: final.quoteId, discovered: canonicalQuote(initial), final: canonicalQuote(final), changes: ['occupancyFeeSgdCentsPerMinute: 15 → 45', 'destinationAccount: registered → changed payee'], noSignature: true, noSubmission: true }
  run.noSignatureOrSubmission = true
  transition(run, 'UNSAFE_QUOTE_BLOCKED', 'quote-verifier', 'BLOCKED_TERMS_CHANGED', { changedFields: ['occupancyFeeSgdCentsPerMinute', 'destinationAccount'], noMoneyMoved: true })
  return { status: 200, body: { ...scenarioPayload(run), quoteDiff: run.blockedQuoteEvidence } }
}

function selectOffer(run: Run, offerId: string | undefined): MutationResult {
  const offer = offerId ? run.finalQuoteByOffer[offerId] : null
  if (!offer) return { status: 404, body: errorBody('OFFER_NOT_FOUND', 'That charger offer is not available.') }
  const assessment = getAssessment(run, offer)
  if (!assessment.eligible) return { status: 422, body: errorBody('OFFER_INELIGIBLE', 'This offer cannot preserve the mission constraints.', { reasonCodes: assessment.hardFailureReasons }) }
  run.selectedOfferId = offer.quoteId
  transition(run, 'OFFER_SELECTED', 'decision-agent', 'ELIGIBLE_OFFER_SELECTED', { quoteId: offer.quoteId, score: assessment.score, explanation: assessment.explanation })
  return { status: 200, body: scenarioPayload(run) }
}

function requestCredit(run: Run): MutationResult {
  const offer = chosenOffer(run)
  if (!offer || run.state !== 'OFFER_SELECTED') return { status: 409, body: errorBody('CREDIT_REQUIRES_SELECTED_OFFER', 'Select an eligible charger before requesting mission credit.') }
  const requestedAmount = run.failureFixture === 'credit_denied' ? 1300 : offer.basePriceSgdCents
  transition(run, 'CREDIT_REQUESTED', 'credit-underwriter', 'CREDIT_REQUESTED', { requestedAmountSgdCents: requestedAmount, purpose: MANDATE.purpose })
  const decision = underwrite(offer, requestedAmount)
  run.creditDecision = decision
  if (decision.status === 'DENIED') { transition(run, 'CREDIT_DENIED', 'credit-underwriter', 'CREDIT_DENIED', { reasonCodes: decision.reasonCodes, simulated: true }); return { status: 200, body: scenarioPayload(run) } }
  transition(run, 'CREDIT_APPROVED', 'credit-underwriter', 'CREDIT_APPROVED', { approvedAmountSgdCents: decision.approvedAmountSgdCents, reasonCodes: decision.reasonCodes, simulated: true })
  return { status: 200, body: scenarioPayload(run) }
}

function authorizePayment(run: Run): MutationResult {
  const offer = chosenOffer(run)
  if (!offer || run.state !== 'CREDIT_APPROVED' || !run.creditDecision) return { status: 409, body: errorBody('PAYMENT_REQUIRES_APPROVAL', 'An approved, quote-bound credit authorization is required before purchase.') }
  const liveAssessment = assessOffer(offer)
  if (!liveAssessment.eligible || offer.destinationAccount !== offer.registeredDestinationAccount || offer.quoteVersion !== 1) {
    run.noSignatureOrSubmission = true
    transition(run, 'PAYMENT_REJECTED', 'mandate-guard', 'SIGNING_BLOCKED_QUOTE_MISMATCH', { noSignature: true, noSubmission: true })
    return { status: 409, body: errorBody('SIGNING_BLOCKED', 'Final terms no longer match the approved quote. No payment was signed or submitted.', { noSignature: true, noSubmission: true }) }
  }
  const payment: PaymentIntent = { paymentId: makeId('payment'), invoiceId: makeId('invoice'), quoteHash: offer.quoteHash, mandateId: MANDATE.mandateId, mandateVersion: MANDATE.version, creditDecisionId: run.creditDecision.decisionId, payer: 'fleetcredit-fixture-payer', destination: offer.destinationAccount, displayAmountSgdCents: offer.basePriceSgdCents, testnetAmountDrops: null, resourceId: offer.resourceId, expiresAt: MANDATE.expiresAt, idempotencyKey: makeId('payment-key'), state: 'AUTHORIZED', signerBoundary: 'server-only' }
  run.paymentIntent = payment
  run.noSignatureOrSubmission = false
  transition(run, 'PAYMENT_AUTHORIZED', 'payment-intent-service', 'PAYMENT_INTENT_AUTHORIZED', { invoiceId: payment.invoiceId, quoteHash: payment.quoteHash, resourceId: payment.resourceId, signerBoundary: 'server-only' })
  return { status: 200, body: scenarioPayload(run) }
}

function settlePayment(run: Run): MutationResult {
  if (!run.paymentIntent || run.state !== 'PAYMENT_AUTHORIZED') return { status: 409, body: errorBody('PAYMENT_REQUIRES_AUTHORIZATION', 'Authorize the exact charge before purchasing it.') }
  if (run.failureFixture === 'payment_unknown') {
    run.paymentIntent.state = 'UNKNOWN'; transition(run, 'PAYMENT_SUBMITTED', 'fixture-ledger', 'PAYMENT_SUBMITTED', { evidenceMode: 'fixture', noDuplicateRetry: true }); transition(run, 'PAYMENT_UNKNOWN', 'fixture-reconciler', 'PAYMENT_UNKNOWN', { reason: 'fixture_reconciliation_timeout', doNotDuplicate: true });
    run.settlement = { mode: 'fixture', transactionHash: null, submittedAt: timestamp(), validatedAt: null, ledgerIndex: null, engineResult: 'UNKNOWN', deliveredAmountDrops: 0, destination: run.paymentIntent.destination, invoiceId: run.paymentIntent.invoiceId, reconciliationStatus: 'UNKNOWN', evidenceMode: 'fixture' }
    return { status: 202, body: scenarioPayload(run) }
  }
  if (run.failureFixture === 'payment_failed') { run.paymentIntent.state = 'REJECTED'; transition(run, 'PAYMENT_REJECTED', 'fixture-ledger', 'PAYMENT_REJECTED', { reason: 'fixture_rail_unavailable', retrySafe: true }); return { status: 503, body: errorBody('PAYMENT_REJECTED', 'Fixture payment rail rejected the request. The quote and credit authorization remain inspectable.', { retrySafe: true, ...scenarioPayload(run) }) } }
  run.paymentIntent.state = 'SUBMITTED'; transition(run, 'PAYMENT_SUBMITTED', 'fixture-ledger', 'PAYMENT_SUBMITTED', { evidenceMode: 'fixture', invoiceId: run.paymentIntent.invoiceId })
  const settlement: Settlement = { mode: 'fixture', transactionHash: `fixture-tx-${run.paymentIntent.invoiceId}`, submittedAt: timestamp(), validatedAt: null, ledgerIndex: null, engineResult: 'NOT_APPLICABLE', deliveredAmountDrops: 0, destination: run.paymentIntent.destination, invoiceId: run.paymentIntent.invoiceId, reconciliationStatus: 'FIXTURE_SIMULATION', evidenceMode: 'fixture' }
  run.settlement = settlement; run.paymentIntent.state = 'SETTLED'; transition(run, 'PAYMENT_SETTLED', 'fixture-reconciler', 'FIXTURE_SETTLEMENT_RECORDED', { simulated: true, validated: false, engineResult: 'NOT_APPLICABLE', doNotRepresentAsLive: true });
  return { status: 200, body: scenarioPayload(run) }
}

function reconcilePayment(run: Run): MutationResult {
  if (run.state !== 'PAYMENT_UNKNOWN' || !run.paymentIntent) return { status: 409, body: errorBody('NO_UNKNOWN_PAYMENT', 'There is no unknown fixture payment to reconcile.') }
  run.paymentIntent.state = 'SETTLED'; run.settlement = { mode: 'fixture', transactionHash: `fixture-reconciled-${run.paymentIntent.invoiceId}`, submittedAt: timestamp(), validatedAt: null, ledgerIndex: null, engineResult: 'NOT_APPLICABLE', deliveredAmountDrops: 0, destination: run.paymentIntent.destination, invoiceId: run.paymentIntent.invoiceId, reconciliationStatus: 'FIXTURE_SIMULATION', evidenceMode: 'fixture' }
  transition(run, 'PAYMENT_SETTLED', 'fixture-reconciler', 'FIXTURE_PAYMENT_RECONCILED', { noDuplicateSubmit: true, simulated: true })
  return { status: 200, body: scenarioPayload(run) }
}

function reserve(run: Run): MutationResult {
  if (run.state !== 'PAYMENT_SETTLED' || !run.paymentIntent || !run.settlement) return { status: 402, body: errorBody('PAYMENT_REQUIRED', 'The protected charger resource requires reconciled settlement evidence before reservation.', { challenge: { invoiceId: run.paymentIntent?.invoiceId ?? null, resourceId: chosenOffer(run)?.resourceId ?? null } }) }
  if (run.chargeSession) return { status: 200, body: scenarioPayload(run) }
  run.chargeSession = { sessionId: makeId('charge'), reservationToken: `fixture-reservation-${randomUUID().slice(0, 8)}`, chargerId: chosenOffer(run)?.chargerId ?? 'unknown', lifecycle: 'RESERVED', connectedAt: null, deliveredKwh: 0, initialBatteryPercent: VEHICLE.batteryPercent, finalBatteryPercent: null, stopReason: null, fulfilmentState: 'AWAITING_VEHICLE' }
  transition(run, 'RESERVED', 'charger-provider-adapter', 'RESERVATION_UNLOCKED_AFTER_SETTLEMENT', { resourceId: chosenOffer(run)?.resourceId, evidenceMode: 'fixture' })
  return { status: 201, body: scenarioPayload(run) }
}

function advanceCharge(run: Run): MutationResult {
  if (!run.chargeSession || !run.settlement || (run.state !== 'RESERVED' && run.state !== 'VEHICLE_EN_ROUTE_TO_CHARGER' && run.state !== 'ARRIVED' && run.state !== 'CONNECTED' && run.state !== 'CHARGING' && run.state !== 'ENERGY_DELIVERED' && run.state !== 'MISSION_RESTORED')) return { status: 409, body: errorBody('CHARGE_NOT_READY', 'Reserve the protected charger resource after settlement before starting charge.') }
  const session = run.chargeSession
  if (run.failureFixture === 'charger_failure' && run.state === 'ARRIVED') { session.lifecycle = 'EXCEPTION'; session.fulfilmentState = 'SETTLED_FULFILMENT_EXCEPTION'; session.stopReason = 'charger_offline_before_connection'; transition(run, 'SETTLED_FULFILMENT_EXCEPTION', 'charger-provider-adapter', 'CHARGER_UNAVAILABLE', { settlementPreserved: true, refundNotClaimed: true }); return { status: 200, body: scenarioPayload(run) } }
  if (run.state === 'RESERVED') { session.lifecycle = 'VEHICLE_EN_ROUTE_TO_CHARGER'; session.fulfilmentState = 'EN_ROUTE'; transition(run, 'VEHICLE_EN_ROUTE_TO_CHARGER', 'charger-provider-adapter', 'VEHICLE_EN_ROUTE_TO_CHARGER'); }
  else if (run.state === 'VEHICLE_EN_ROUTE_TO_CHARGER') { session.lifecycle = 'ARRIVED'; session.fulfilmentState = 'ARRIVED'; transition(run, 'ARRIVED', 'charger-provider-adapter', 'VEHICLE_ARRIVED'); }
  else if (run.state === 'ARRIVED') { session.lifecycle = 'CONNECTED'; session.connectedAt = timestamp(); session.fulfilmentState = 'CONNECTED'; transition(run, 'CONNECTED', 'charger-provider-adapter', 'VEHICLE_CONNECTED'); }
  else if (run.state === 'CONNECTED') { session.lifecycle = 'CHARGING'; session.fulfilmentState = 'METERING'; transition(run, 'CHARGING', 'charger-provider-adapter', 'CHARGING_STARTED'); }
  else if (run.state === 'CHARGING') {
    const delivered = Math.min(8, session.deliveredKwh + 2); session.deliveredKwh = delivered; session.finalBatteryPercent = Number((VEHICLE.batteryPercent + batteryKwh(delivered) / VEHICLE.usableCapacityKwh * 100).toFixed(1));
    appendEvent(run, 'charger-provider-adapter', 'METER_EVENT', { deliveredKwh: delivered, batteryPercent: session.finalBatteryPercent, independentlyMeasured: true });
    if (delivered >= 8) { session.lifecycle = 'ENERGY_DELIVERED'; session.fulfilmentState = '8_KWH_DELIVERED'; transition(run, 'ENERGY_DELIVERED', 'fulfilment-evaluator', 'ENERGY_DELIVERED', { deliveredKwh: delivered, batteryPercent: session.finalBatteryPercent }) }
  } else if (run.state === 'ENERGY_DELIVERED') {
    const offer = chosenOffer(run)!; run.mission = { ...run.mission, predictedArrivalAt: arrivalAt(offer), status: 'RESTORED' }; session.lifecycle = 'ROUTE_RECALCULATED'; session.fulfilmentState = 'ROUTE_RECALCULATED'; transition(run, 'MISSION_RESTORED', 'mission-engine', 'MISSION_RESTORED', { predictedArrivalAt: run.mission.predictedArrivalAt, projectedBatteryPercent: session.finalBatteryPercent, reserveKm: 32.3 });
  } else if (run.state === 'MISSION_RESTORED') { run.receipt = receiptFor(run); transition(run, 'RECEIPT_READY', 'receipt-service', 'RECEIPT_READY', { receiptId: run.receipt.receiptId, eventCount: run.events.length }); }
  return { status: 200, body: scenarioPayload(run) }
}

function retryFulfilment(run: Run): MutationResult {
  if (run.state !== 'SETTLED_FULFILMENT_EXCEPTION' || !run.chargeSession) return { status: 409, body: errorBody('NO_FULFILMENT_EXCEPTION', 'There is no charger exception to retry.') }
  run.failureFixture = 'happy'; run.chargeSession.lifecycle = 'RESERVED'; run.chargeSession.fulfilmentState = 'AWAITING_VEHICLE'; run.chargeSession.stopReason = null
  transition(run, 'RESERVED', 'operator', 'ALTERNATE_STATION_RETRY', { settlementPreserved: true, refundStatus: 'not_claimed' })
  return { status: 200, body: scenarioPayload(run) }
}

function back(run: Run): MutationResult {
  const previous: Partial<Record<RunState, RunState>> = { UNSAFE_QUOTE_BLOCKED: 'OFFERS_EVALUATED', OFFER_SELECTED: 'UNSAFE_QUOTE_BLOCKED', CREDIT_APPROVED: 'OFFER_SELECTED', CREDIT_DENIED: 'OFFER_SELECTED', PAYMENT_AUTHORIZED: 'CREDIT_APPROVED' }
  const prior = previous[run.state]
  if (!prior) return { status: 409, body: errorBody('BACK_NOT_AVAILABLE', 'Back is available while reviewing a decision, before payment.') }
  transition(run, prior, 'operator', 'REVIEW_MOVED_BACK', { from: run.state })
  return { status: 200, body: scenarioPayload(run) }
}

function createApp(options: { dataFile?: string } = {}) {
  const dataFile = options.dataFile ?? DATA_FILE
  const app = express()
  app.use(express.json({ limit: '64kb' }))
  app.use((_req, res, next) => { res.setHeader('X-FleetCredit-Mode', modeLabel); next() })

  let documentPromise = loadDocument(dataFile)
  const getDocument = async (): Promise<StoreDocument> => documentPromise
  const persist = async (): Promise<void> => { await saveDocument(dataFile, await getDocument()) }
  const runMutation = async (req: Request, res: Response, operation: (document: StoreDocument) => MutationResult): Promise<void> => {
    const document = await getDocument()
    const result = createMutation(document, req, versionFromRequest(req), () => operation(document))
    await persist()
    res.status(result.status).json(result.body)
  }
  const handler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res, next)).catch(next) }

  app.get('/api/health', (_req, res) => res.json({ ok: true, mode: modeLabel, network: process.env.XRPL_NETWORK ?? 'testnet', signer: Boolean(process.env.XRPL_PAYER_SEED), llmProvider: DEFAULT_LLM_PROVIDER }))
  app.get('/api/v1/config/public', (_req, res) => res.json({ mode, modeLabel, network: process.env.XRPL_NETWORK ?? 'testnet', llmProvider: DEFAULT_LLM_PROVIDER, llmAvailable: DEFAULT_LLM_PROVIDER !== 'fixture', liveSignerConfigured: Boolean(process.env.XRPL_PAYER_SEED) }))
  app.get('/api/v1/scenarios/swiftmed', handler(async (_req, res) => res.json(scenarioPayload((await getDocument()).run))))
  app.post('/api/v1/scenarios/swiftmed/reset', handler(async (req, res) => {
    const document = await getDocument(); const failureFixture = FAILURE_FIXTURES.includes(req.body?.failureFixture) ? req.body.failureFixture as FailureFixture : 'happy';
    document.run = buildRun(failureFixture); document.idempotency = {}; appendEvent(document.run, 'scenario-service', 'SCENARIO_RESET', { failureFixture, mode: modeLabel }); await persist(); res.json(scenarioPayload(document.run))
  }))
  app.post('/api/v1/scenarios/swiftmed/step', handler(async (req, res) => {
    const parsed = z.object({ action: z.string(), offerId: z.string().optional() }).safeParse(req.body)
    if (!parsed.success) { res.status(400).json(errorBody('INVALID_STEP', 'The requested step is not valid.')); return }
    await runMutation(req, res, (document) => {
      const { action, offerId } = parsed.data; const run = document.run
      if (action === 'compare') { compare(run); return { status: 200, body: scenarioPayload(run) } }
      if (action === 'block-quote') return finalizeRapidPlug(run)
      if (action === 'select') return selectOffer(run, offerId)
      if (action === 'credit') return requestCredit(run)
      if (action === 'authorize') return authorizePayment(run)
      if (action === 'pay') return settlePayment(run)
      if (action === 'reconcile') return reconcilePayment(run)
      if (action === 'reserve') return reserve(run)
      if (action === 'advance') return advanceCharge(run)
      if (action === 'retry-fulfilment') return retryFulfilment(run)
      if (action === 'back') return back(run)
      if (action === 'receipt' && run.state === 'MISSION_RESTORED') { run.receipt = receiptFor(run); transition(run, 'RECEIPT_READY', 'receipt-service', 'RECEIPT_READY', { receiptId: run.receipt.receiptId }); return { status: 200, body: scenarioPayload(run) } }
      return { status: 400, body: errorBody('UNKNOWN_STEP', 'That mission step is not available in the current state.', { state: run.state }) }
    })
  }))
  app.get('/api/v1/runs/:runId', handler(async (req, res) => { const run = (await getDocument()).run; if (run.runId !== req.params.runId) { res.status(404).json(errorBody('RUN_NOT_FOUND', 'Run not found.')); return } res.json(scenarioPayload(run)) }))
  app.get('/api/v1/runs/:runId/events', handler(async (req, res) => { const run = (await getDocument()).run; if (run.runId !== req.params.runId) { res.status(404).json(errorBody('RUN_NOT_FOUND', 'Run not found.')); return } res.json({ events: run.events, version: run.version }) }))
  app.get('/api/v1/runs/:runId/stream', handler(async (req, res) => {
    const run = (await getDocument()).run; if (run.runId !== req.params.runId) { res.status(404).json(errorBody('RUN_NOT_FOUND', 'Run not found.')); return }
    res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive');
    const lastId = Number(req.header('Last-Event-ID') ?? 0); for (const event of run.events.filter((_item, index) => index >= lastId)) res.write(`id: ${event.aggregateVersion}\nevent: ${event.reasonCode}\ndata: ${JSON.stringify(event)}\n\n`)
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000); req.on('close', () => clearInterval(heartbeat))
  }))
  app.post('/api/v1/runs/:runId/discover', handler(async (req, res) => runMutation(req, res, (document) => { compare(document.run); return { status: 200, body: scenarioPayload(document.run) } })))
  app.post('/api/v1/runs/:runId/evaluate', handler(async (req, res) => runMutation(req, res, (document) => { compare(document.run); return { status: 200, body: scenarioPayload(document.run) } })))
  app.post('/api/v1/runs/:runId/select', handler(async (req, res) => runMutation(req, res, (document) => selectOffer(document.run, req.body?.offerId))))
  app.post('/api/v1/runs/:runId/quotes/:quoteId/finalize', handler(async (req, res) => runMutation(req, res, (document) => req.params.quoteId === 'quote-rapidplug-v1' ? finalizeRapidPlug(document.run) : { status: 400, body: errorBody('QUOTE_NOT_CHANGING', 'Only the RapidPlug rehearsal quote has a changed final term.') })))
  app.post('/api/v1/runs/:runId/credit-requests', handler(async (req, res) => runMutation(req, res, (document) => requestCredit(document.run))))
  app.post('/api/v1/runs/:runId/payment-intents', handler(async (req, res) => runMutation(req, res, (document) => authorizePayment(document.run))))
  app.post('/api/v1/runs/:runId/payments', handler(async (req, res) => runMutation(req, res, (document) => settlePayment(document.run))))
  app.get('/api/v1/runs/:runId/payments/:paymentId', handler(async (req, res) => { const run = (await getDocument()).run; if (run.paymentIntent?.paymentId !== req.params.paymentId) { res.status(404).json(errorBody('PAYMENT_NOT_FOUND', 'Payment intent not found.')); return } res.json({ paymentIntent: run.paymentIntent, settlement: run.settlement, mode: modeLabel }) }))
  app.post('/api/v1/runs/:runId/reservations', handler(async (req, res) => runMutation(req, res, (document) => reserve(document.run))))
  app.post('/api/v1/runs/:runId/charge-sessions/:id/advance', handler(async (req, res) => runMutation(req, res, (document) => { if (document.run.chargeSession?.sessionId !== req.params.id) return { status: 404, body: errorBody('CHARGE_SESSION_NOT_FOUND', 'Charge session not found.') }; return advanceCharge(document.run) })))
  app.get('/api/v1/runs/:runId/receipt', handler(async (req, res) => { const run = (await getDocument()).run; if (run.runId !== req.params.runId) { res.status(404).json(errorBody('RUN_NOT_FOUND', 'Run not found.')); return } if (!run.receipt && run.state === 'MISSION_RESTORED') { run.receipt = receiptFor(run); await persist() } if (!run.receipt) { res.status(409).json(errorBody('RECEIPT_NOT_READY', 'The receipt is available after mission restoration.')); return } res.json({ receipt: run.receipt }) }))
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => { console.error('FleetCredit request error', error); res.status(500).json(errorBody('INTERNAL_ERROR', 'The local service could not complete that request.')) })
  return app
}

if (process.argv[1]?.endsWith('server/index.ts')) {
  createApp().listen(PORT, '0.0.0.0', () => console.log(`FleetCredit API ${modeLabel} · http://localhost:${PORT}`))
}

export { createApp, buildRun, seedOffers, OFFERS, modeLabel }
