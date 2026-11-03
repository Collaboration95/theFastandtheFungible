import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { canonical, entryHash } from '../../server/audit.js'
import { ReceiptBundleSchema } from '../../shared/contracts/receipts.js'
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
export function fixture() {
 const b = ReceiptBundleSchema.parse(JSON.parse(readFileSync('tests/fixtures/receipt-conformance/secp256k1.json','utf8')))
 const last = b.audit.entries.at(-1)!
 const e = { seq:last.seq+1, at:'2026-11-04T00:00:00.000Z', prevHash:b.audit.head, runId:b.runId, intentId:null, surface:'system', principal:'policy', kind:'answer-anchor', data:{ answersHash:hash(canonical(b.answers)) } }
 const head = entryHash(e.seq,e.at,e.prevHash,e.runId,e.intentId,e.surface,e.principal,e.kind,canonical(e.data))
 b.audit.entries.push({...e,hash:head});b.audit.head=head
 b.ledgerAnchor={ version:'anchor-v1',network:'xrpl:1',head,runIdHash:hash(b.runId),account:b.payments[0]?.payer ?? 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',txHash:'A'.repeat(64),ledgerIndex:123,feeDrops:'12' }
 const a=b.ledgerAnchor
 const result={validated:true,ledger_index:123,meta:{TransactionResult:'tesSUCCESS'},Account:a.account,hash:a.txHash,Fee:'12',TransactionType:'AccountSet',Memos:[{Memo:{MemoType:Buffer.from('researchagent/anchor-v1').toString('hex').toUpperCase(),MemoData:Buffer.from(`${head}:${a.runIdHash}`).toString('hex').toUpperCase()}}]}
 return {b,result}
}
