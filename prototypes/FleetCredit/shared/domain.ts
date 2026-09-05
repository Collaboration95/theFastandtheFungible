import { z } from 'zod'

export const RUN_STATES = [
  'READY', 'RISK_DETECTED', 'OFFERS_DISCOVERED', 'OFFERS_EVALUATED', 'UNSAFE_QUOTE_BLOCKED',
  'OFFER_SELECTED', 'CREDIT_REQUESTED', 'CREDIT_APPROVED', 'CREDIT_DENIED', 'PAYMENT_AUTHORIZED',
  'PAYMENT_SUBMITTED', 'PAYMENT_SETTLED', 'PAYMENT_UNKNOWN', 'PAYMENT_REJECTED', 'RESERVED',
  'VEHICLE_EN_ROUTE_TO_CHARGER', 'ARRIVED', 'CONNECTED', 'CHARGING', 'ENERGY_DELIVERED',
  'MISSION_RESTORED', 'RECEIPT_READY', 'SETTLED_FULFILMENT_EXCEPTION', 'CHARGER_UNAVAILABLE',
  'MISSION_FAILED', 'CANCELLED',
] as const
export type RunState = typeof RUN_STATES[number]

export const FAILURE_FIXTURES = ['happy', 'credit_denied', 'payment_unknown', 'charger_failure'] as const
export type FailureFixture = typeof FAILURE_FIXTURES[number]

export const PHASES = ['Mission risk', 'Compare', 'Safety check', 'Credit', 'Purchase', 'Charge', 'On schedule'] as const
export type PhaseLabel = typeof PHASES[number]

export const MANDATE = {
  mandateId: 'mandate_swiftmed_v204_med4182_v1', version: 1, fleetId: 'swiftmed', vehicleId: 'V-204', dispatchId: 'MED-4182',
  purpose: 'MISSION_ENERGY', maxSpendSgdCents: 1200, maxBorrowSgdCents: 1200, minReserveKm: 10,
  maxOccupancyFeeSgdCentsPerMinute: 20, allowedOperatorIds: ['voltfast-sg'], allowedConnector: 'CCS2',
  expiresAt: '2026-09-05T19:22:00+08:00',
} as const
export type MissionMandate = typeof MANDATE

export const MISSION = {
  missionId: 'MED-4182', fleetId: 'swiftmed', vehicleId: 'V-204', cargoClass: 'TEMPERATURE_SENSITIVE_MEDICAL', destinationLabel: 'NUS Hospital',
  deadlineAt: '2026-09-05T19:15:00+08:00', timezone: 'Asia/Singapore', distanceRemainingKm: 28, requiredReserveKm: 10,
  predictedArrivalAt: null, status: 'AT_RISK' as const, referenceTime: '2026-09-05T18:58:00+08:00',
}
export type Mission = Omit<typeof MISSION, 'predictedArrivalAt' | 'status'> & { predictedArrivalAt: string | null; status: 'ON_TRACK' | 'AT_RISK' | 'IMPOSSIBLE' | 'RESTORED' | 'FAILED' }

export const VEHICLE = {
  vehicleId: 'V-204', fleetId: 'swiftmed', batteryPercent: 8, usableCapacityKwh: 53.33, averageConsumptionKwhPerKm: 0.203,
  remainingRangeKm: 21, connector: 'CCS2' as const, operatingBalanceSgdCents: 0, telemetryFreshnessSeconds: 24, sourceMode: 'fixture',
}

export type ChargerOffer = {
  quoteId: string; operatorId: string; operatorName: string; chargerId: string; connector: 'CCS2' | 'CHAdeMO'; detourMinutes: number;
  detourKm: number; queueMinutes: number; powerKw: number; energyKwh: number; basePriceSgdCents: number;
  occupancyFeeSgdCentsPerMinute: number; destinationAccount: string; registeredDestinationAccount: string; trustState: 'APPROVED' | 'REVIEW';
  quoteExpiresAt: string; resourceId: string; quoteVersion: number; quoteHash: string; providerEstimateMinutes: number; onwardTravelMinutes: number;
}

export type OfferAssessment = {
  quoteId: string; projectedArrivalAt: string; projectedReserveKm: number; eligible: boolean; hardFailureReasons: string[];
  totalExpectedCostSgdCents: number; uncertaintyFlags: string[]; scoreComponents: { arrivalMargin: number; reserveMargin: number; trust: number; costEfficiency: number; quoteStability: number }; score: number; explanation: string;
}

