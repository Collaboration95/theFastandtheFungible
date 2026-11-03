import { Wallet } from 'xrpl'
import { hireLedger } from './hire-ledger.js'
// Public synthetic key; generated deterministically, no environment secrets.
export const wallet = Wallet.fromEntropy(new Uint8Array(16).fill(42))
const chain = hireLedger()
// The fixture HTTP server performs settlement in its own process. Mirror lookup
// through its labelled test-only receipt endpoint; never used without explicit fixture mode.
export const ledger = { async request(request: Record<string, unknown>) {
  if (request.command === 'tx') return (await fetch(`${process.env.RA_URL}/fixture/tx/${request.transaction}`)).json()
  return chain.ledger.request(request)
} }
