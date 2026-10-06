// Proof check after delivery (#131, D4/D5, gate 4). The only code that moves an intent to
// VERIFIED or CLAIM_FAILED. A failed proof keeps the grant for audit but quarantines it:
// Store.getRun().contents, the LLM input, citations and the report never see it.
import type { PurchaseIntent } from '../shared/contracts/index.js'
import { verifyDelivery } from '../shared/manifest.js'
import type { Store } from './store.js'

/** Re-checks the stored delivery against the manifest the policy evaluated (a root mismatch fails too). */
export function checkProof(store: Store, intentId: string): PurchaseIntent {
  const intent = store.getIntent(intentId)
  if (!intent) throw new Error('Intent not found')
  if (intent.status !== 'DELIVERY_PENDING') return intent
  const delivery = store.getDelivery(intentId), manifest = store.getManifest(intentId)
  const check = delivery && manifest
    ? verifyDelivery(delivery.content.body, delivery.content.spans, delivery.salts, manifest)
    : { ok: false, rootOk: false, wordCountOk: false, failedClaims: [] }
  const next = store.recordProof(intentId, check.ok && manifest!.root === intent.quote?.contentDigest, check.failedClaims)
  const claims = manifest?.claims.length ?? 0
  store.appendEvent(intent.runId, next.status === 'VERIFIED'
    ? { type: 'PROOF', label: `Proof verified · ${claims} claim${claims === 1 ? '' : 's'} recomputed`, data: { intentId, claims, ok: true } }
    : { type: 'PROOF', label: `Proof failed${check.rootOk ? '' : ' · root mismatch'}${check.failedClaims.length ? ` · ${check.failedClaims.join(', ')}` : ''} · source quarantined, never cited`, data: { intentId, claims, ok: false, rootOk: check.rootOk, wordCountOk: check.wordCountOk, failedClaimIds: check.failedClaims } })
  return next
}
