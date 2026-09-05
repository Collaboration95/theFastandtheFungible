import type { CandidateId } from './domain'

export const eventCopy = {
  rough: 'The rough cut is ready. The 12-second music bed is still unresolved.',
  compare: 'FairCut is comparing creative fit and structured licence evidence across three independent providers.',
  blocked: 'Neon Pilgrim is the strongest creative match, but deterministic rights checks stop it before signing.',
  eligible: 'Dawn Current is the best eligible fit after the attractive favorite fails hard constraints.',
  authorized: 'The exact resource, policy, payee, amount, invoice, and expiry are frozen for one purchase.',
  simulated: 'Fixture purchase complete. The clean stem is verified locally; no ledger settlement occurred.',
  final: 'The clean stem is on the timeline. Leah can hear the licensed final cut and inspect the receipt.',
  deliveryException: 'Payment settled; delivery did not verify. Retry verification or re-fetch from the provider; if it still fails, request escalation/refund review. No clean stem was inserted.',
} as const

export const waveformLabels: Record<CandidateId, string> = {
  'neon-pilgrim': 'Rising, high-energy preview waveform',
  'dawn-current': 'Measured lift with a clean ending waveform',
  'paper-horizon': 'Steady, low-contrast bed waveform',
}

export const receiptLimitations = [
  'ODRL represents the licensor’s asserted permission; it does not by itself guarantee legal enforceability.',
  'The signed provenance fixture records an assertion; it does not prove copyright ownership, consent, or authority to license.',
  'The SHA-256 asset digest identifies the delivered bytes; it is not an ISCC and is not proof of ownership.',
  'XRPL can prove an exact payment validated on the public Testnet. It does not determine creative fit, rights, provenance, or delivery correctness.',
]