export type CreditDecision = {
  decisionId: string; status: 'APPROVED' | 'DENIED' | 'REVIEW_REQUIRED'; requestedAmountSgdCents: number; approvedAmountSgdCents: number;
  reasonCodes: string[]; evidenceSnapshotHash: string; exposureCapSgdCents: number; merchantRestriction: string; purposeRestriction: string;
  expiresAt: string; decisionEngineVersion: string; simulated: true; evidence: Array<{ label: string; result: 'PASS' | 'FAIL'; detail: string }>;
}

export type PaymentIntent = {
  paymentId: string; invoiceId: string; quoteHash: string; mandateId: string; mandateVersion: number; creditDecisionId: string;
  payer: string; destination: string; displayAmountSgdCents: number; testnetAmountDrops: number | null; resourceId: string; expiresAt: string;
  idempotencyKey: string; state: 'AUTHORIZED' | 'SUBMITTED' | 'SETTLED' | 'UNKNOWN' | 'REJECTED'; signerBoundary: 'server-only';
}

export type Settlement = {
  mode: 'fixture' | 'recorded-testnet' | 'live-testnet'; transactionHash: string | null; submittedAt: string; validatedAt: string | null;
  ledgerIndex: number | null; engineResult: string; deliveredAmountDrops: number; destination: string; invoiceId: string; reconciliationStatus: 'FIXTURE_SIMULATION' | 'RECORDED_EVIDENCE' | 'VALIDATED' | 'UNKNOWN'; evidenceMode: 'fixture' | 'recorded' | 'live-testnet';
}

export type ChargeSession = {
  sessionId: string; reservationToken: string | null; chargerId: string; lifecycle: string; connectedAt: string | null;
  deliveredKwh: number; initialBatteryPercent: number; finalBatteryPercent: number | null; stopReason: string | null; fulfilmentState: string;
}

export type EventRecord = { eventId: string; aggregateVersion: number; timestamp: string; actor: string; reasonCode: string; mode: string; previousEventHash: string; eventHash: string; payload: Record<string, unknown> }

export type MissionReceipt = {
  receiptId: string; modeLabel: string; mandateSnapshot: MissionMandate; offerAssessments: OfferAssessment[]; blockedQuoteEvidence: Record<string, unknown> | null;
  creditDecision: CreditDecision | null; paymentIntent: PaymentIntent | null; settlement: Settlement | null; chargeFulfilment: ChargeSession | null;
  missionBefore: Mission; missionAfter: Mission; limitations: string[]; publicFields: string[]; privateFieldsExcluded: string[]; eventCount: number;
}

export type Run = {
  runId: string; version: number; state: RunState; failureFixture: FailureFixture; selectedOfferId: string | null; offersDiscovered: boolean; offersEvaluated: boolean;
  finalQuoteByOffer: Record<string, ChargerOffer>; assessments: OfferAssessment[]; creditDecision: CreditDecision | null; paymentIntent: PaymentIntent | null;
  settlement: Settlement | null; chargeSession: ChargeSession | null; mission: Mission; missionBefore: Mission; blockedQuoteEvidence: Record<string, unknown> | null;
  events: EventRecord[]; createdAt: string; updatedAt: string; noSignatureOrSubmission: boolean; receipt: MissionReceipt | null; llm: { provider: string; model: string; fallback: boolean };
}

export const StepRequest = z.object({ action: z.string(), offerId: z.string().optional(), scenario: z.enum(FAILURE_FIXTURES).optional() })
export type StepRequest = z.infer<typeof StepRequest>

export function money(cents: number): string { return `S$${(cents / 100).toFixed(2)}` }
export function formatTime(iso: string | null): string { return iso ? new Intl.DateTimeFormat('en-SG', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Singapore' }).format(new Date(iso)) : '—' }
export function formatDateTime(iso: string | null): string { return iso ? new Intl.DateTimeFormat('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Singapore' }).format(new Date(iso)) : '—' }

export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
}

