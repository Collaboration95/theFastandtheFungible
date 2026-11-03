/* eslint-disable @typescript-eslint/no-explicit-any -- mutation fixtures deliberately model malformed RPC responses. */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const data = JSON.parse(readFileSync('site/ledger/transactions.json','utf8'))
// @ts-expect-error Browser module is deliberately dependency-free JavaScript.
import { classify, refresh } from '../site/ledger/ledger.js'
const row = data.rows[0]
function valid() { return {result:{hash:row.hash,ledger_index:row.ledgerIndex,validated:true,tx_json:{TransactionType:"Payment",Account:row.from,Destination:row.to,InvoiceID:row.invoiceId,Fee:row.feeDrops},meta:{TransactionResult:'tesSUCCESS',delivered_amount:row.deliveredAmount}}} }
describe('public ledger',()=>{
 it('rebuilds nine source-bound unique rows',()=>{execFileSync('node',['scripts/ledger-artifact.mjs','--check']); expect(data.rows).toHaveLength(9); expect(new Set(data.rows.map((r:{hash:string})=>r.hash)).size).toBe(9)})
 it('only matching validated success is fresh',()=>{
  expect(classify(row,valid())).toContain('Freshly verified')
  for(const mutate of [(b: {result: Record<string, any>})=>b.result.validated=false,(b: {result: Record<string, any>})=>b.result.tx_json.NetworkID=0,(b: {result: Record<string, any>})=>b.result.meta.TransactionResult='tecFAILED',(b: {result: Record<string, any>})=>b.result.meta.delivered_amount={...row.deliveredAmount,value:'9'},(b: {result: Record<string, any>})=>b.result.meta.delivered_amount={...row.deliveredAmount,issuer:'wrong'},(b: {result: Record<string, any>})=>b.result.error='txnNotFound',(b: {result: Record<string, any>})=>delete b.result.meta]){const b=valid();mutate(b);expect(classify(row,b)).not.toContain('Freshly verified')}
  expect(classify(row,{})).toContain('Historical')
 })
 it('bounds concurrency, methods and response bytes; handles unavailable states',async()=>{
  let active=0,max=0,calls=0
  await refresh(data.rows,async(_url:string,init:RequestInit)=>{active++; max=Math.max(max,active);const b=JSON.parse(String(init.body));expect(b.method).toBe('tx');expect(data.rows.some((r:{hash:string})=>r.hash===b.params[0].transaction)).toBe(true);await new Promise(r=>setTimeout(r,2));active--;calls++;return new Response('{}')})
  expect(calls).toBe(9);expect(max).toBe(2)
  for(const fetcher of [async()=>{throw Error('CORS')},async()=>new Response('bad'),async()=>new Response('x'.repeat(262145)),async()=>new Response('{}',{status:429})]){const states:string[]=[];await refresh([row],fetcher,(_h:string,s:string)=>states.push(s));expect(states[0]).toContain('Historical')}
 })
})
it('aborts each slow request at five seconds',async()=>{
 const start=Date.now();const states:string[]=[]
 await refresh([row],async(_u:string,init:RequestInit)=>new Promise((_resolve,reject)=>init.signal?.addEventListener('abort',()=>reject(Error('timeout')))),(_h:string,s:string)=>states.push(s))
 expect(Date.now()-start).toBeLessThan(5800);expect(states[0]).toContain('Historical')
},6500)
it('matches escrow operation identity and rejects cross-role substitution',()=>{
 for(const r of data.rows.filter((r:{group:string})=>r.group==='escrow')){
  const t={hash:r.hash,TransactionType:({create:'EscrowCreate',finish:'EscrowFinish',cancel:'EscrowCancel'} as Record<string,string>)[r.operation],Fee:r.feeDrops,Account:r.owner,Owner:r.owner,Sequence:r.createSequence,OfferSequence:r.createSequence,Amount:r.amountDrops}
  const body={result:{hash:r.hash,ledger_index:r.ledgerIndex,validated:true,tx_json:t,meta:{TransactionResult:'tesSUCCESS'}}}
  expect(classify(r,body)).toContain('Freshly verified')
  t.OfferSequence++;t.Sequence++;expect(classify(r,body)).toContain('Historical')
 }
})
