// Test helper: pay a 402 the way the buyer does, with the SIMULATED payer (or any wallet), offline.
import { Wallet } from 'xrpl'
import type { PaymentRequired, PaymentRequirements } from '../../shared/contracts/x402.js'
import { decodeHeader, encodeHeader, ledgerInvoiceId } from '../../shared/x402.js'
import { simulatedLedgerIndex, simulatedPayerWallet } from '../../shared/xrpl.js'

export const required = (response: Response): PaymentRequired => decodeHeader('PAYMENT-REQUIRED', response.headers.get('PAYMENT-REQUIRED'))
export type Tamper = Partial<{ Amount: string; Destination: string; InvoiceID: string; LastLedgerSequence: number; Sequence: number }>

export function signFor(accepted: PaymentRequirements, tamper: Tamper = {}, wallet: Wallet = simulatedPayerWallet()) {
  const signed = wallet.sign({
    TransactionType: 'Payment', Account: wallet.classicAddress, Destination: accepted.payTo, Amount: accepted.amount,
    InvoiceID: ledgerInvoiceId(accepted.extra.invoiceId), Sequence: 1, Fee: '12', LastLedgerSequence: simulatedLedgerIndex() + 20, ...tamper,
  })
  return { blob: signed.tx_blob, hash: signed.hash.toUpperCase(), header: encodeHeader('PAYMENT-SIGNATURE', { x402Version: 2, accepted, payload: { signedTxBlob: signed.tx_blob } }) }
}
export const paymentResponse = (response: Response) => decodeHeader('PAYMENT-RESPONSE', response.headers.get('PAYMENT-RESPONSE'))