export function batteryKwh(percent: number): number { return (VEHICLE.usableCapacityKwh * percent) / 100 }
export function availableRangeKm(percent: number): number { return Number((batteryKwh(percent) / VEHICLE.averageConsumptionKwhPerKm).toFixed(1)) }
export function requiredRangeKm(): number { return MISSION.distanceRemainingKm + MISSION.requiredReserveKm }
export function energyDeficitKwh(percent: number = VEHICLE.batteryPercent): number { return Number(Math.max(0, requiredRangeKm() * VEHICLE.averageConsumptionKwhPerKm - batteryKwh(percent)).toFixed(1)) }
export function requiredEnergyKwh(percent: number = VEHICLE.batteryPercent): number { return Math.max(8, energyDeficitKwh(percent)) }
export function chargeMinutes(offer: ChargerOffer, energyKwh = 8): number { return Math.ceil(Math.min(offer.providerEstimateMinutes, energyKwh / offer.powerKw * 60 + 1)) }
export function arrivalAt(offer: ChargerOffer, energyKwh = 8): string {
  const minutes = offer.detourMinutes + offer.queueMinutes + chargeMinutes(offer, energyKwh) + offer.onwardTravelMinutes
  return new Date(new Date(MISSION.referenceTime).getTime() + minutes * 60_000).toISOString()
}
export function projectedReserveKm(offer: ChargerOffer, energyKwh = 8): number { return Number((availableRangeKm(VEHICLE.batteryPercent + energyKwh / VEHICLE.usableCapacityKwh * 100) - MISSION.distanceRemainingKm).toFixed(1)) }

export function canonicalQuote(offer: ChargerOffer): Record<string, unknown> {
  return { quoteId: offer.quoteId, operatorId: offer.operatorId, chargerId: offer.chargerId, connector: offer.connector, energyKwh: offer.energyKwh, basePriceSgdCents: offer.basePriceSgdCents, occupancyFeeSgdCentsPerMinute: offer.occupancyFeeSgdCentsPerMinute, destinationAccount: offer.destinationAccount, resourceId: offer.resourceId, quoteVersion: offer.quoteVersion, quoteExpiresAt: offer.quoteExpiresAt }
}

export function assessOffer(offer: ChargerOffer, mandate: MissionMandate = MANDATE): OfferAssessment {
  const arrival = arrivalAt(offer)
  const reserve = projectedReserveKm(offer)
  const reasons: string[] = []
  if (offer.connector !== mandate.allowedConnector) reasons.push('CONNECTOR_MISMATCH')
  if (!mandate.allowedOperatorIds.includes(offer.operatorId)) reasons.push('OPERATOR_NOT_APPROVED')
  if (offer.occupancyFeeSgdCentsPerMinute > mandate.maxOccupancyFeeSgdCentsPerMinute) reasons.push('OCCUPANCY_FEE_ABOVE_LIMIT')
  if (offer.destinationAccount !== offer.registeredDestinationAccount) reasons.push('DESTINATION_MISMATCH')
  if (new Date(offer.quoteExpiresAt) <= new Date(MISSION.referenceTime)) reasons.push('QUOTE_EXPIRED')
  if (reserve < mandate.minReserveKm) reasons.push('RESERVE_BELOW_MANDATE')
  if (new Date(arrival) > new Date(MISSION.deadlineAt)) reasons.push('MISSES_DEADLINE')
  const arrivalMargin = Math.max(0, Math.min(1, (new Date(MISSION.deadlineAt).getTime() - new Date(arrival).getTime()) / 900_000))
  const reserveMargin = Math.max(0, Math.min(1, (reserve - mandate.minReserveKm) / 25))
  const trust = offer.trustState === 'APPROVED' ? 1 : 0.35
  const costEfficiency = Math.max(0, Math.min(1, 1 - (offer.basePriceSgdCents / mandate.maxSpendSgdCents)))
  const quoteStability = offer.quoteVersion === 1 ? 1 : 0.25
  const score = 0.4 * arrivalMargin + 0.2 * reserveMargin + 0.15 * trust + 0.15 * costEfficiency + 0.1 * quoteStability
  const eligible = reasons.length === 0
  const explanation = offer.operatorId === 'chargenow-central' ? 'Cheapest, but the queue makes the delivery late.' : offer.operatorId === 'voltfast-sg' ? 'Cheapest eligible option that preserves the deadline and reserve.' : eligible ? 'Appears eligible; final terms must be checked before signing.' : 'Final terms exceed the mandate or the payee no longer matches the approved operator. No money moved.'
  return { quoteId: offer.quoteId, projectedArrivalAt: arrival, projectedReserveKm: reserve, eligible, hardFailureReasons: reasons, totalExpectedCostSgdCents: offer.basePriceSgdCents, uncertaintyFlags: offer.trustState === 'REVIEW' ? ['MERCHANT_REVIEW'] : [], scoreComponents: { arrivalMargin: Number(arrivalMargin.toFixed(2)), reserveMargin: Number(reserveMargin.toFixed(2)), trust, costEfficiency: Number(costEfficiency.toFixed(2)), quoteStability }, score: Number(score.toFixed(3)), explanation }
}

