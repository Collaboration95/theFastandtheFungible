import type { PurchaseIntent, RunSnapshot } from '../../shared/contracts/index.js'

/** The proof check after delivery (D4): ✓ n claims recomputed, or ✗ the claim that failed. */
export default function ProofBadge({ run, intent }: { run: RunSnapshot; intent: PurchaseIntent }) {
  const proof = run.events.find(event => event.type === 'PROOF' && event.data?.intentId === intent.intentId)
  if (!proof) return null
  const claims = Number(proof.data?.claims ?? 0)
  if (proof.data?.ok === true) return <span className="ra-proof is-ok" title={proof.label}>✓ {claims} claim{claims === 1 ? '' : 's'}</span>
  const failed = (Array.isArray(proof.data?.failedClaimIds) ? proof.data.failedClaimIds.map(String) : intent.failedClaimIds ?? [])[0]
  return <span className="ra-proof is-fail" title={proof.label}>✗ {failed ?? (proof.data?.rootOk === false ? 'root mismatch' : 'proof')}</span>
}
