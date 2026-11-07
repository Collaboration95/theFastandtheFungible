import { json, assert } from './common.mjs'
import { classify } from '../../site/ledger/ledger.js'
const r=json('site/ledger/transactions.json').rows.find(row => row.deliveredAmount && typeof row.deliveredAmount === 'object')
const body={result:{hash:r.hash,ledger_index:r.ledgerIndex,validated:true,tx_json:{TransactionType:'Payment',Fee:r.feeDrops,Account:r.from,Destination:r.to,InvoiceID:r.invoiceId,Amount:r.deliveredAmount},meta:{TransactionResult:'tesSUCCESS',delivered_amount:r.deliveredAmount}}}
assert.ok(classify(r,body).startsWith('validated'))
for (const bad of [{...r.deliveredAmount,value:'0.1'},{...r.deliveredAmount,issuer:'wrong'},'unavailable']) {
 body.result.meta.delivered_amount=bad
 assert.ok(classify(r,body).startsWith('Historical'))
}
console.log('Offline adversarial fixture: Amount alone accepts underdelivery; delivered_amount rejects it.')
