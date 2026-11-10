// Test-only stand-in for the XRPL anchor of a finished run (never part of the product, never reachable from a gateway or the app).
// The simulated rail leaves nothing on a ledger, so a spec or smoke that needs an "anchored" decline promotes one real finished
// run with this, and answers the read-only `tx` lookup a Testnet node would give for it. The transaction is synthetic; whoever
// uses it says so in their evidence.
import { createHash } from 'node:crypto'
import { canonical } from '../../server/audit.js'
import type { Store } from '../../server/store.js'
import { XRPL_LABEL } from '../../shared/contracts/publisher.js'

const sha = (text: string) => createHash('sha256').update(text).digest('hex')
const hex = (text: string) => Buffer.from(text).toString('hex').toUpperCase()

/** Marks the run as settled on XRPL Testnet and records an anchor row, the way AnswerAnchors would. Returns the anchor and the node's `tx` reply for it. */
export function standInAnchor(store: Store, runId: string) {
  store.updateRun(runId, { labels: { ...store.getRun(runId).labels, settlement: XRPL_LABEL } })
  const answersHash = sha(canonical(store.getRun(runId).answers))
  store.recordAudit({ runId, kind: 'answer-anchor', data: { answersHash } })
  const tip = store.auditEntries().at(-1)!
  store.saveAnchor({ runId, head: tip.hash, seq: tip.seq, answersHash })
  const anchor = { version: 'anchor-v1', network: 'xrpl:1', head: tip.hash, runIdHash: sha(runId), account: 'rNY14qvMuBi6CqU4wPbWaS5nztPLCxJTFn', txHash: sha(`stub-tx:${runId}`).toUpperCase(), ledgerIndex: 22150001, feeDrops: '12' } as const
  store.updateRun(runId, { ledgerAnchor: anchor })
  const tx = { validated: true, ledger_index: anchor.ledgerIndex, meta: { TransactionResult: 'tesSUCCESS' }, Account: anchor.account, hash: anchor.txHash, Fee: anchor.feeDrops, TransactionType: 'AccountSet', Memos: [{ Memo: { MemoType: hex('researchagent/anchor-v1'), MemoData: hex(`${anchor.head}:${anchor.runIdHash}`) } }] }
  return { anchor, tx }
}
