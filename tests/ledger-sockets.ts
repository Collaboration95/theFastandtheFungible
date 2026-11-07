import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
export async function stubLedger(page: Page) {
 const data=JSON.parse(await readFile('site/ledger/transactions.json','utf8'))
 await page.routeWebSocket(/wss:\/\/.*/,ws=>ws.onMessage(async raw=>{
  const request=JSON.parse(String(raw)), r=data.rows.find((r:{hash:string})=>r.hash===request.transaction)
  expect(request.command).toBe('tx')
  if (r.source.includes('round3-r2') || r.source.includes('r5-r')) {
   const retained=JSON.parse(await readFile(r.source,'utf8'))
   ws.send(JSON.stringify({id:request.id,result:retained.find((x:{hash:string})=>x.hash===r.hash).response})); return
  }
  const t:Record<string,unknown>={TransactionType:r.operation ?? 'Payment',Fee:r.feeDrops,Account:r.from,Destination:r.to,InvoiceID:r.invoiceId,Amount:r.deliveredAmount??r.amountDrops}
  if(r.group==='escrow')Object.assign(t,{TransactionType:({create:'EscrowCreate',finish:'EscrowFinish',cancel:'EscrowCancel'} as Record<string,string>)[r.operation],Account:r.owner,Owner:r.owner,Sequence:r.createSequence,OfferSequence:r.createSequence,Destination:r.destination})
  if(r.condition)t.Condition=r.condition
  if(r.operation==='create' && r.label) { const p=JSON.parse(await readFile(r.source.includes('round2-v1')?'docs/evidence/round2-v1/proof.json':'docs/evidence/round2-r/happy-receipt.json','utf8'));const terms=p.quote?.terms ?? p.proofs[0].keyReveal.quote.terms; if(r.hash===(p.createHash ?? p.proofs?.[0].keyReveal.createHash))t.Memos=[{Memo:{MemoType:Buffer.from('researchagent/escrow-v1').toString('hex').toUpperCase(),MemoData:Buffer.from(JSON.stringify(terms)).toString('hex').toUpperCase()}}] }
  if(r.keyReveal) { t.Condition=r.keyReveal.condition; const p=JSON.parse(await readFile(r.source.includes('round2-v1')?'docs/evidence/round2-v1/proof.json':'docs/evidence/round2-r/happy-receipt.json','utf8')); t.Fulfillment='A0228020'+(p.key ?? p.proofs[0].keyReveal.key) }
  if(r.group==='anchor')Object.assign(t,{TransactionType:'AccountSet',Account:r.account,Memos:[{Memo:{MemoType:Buffer.from('researchagent/anchor-v1').toString('hex').toUpperCase(),MemoData:Buffer.from(r.head+':').toString('hex').toUpperCase()+'A'.repeat(128)}}]})
  if(r.credentialTypeText)Object.assign(t,{Account:r.operation==='CredentialCreate'?r.issuer:r.subject,Subject:r.subject,Issuer:r.issuer,CredentialType:Buffer.from(r.credentialTypeText).toString('hex').toUpperCase()})
  ws.send(JSON.stringify({id:request.id,result:{hash:r.hash,validated:true,ledger_index:r.ledgerIndex,tx_json:t,meta:{TransactionResult:'tesSUCCESS',delivered_amount:r.deliveredAmount}}}))
 }))
}
