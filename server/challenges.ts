// Client side of POST /challenge (#132, D5). On CLAIM_FAILED the buyer reveals the failed claim's
// passage and salt; the writer re-checks and refunds, rejects, or refuses (a timeout counts as REFUSED).
// The buyer checks a refund on the ledger itself (verifyPayment, roles swapped). Write-once per intent.
import { SIMULATED_LABEL, XRPL_LABEL, type PurchaseIntent } from '../shared/contracts/index.js'
import type { Challenge } from '../shared/contracts/publisher.js'
import { decryptDelivery } from '../shared/key-reveal.js'
import { z } from 'zod'
import { verifyPayment } from '../shared/xrpl.js'
import type { PurchaseManager } from './purchases.js'
import { Reputation } from './reputation.js'
import { XrplPayer } from './xrpl.js'
import { scoreTrace, traceStep } from './telemetry.js'

const inflight = new Map<string, Promise<PurchaseIntent>>()

export function challenge(purchases: PurchaseManager, intentId: string, options: { timeoutMs?: number; pollMs?: number } = {}): Promise<PurchaseIntent> {
  const running = inflight.get(intentId)
  if (running) return running
  const pending = traceStep('challenge', { intentId }, () => run(purchases, intentId, options), intent => {
    if (intent.status === 'REFUNDED') scoreTrace('refund-issued', true, intent.refund?.txHash)
    return { status: intent.status, refundTx: intent.refund?.txHash }
  }).finally(() => inflight.delete(intentId))
  inflight.set(intentId, pending)
  return pending
}

async function run({ store, client, payer }: PurchaseManager, intentId: string, { timeoutMs = 30_000, pollMs = 1000 }: { timeoutMs?: number; pollMs?: number }): Promise<PurchaseIntent> {
  const intent = store.getIntent(intentId)
  if (!intent) throw new Error('Intent not found')
  if (!['CLAIM_FAILED', 'CHALLENGED'].includes(intent.status)) return intent
  const manifest = store.getManifest(intentId)
  const delivery = store.getDelivery(intentId)
  let passages = delivery?.content.spans, salts = delivery?.salts
  // Failed escrow passages remain private; decrypt published evidence only inside policy.
  if (!delivery && intent.escrow?.mode === 'key-reveal') {
    const escrow = store.getEscrow(intentId)
    if (escrow?.reveal) {
      try {
        const d = z.object({ passages: z.array(z.object({ id: z.string(), text: z.string() })), salts: z.array(z.string()) }).parse(decryptDelivery(escrow.quote, escrow.reveal.key))
        passages = d.passages; salts = d.salts
      } catch { /* Unauthenticated envelopes cannot substantiate a passage challenge. */ }
    }
  }
  const claim = manifest?.claims.find(c => intent.failedClaimIds?.includes(c.id))
  const index = claim ? manifest!.leaves.indexOf(claim.leaf) : -1
  const passage = passages?.[index], salt = salts?.[index]
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
    const result = await client.forSource(intent.source, true).challenge(intent.profileId, body, timeoutMs, wire)
    if (result.status === 'REJECTED') { status = 'CHALLENGE_REJECTED'; reason = 'the writer says the claim holds' }
    else if (result.status === 'REFUNDED' && result.refundTxHash) {
      refundTxHash = result.refundTxHash
      store.recordRefundCandidate(intentId, refundTxHash)
      refundTxHash = store.getIntent(intentId)!.refundCandidate!.txHash
      const verdict = testnet ? await refundOnLedger(payer, refundTxHash, intent, Date.now() + timeoutMs, pollMs) : 'ok'
      if (verdict === 'ok') status = 'REFUNDED'
      else if (verdict === 'pending') { store.appendEvent(intent.runId,{type:'CHALLENGE',label:'Refund offered · awaiting ledger confirmation',data:{intentId,txHash:refundTxHash,label}}); return store.getIntent(intentId)! }
    }
  } catch { /* timeout, HTTP error or malformed answer: REFUSED */ }
  const next = store.withTransaction(()=>{
    const next=store.recordChallengeOutcome(intentId, status, status === 'REFUNDED' ? { txHash: refundTxHash!, amountMinor: intent.amountMinor } : undefined)
    recordChallengeTrust(store,next)
    return next
  })
  store.appendEvent(intent.runId, { type: 'CHALLENGE', label: `${next.status}${next.status === 'REFUNDED' ? '' : ` · ${reason}`}`, data: { intentId, status: next.status, label } })
  return next
}
function recordChallengeTrust(store: PurchaseManager['store'], intent: PurchaseIntent) {
  const manifest=store.getManifest(intent.intentId), outcome=intent.status === 'REFUNDED' ? 'REFUNDED' : intent.status === 'CHALLENGE_REFUSED' ? 'REFUSED' : intent.status === 'CHALLENGE_REJECTED' ? 'REJECTED' : undefined
  if (manifest && outcome) new Reputation(store).recordProof({intentId:intent.intentId,runId:intent.runId,publisherSlug:intent.profileId,wallet:manifest.wallet,outcome,claimed:manifest.relevance})
}

