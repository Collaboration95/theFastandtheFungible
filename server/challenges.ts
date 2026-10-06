// Client side of POST /challenge (#132, D5). On CLAIM_FAILED the buyer reveals the failed claim's
// passage and salt; the writer re-checks and refunds, rejects, or refuses (a timeout counts as REFUSED).
// The buyer checks a refund on the ledger itself (verifyPayment, roles swapped). Write-once per intent.
import { SIMULATED_LABEL, XRPL_EXPLORER, XRPL_LABEL, type PurchaseIntent } from '../shared/contracts/index.js'
import type { Challenge } from '../shared/contracts/publisher.js'
import { verifyPayment } from '../shared/xrpl.js'
import type { PurchaseManager } from './purchases.js'
import { XrplPayer } from './xrpl.js'

const inflight = new Map<string, Promise<PurchaseIntent>>()

export function challenge(purchases: PurchaseManager, intentId: string, options: { timeoutMs?: number; pollMs?: number } = {}): Promise<PurchaseIntent> {
  const running = inflight.get(intentId)
  if (running) return running
  const pending = run(purchases, intentId, options).finally(() => inflight.delete(intentId))
  inflight.set(intentId, pending)
  return pending
}

async function run({ store, client, payer }: PurchaseManager, intentId: string, { timeoutMs = 30_000, pollMs = 1000 }: { timeoutMs?: number; pollMs?: number }): Promise<PurchaseIntent> {
  const intent = store.getIntent(intentId)
  if (!intent) throw new Error('Intent not found')
  if (!['CLAIM_FAILED', 'CHALLENGED'].includes(intent.status)) return intent
  const manifest = store.getManifest(intentId), delivery = store.getDelivery(intentId)
  const claim = manifest?.claims.find(c => intent.failedClaimIds?.includes(c.id))
  const index = claim ? manifest!.leaves.indexOf(claim.leaf) : -1
  const passage = delivery?.content.spans[index], salt = delivery?.salts[index]
  // A root mismatch with no claim to point at stays quarantined; there is nothing the writer could re-check.
  if (!claim || !passage || !salt || !intent.txHash) return intent
  const testnet = intent.quote?.payment?.rail === 'xrpl-testnet'
  const label = testnet ? XRPL_LABEL : SIMULATED_LABEL
  const body: Challenge = { intentId, txHash: intent.txHash, claimId: claim.id, leaf: claim.leaf, salt, passageId: passage.id, passageText: passage.text }
  store.markChallenged(intentId)
  store.appendEvent(intent.runId, { type: 'CHALLENGE', label: `POST /w/${intent.profileId}/challenge · claim ${claim.id}`, data: { intentId, claimId: claim.id, txHash: intent.txHash, label } })
  const wire = (w: { method: string; path: string; status: number }) => { store.appendEvent(intent.runId, { type: 'WIRE', label: `${w.method} ${w.path} → ${w.status}`, data: { ...w } }) }
  let status: 'REFUNDED' | 'CHALLENGE_REJECTED' | 'CHALLENGE_REFUSED' = 'CHALLENGE_REFUSED', reason = 'refused or timed out'
  let refundTxHash: string | undefined
  try {
    const result = await client.challenge(intent.profileId, body, timeoutMs, wire)
    if (result.status === 'REJECTED') { status = 'CHALLENGE_REJECTED'; reason = 'the writer says the claim holds' }
    else if (result.status === 'REFUNDED' && result.refundTxHash) {
      refundTxHash = result.refundTxHash
      if (!testnet || await refundOnLedger(payer, refundTxHash, intent, Date.now() + timeoutMs, pollMs)) status = 'REFUNDED'
      else reason = 'the refund is not on the ledger'
    }
  } catch { /* timeout, HTTP error or malformed answer: REFUSED */ }
  const next = store.recordChallengeOutcome(intentId, status, status === 'REFUNDED' ? { txHash: refundTxHash!, amountMinor: intent.amountMinor } : undefined)
  store.appendEvent(intent.runId, { type: 'CHALLENGE', label: `${next.status}${next.status === 'REFUNDED' ? '' : ` · ${reason}`}`, data: { intentId, status: next.status, label } })
  if (next.refund) store.appendEvent(intent.runId, { type: 'REFUND', label: `Refunded S$${(next.refund.amountMinor / 100).toFixed(2)} · InvoiceID = original tx · ${label}`, data: { intentId, txHash: next.refund.txHash, amountMinor: next.refund.amountMinor, originalTxHash: intent.txHash, label, ...(testnet ? { explorerUrl: `${XRPL_EXPLORER}/${next.refund.txHash}` } : {}) } })
  return next
}

/** verifyPayment with the roles swapped: the publisher wallet we paid → payer, the full amount, InvoiceID = the original tx hash. */
async function refundOnLedger(payer: PurchaseManager['payer'], txHash: string, intent: PurchaseIntent, deadline: number, pollMs: number): Promise<boolean> {
  if (!(payer instanceof XrplPayer) || !payer.address) return false
  const terms = { ...intent.quote!.payment!, payTo: payer.address, invoiceId: intent.txHash! }
  for (;;) {
    const verdict = await verifyPayment(payer.ledger, txHash, terms).catch(() => ({ state: 'pending' as const }))
    // Only the wallet we paid can refund us: a matching payment from anyone else is not this writer's refund.
    if (verdict.state !== 'pending') return verdict.state === 'ok' && verdict.proof.payer === intent.quote!.payment!.payTo
    if (Date.now() > deadline) return false
    await new Promise(resolve => setTimeout(resolve, pollMs))
  }
}
