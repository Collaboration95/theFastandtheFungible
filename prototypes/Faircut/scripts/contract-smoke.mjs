const base = process.env.FAIRCUT_BASE_URL ?? 'http://localhost:8787'
const project = '/api/projects/project_japan_travel_20s'
const purchase = '/api/purchases/purchase_dawn_current_12s'
const master = '/api/providers/mika-direct/assets/sku_dawn-current_12s_clean/master'

async function request(path, init = {}) {
  const response = await fetch(base + path, { headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }, ...init })
  return { response, body: await response.json().catch(() => ({})) }
}

const post = (path, body = {}) => request(path, { method: 'POST', body: JSON.stringify(body) })
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const prepareEligible = async () => {
  await post('/api/demo/reset')
  await post(`${project}/discover`)
  await post(`${project}/evaluate`)
  await post(`${project}/select`, { candidateId: 'dawn-current' })
  await post(`${purchase}/authorize`)
}

const idempotencyKey = 'contract-idempotency-check'
const firstReset = await post('/api/demo/reset', { idempotencyKey })
const replayReset = await post('/api/demo/reset', { idempotencyKey })
const idempotencyConflict = await post('/api/demo/reset', { idempotencyKey, differentBody: true })
assert(firstReset.response.status === 200 && replayReset.response.status === 200 && replayReset.body.receiptSummary.eventHeadHash === firstReset.body.receiptSummary.eventHeadHash, 'same idempotency key must replay the original response')
assert(idempotencyConflict.response.status === 409 && idempotencyConflict.body.state === 'IDEMPOTENCY_CONFLICT', 'reused idempotency key with changed body must conflict')
await post('/api/demo/reset')
const challenge = await fetch(base + master, { redirect: 'manual' })
assert(challenge.status === 402 && challenge.headers.get('PAYMENT-REQUIRED'), 'clean master must challenge before payment')
const challengePayload = JSON.parse(Buffer.from(challenge.headers.get('PAYMENT-REQUIRED'), 'base64').toString('utf8'))
const accepted = challengePayload.accepted?.[0]
assert(challengePayload.x402Version === 2 && accepted?.scheme === 'exact' && accepted.network === 'xrpl:1' && accepted.asset === 'XRP', 'x402 challenge must pin version, scheme, network, and asset')
assert(accepted.amount === '8000' && accepted.extra?.sourceTag === 804681468 && accepted.extra?.resourceSku === 'sku_dawn-current_12s_clean', 'x402 challenge must pin amount, source tag, and resource')
assert(accepted.extra?.invoiceId && accepted.extra?.rightsPolicyHash && accepted.extra?.assetHash, 'x402 challenge must carry invoice and frozen evidence bindings')
await post(`${project}/discover`)
await post(`${project}/evaluate`)
const blocked = await post(`${purchase}/authorize`)
assert(blocked.response.status === 403 && blocked.body.reasonCodes.length === 3, 'blocked favorite must fail closed')

await prepareEligible()
await post('/api/demo/scenario', { scenario: 'quote_changed' })
const changedQuote = await post(`${purchase}/authorize`)
assert(changedQuote.response.status === 409 && changedQuote.body.state === 'REQUOTED_REVIEW_REQUIRED', 'changed quote must invalidate authorization')

await prepareEligible()
await post('/api/demo/scenario', { scenario: 'risk_unavailable' })
const riskUnavailable = await post(`${purchase}/authorize`)
assert(riskUnavailable.response.status === 503 && riskUnavailable.body.state === 'CHALLENGE_REQUIRED', 'risk outage must fail closed')

await prepareEligible()
await post('/api/demo/scenario', { scenario: 'payment_failed' })
const paymentFailed = await post(`${purchase}/pay`)
assert(paymentFailed.response.status === 503 && paymentFailed.body.state === 'PAYMENT_FAILED' && paymentFailed.body.safeRetry === true, 'facilitator failure must be safely retryable')

await prepareEligible()
await post('/api/demo/scenario', { scenario: 'payment_unconfirmed' })
const paymentUnconfirmed = await post(`${purchase}/pay`)
assert(paymentUnconfirmed.response.status === 202 && paymentUnconfirmed.body.state === 'PAYMENT_UNCONFIRMED', 'ambiguous payment must not be treated as settled')

await prepareEligible()
const settled = await post(`${purchase}/pay`)
const replay = await post(`${purchase}/pay`)
assert(settled.body.state === 'SIMULATED_SETTLED' && settled.body.validated === false, 'fixture settlement must be explicit simulation')
assert(replay.body.transactionHash === null, 'replay must not create a second transaction')
const wrongEvidence = await fetch(base + master, { headers: { 'PAYMENT-SIGNATURE': 'wrong' } })
const validEvidence = await fetch(base + master, { headers: { 'X-FairCut-Fixture-Payment': 'SIMULATED_SETTLED' } })
assert(wrongEvidence.status === 402 && validEvidence.status === 200, 'only the pinned fixture evidence header may unlock delivery')
const fulfilled = await post(`${purchase}/fulfil`)
const receipt = await request(`${purchase}/receipt`)
assert(fulfilled.body.state === 'FULFILMENT_VERIFIED', 'happy fulfilment must verify')
assert(receipt.body.audit.chainValid === true, 'receipt must expose a valid event-chain check')
assert(receipt.body.delivery.assetHash === validEvidence.headers.get('X-FairCut-Asset-Digest'), 'receipt and delivery header digests must match')

await prepareEligible()
await post(`${purchase}/pay`)
await post('/api/demo/scenario', { scenario: 'delivery_mismatch' })
const exception = await post(`${purchase}/fulfil`)
const withheld = await fetch(base + master, { redirect: 'manual' })
assert(exception.body.state === 'FULFILMENT_EXCEPTION' && withheld.status === 409, 'delivery mismatch must preserve settlement but withhold clean asset')

await post('/api/demo/reset')
console.log(JSON.stringify({
  prepayment402: challenge.status,
  x402Contract: { version: challengePayload.x402Version, scheme: accepted.scheme, network: accepted.network, amount: accepted.amount },
  idempotencyReplay: replayReset.body.receiptSummary.eventHeadHash === firstReset.body.receiptSummary.eventHeadHash,
  idempotencyConflict: idempotencyConflict.body.state,
  blocked403Reasons: blocked.body.reasonCodes,
  changedQuote409: changedQuote.body.state,
  riskUnavailable503: riskUnavailable.body.state,
  paymentFailed503: paymentFailed.body.state,
  paymentUnconfirmed202: paymentUnconfirmed.body.state,
  fixtureSettlement: settled.body.state,
  replayTransactionHash: replay.body.transactionHash,
  wrongEvidence402: wrongEvidence.status,
  validEvidence200: validEvidence.status,
  fulfilment: fulfilled.body.state,
  chainValid: receipt.body.audit.chainValid,
  assetDigest: receipt.body.delivery.assetHash,
  policyDigest: receipt.body.delivery.policyHash,
  exception: exception.body.state,
  cleanAssetAfterException: withheld.status,
}, null, 2))
