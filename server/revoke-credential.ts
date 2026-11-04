// Deterministic proof-failure policy; only our Testnet issuer may sign a deletion.
import { XrplPayer } from './xrpl.js'
import { writerVerification } from './writer-credentials.js'
import type { PurchaseManager } from './purchases.js'
import type { PurchaseIntent } from '../shared/contracts/index.js'
export async function revokeBrokenCredential({ store, payer }: PurchaseManager, intent: PurchaseIntent) {
  if (!(payer instanceof XrplPayer) || intent.escrow?.mode !== 'key-reveal' || !intent.failedClaimIds?.length || intent.quote?.payment?.rail !== 'xrpl-testnet') return
  const subject = intent.quote.payment.payTo
  const v = await writerVerification(subject)
  if (v.status !== 'verified' || v.issuer !== payer.address) return
  const info = await payer.ledger.request({ command: 'server_info' })
  if (info.result.info.network_id !== 1) return
  const entry = await payer.ledger.request({ command: 'ledger_entry', ledger_index: 'validated', credential: { subject, issuer: payer.address, credential_type: v.credentialType } })
  const n = entry.result.node
  if (entry.result.validated !== true || n?.LedgerEntryType !== 'Credential' || n.Subject !== subject || n.Issuer !== payer.address || n.CredentialType !== v.credentialType) return
  const send = async (s: import('./xrpl.js').Submission) => {
    await payer.ledger.request({ command: 'submit', tx_blob: s.txBlob })
    store.recordAudit({ runId: intent.runId, intentId: intent.intentId, kind: 'credential-revocation', data: { txHash: s.txHash, subject, issuer: payer.address!, label: 'Testnet CredentialDelete submitted; validation pending' } })
  }
  const old = store.credentialRevocation(intent.intentId)
  if (old) { await send(old); return }
  const job = await payer.revokeCredential(subject, v.credentialType, s => store.credentialRevocation(intent.intentId, s)!, send)
  await job.sent
}