export type MandateCheck = { code: string; result: 'PASS' | 'FAIL'; detail: string }
export function evaluateMandate(offer: ChargerOffer | null, amountCents: number, purpose = MANDATE.purpose, mandate: MissionMandate = MANDATE): MandateCheck[] {
  const checks: MandateCheck[] = [
    { code: 'ACTIVE_MISSION', result: 'PASS', detail: `${mandate.dispatchId} is active and energy is necessary.` },
    { code: 'FLEET_IDENTITY_VERIFIED', result: 'PASS', detail: 'SwiftMed registry verifies V-204 ownership.' },
    { code: 'AMOUNT_WITHIN_CAP', result: amountCents <= mandate.maxSpendSgdCents ? 'PASS' : 'FAIL', detail: `${money(amountCents)} requested against ${money(mandate.maxSpendSgdCents)} maximum.` },
    { code: 'PURPOSE_ENERGY_ONLY', result: purpose === mandate.purpose ? 'PASS' : 'FAIL', detail: purpose === mandate.purpose ? 'One charger authorization only.' : 'The request is not mission energy.' },
    { code: 'MERCHANT_APPROVED', result: offer && mandate.allowedOperatorIds.includes(offer.operatorId) ? 'PASS' : 'FAIL', detail: offer?.operatorName ?? 'No approved merchant selected.' },
    { code: 'QUOTE_PAYEE_BOUND', result: offer && offer.destinationAccount === offer.registeredDestinationAccount ? 'PASS' : 'FAIL', detail: offer ? 'Quote destination matches the registered operator.' : 'Quote evidence missing.' },
    { code: 'TELEMETRY_FRESH', result: VEHICLE.telemetryFreshnessSeconds <= 60 ? 'PASS' : 'FAIL', detail: `Telemetry is ${VEHICLE.telemetryFreshnessSeconds}s old.` },
  ]
  return checks
}

export function underwrite(offer: ChargerOffer | null, requestedAmountCents: number, mandate: MissionMandate = MANDATE): CreditDecision {
  const checks = evaluateMandate(offer, requestedAmountCents, mandate.purpose, mandate)
  const failing = checks.filter((check) => check.result === 'FAIL').map((check) => check.code)
  const status = failing.length ? 'DENIED' : 'APPROVED'
  const approved = status === 'APPROVED' ? Math.min(requestedAmountCents, 800, mandate.maxBorrowSgdCents) : 0
  return { decisionId: `credit_${mandate.dispatchId.toLowerCase()}_${Date.now().toString(36)}`, status, requestedAmountSgdCents: requestedAmountCents, approvedAmountSgdCents: approved, reasonCodes: failing.length ? failing : ['VERIFIED_FLEET', 'ACTIVE_MISSION', 'NECESSARY_ENERGY', 'APPROVED_MERCHANT', 'BOUNDED_EXPOSURE'], evidenceSnapshotHash: 'sha256:fixture-evidence-v204-med4182', exposureCapSgdCents: 800, merchantRestriction: offer?.operatorName ?? 'none', purposeRestriction: '8 kWh mission-energy authorization only', expiresAt: mandate.expiresAt, decisionEngineVersion: 'fleetcredit-policy-v1', simulated: true, evidence: checks.map((check) => ({ label: check.code.replaceAll('_', ' ').toLowerCase(), result: check.result, detail: check.detail })) }
}

export function phaseForState(state: RunState): number {
  if (state === 'READY' || state === 'RISK_DETECTED') return 0
  if (state === 'OFFERS_DISCOVERED' || state === 'OFFERS_EVALUATED') return 1
  if (state === 'UNSAFE_QUOTE_BLOCKED') return 2
  if (state === 'OFFER_SELECTED' || state === 'CREDIT_REQUESTED' || state === 'CREDIT_APPROVED' || state === 'CREDIT_DENIED') return 3
  if (state === 'PAYMENT_AUTHORIZED' || state === 'PAYMENT_SUBMITTED' || state === 'PAYMENT_SETTLED' || state === 'PAYMENT_UNKNOWN' || state === 'PAYMENT_REJECTED') return 4
  if (state === 'RESERVED' || state === 'VEHICLE_EN_ROUTE_TO_CHARGER' || state === 'ARRIVED' || state === 'CONNECTED' || state === 'CHARGING' || state === 'ENERGY_DELIVERED' || state === 'SETTLED_FULFILMENT_EXCEPTION' || state === 'CHARGER_UNAVAILABLE') return 5
  return 6
}