/** verifyPayment with the roles swapped: the publisher wallet we paid → payer, the full amount, InvoiceID = the original tx hash. */
async function refundOnLedger(payer: PurchaseManager['payer'], txHash: string, intent: PurchaseIntent, deadline: number, pollMs: number): Promise<'ok' | 'invalid' | 'pending'> {
  if (!(payer instanceof XrplPayer) || !payer.address) return 'pending'
  const terms = { ...intent.quote!.payment!, payTo: payer.address, invoiceId: intent.txHash! }
  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const verdict = await Promise.race([verifyPayment(payer.ledger, txHash, terms).catch(() => ({ state: 'pending' as const })), new Promise<{ state: 'pending' }>(resolve => { timer = setTimeout(() => resolve({ state: 'pending' }), Math.max(1, deadline - Date.now())) })]).finally(() => clearTimeout(timer))
    // Only the wallet we paid can refund us: a matching payment from anyone else is not this writer's refund.
    if (verdict.state !== 'pending') return verdict.state === 'ok' && verdict.proof.payer === intent.quote!.payment!.payTo ? 'ok' : 'invalid'
    if (Date.now() > deadline) return 'pending'
    await new Promise(resolve => setTimeout(resolve, pollMs))
  }
}

/** Read-only late validation: no publisher call, signing or replacement payment. */
export async function reconcileRefunds(purchases: PurchaseManager): Promise<void> {
  const due = purchases.store.pendingRefunds()
  for (let i=0;i<due.length;i+=4) await Promise.all(due.slice(i,i+4).map(async intent => {
    if (intent.quote?.payment?.rail !== 'xrpl-testnet') return
    const hash = intent.refundCandidate!.txHash
    if (await refundOnLedger(purchases.payer, hash, intent, Date.now()+1000, 50) === 'ok') {
      purchases.store.withTransaction(()=>{
        const next=purchases.store.recordChallengeOutcome(intent.intentId,'REFUNDED',{txHash:hash,amountMinor:intent.amountMinor})
        recordChallengeTrust(purchases.store,next)
      })
    }
    purchases.store.recoveryChecked('refund',intent.intentId)
  }))
}
/** Obligations are independent of answer phase and never authorize a new purchase. */
export async function reconcileChallenges(purchases: PurchaseManager): Promise<void> {
  const due = purchases.store.pendingChallenges()
  for (let i=0;i<due.length;i+=4) await Promise.all(due.slice(i,i+4).map(async intent=>{
    const manifest=purchases.store.getManifest(intent.intentId)
    if (manifest) new Reputation(purchases.store).recordProof({intentId:intent.intentId,runId:intent.runId,publisherSlug:intent.profileId,wallet:manifest.wallet,outcome:'REJECTED',claimed:manifest.relevance})
    await challenge(purchases,intent.intentId,{timeoutMs:1000,pollMs:50})
    purchases.store.recoveryChecked('challenge',intent.intentId)
  }))
}
