import type { PurchaseIntent, RunSnapshot } from '../shared/contracts'
import { candidateOf, money } from './format'
import { isTerminal } from './stage'

type Line = { tone: 'ok' | 'pending' | 'bad'; text: string }
/** What one purchase means after Stop. Only recorded states earn a final word; anything unsettled says it is still being checked. */
export function stopLine(run: RunSnapshot, intent: PurchaseIntent): Line {
  // The publisher field carries provenance after its name ("… · team-authored · real content · Testnet"); the payment row shows the name alone, and so does this line (H5).
  const name = candidateOf(run, intent)?.publisher.split(' · ')[0] || 'the writer', amount = money(intent.amountMinor)
  const testnet = run.labels.settlement.startsWith('XRPL'), ledger = testnet ? 'the XRPL Testnet ledger' : 'the simulated ledger'
  const escrow = intent.escrow?.mode === 'key-reveal' ? intent.escrow.state : undefined
  if (intent.status === 'REFUNDED') return { tone: 'ok', text: `${name}: refunded ${money(intent.refund?.amountMinor ?? 0)}, confirmed on ${ledger}.` }
  if (intent.status === 'CHALLENGE_REFUSED' || intent.status === 'CHALLENGE_REJECTED') return { tone: 'bad', text: `${name}: the article broke its promise and the writer refused the refund. The payment stands; their trust score drops.` }
  if (intent.status === 'CHALLENGED' || intent.status === 'CLAIM_FAILED') return { tone: 'pending', text: `${name}: the article broke its promise, so a refund was requested. It shows as refunded only after ${ledger} confirms it; the writer signs refunds and could refuse.` }
  if (escrow === 'CANCELLED') return { tone: 'ok', text: `${name}: escrow cancelled. ${amount} returned to the sponsor wallet.` }
  if (escrow === 'CANCEL_DUE') return { tone: 'pending', text: `${name}: the escrow passed its cancel time without the key. Returning ${amount} to the sponsor wallet.` }
  if (escrow === 'LOCKED' || escrow === 'VERIFIED_FOR_RELEASE') return { tone: 'pending', text: `${name}: ${amount} is locked in escrow. The writer is paid only by publishing the article key; otherwise the escrow returns the funds to the sponsor wallet after its cancel time.` }
  if (escrow === 'PREPARED' && !isTerminal(run)) return { tone: 'pending', text: `${name}: the escrow was being created when you stopped. Checking ${ledger}.` }
  if (intent.status === 'VERIFIED') return { tone: 'ok', text: `${name}: paid ${amount} before you stopped; delivered and checked. It stays in your receipts.` }
  if (intent.status === 'DELIVERY_FAILED') return { tone: 'bad', text: `${name}: paid ${amount}, but delivery failed. Retry delivery fetches the same copy without paying again.` }
  if (intent.status === 'SETTLED' || intent.status === 'DELIVERY_PENDING') return { tone: 'pending', text: `${name}: paid ${amount}; the article is still being delivered and checked.` }
  if (intent.status === 'SUBMITTING' || ((intent.status === 'RESERVED' || escrow === 'PREPARED') && !isTerminal(run))) return { tone: 'pending', text: `${name}: a payment of ${amount} was already on its way when you stopped. Checking ${ledger}; if it settles, its receipt appears here.` }
  return { tone: 'ok', text: `${name}: not paid. Nothing was charged.` }
}
