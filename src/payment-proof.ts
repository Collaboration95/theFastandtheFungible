import type { PurchaseIntent } from '../shared/contracts'

/** Only a completed delivery and recorded integrity check may be folded away. */
export function successfulPayment(intent: PurchaseIntent) {
  return intent.status === 'VERIFIED' && (!intent.escrow || intent.escrow.mode !== 'key-reveal' || (intent.escrow.state === 'RELEASED' && intent.escrow.keyVerified === true && intent.escrow.decryptVerified === true))
}
