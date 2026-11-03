/* eslint-disable @typescript-eslint/no-explicit-any -- mutation fixtures deliberately model malformed RPC responses. */
import { describe, it, expect, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const data = JSON.parse(readFileSync('site/ledger/transactions.json','utf8'))
// @ts-expect-error Browser module is deliberately dependency-free JavaScript.
import { classify, refresh, lookup, endpoints } from '../site/ledger/ledger.js'
const row = data.rows[0]
function valid() { return {result:{hash:row.hash,ledger_index:row.ledgerIndex,validated:true,tx_json:{TransactionType:"Payment",Account:row.from,Destination:row.to,InvoiceID:row.invoiceId,NetworkID:1,Fee:row.feeDrops,Amount:row.deliveredAmount},meta:{TransactionResult:'tesSUCCESS',delivered_amount:row.deliveredAmount}}} }
describe('public ledger',()=>{
 it('rebuilds sixteen source-bound unique rows',()=>{execFileSync('node',['scripts/ledger-artifact.mjs','--check']); expect(data.rows).toHaveLength(16); expect(new Set(data.rows.map((r:{hash:string})=>r.hash)).size).toBe(16)})
 it('only matching validated success is fresh',()=>{
  expect(classify(row,valid())).toContain('validated · tesSUCCESS')
  for(const mutate of [(b: {result: Record<string, any>})=>b.result.validated=false,(b: {result: Record<string, any>})=>b.result.tx_json.NetworkID=0,(b: {result: Record<string, any>})=>b.result.meta.TransactionResult='tecFAILED',(b: {result: Record<string, any>})=>b.result.meta.delivered_amount={...row.deliveredAmount,value:'9'},(b: {result: Record<string, any>})=>b.result.meta.delivered_amount={...row.deliveredAmount,issuer:'wrong'},(b: {result: Record<string, any>})=>b.result.error='txnNotFound',(b: {result: Record<string, any>})=>delete b.result.meta]){const b=valid();mutate(b);expect(classify(row,b)).not.toContain('validated · tesSUCCESS')}
  expect(classify(row,{})).toContain('Historical')
 })
})
function socketFor(mode = 'valid') {
 let active = 0, maximum = 0
 class Socket {
  onopen?: () => void; onmessage?: (e: {data:string}) => void; onerror?: () => void; onclose?: () => void
  constructor() { active++; maximum=Math.max(maximum,active); queueMicrotask(()=>this.onopen?.()) }
  send(raw:string) {
   const cmd=JSON.parse(raw); expect(cmd.command).toBe('tx'); expect(data.rows.some((r:{hash:string})=>r.hash===cmd.transaction)).toBe(true)
   if(mode==='timeout') return
   queueMicrotask(()=> {
    if(mode==='connection') return this.onerror?.()
    const body=valid(); Object.assign(body,{id:cmd.id});
    if(mode==='not-found') Object.assign(body.result,{error:'txnNotFound'})
    if(mode==='network') body.result.tx_json.NetworkID=0
    if(mode==='mismatch') body.result.tx_json.Destination='wrong'
    this.onmessage?.({data:mode==='malformed'?'bad':mode==='oversized'?'x'.repeat(262145):JSON.stringify(body)})
   })
  }
  close() { active-- }
 }
 return {Socket, maximum:()=>maximum, active:()=>active}
}
it('bounds WebSockets and allows only matching validated success',async()=>{
 for(const mode of ['valid','not-found','network','mismatch','connection','malformed','oversized']) {
  const stub=socketFor(mode), states:string[]=[]
  await refresh([row,row,row],stub.Socket,(_h:string,s:string)=>states.push(s))
  expect(stub.maximum()).toBe(2); expect(stub.active()).toBe(0)
  expect(states.every(s=>s.startsWith('validated'))).toBe(mode==='valid')
 }
})
it('closes a timed out socket and rejects unallowlisted targets',async()=>{
 const stub=socketFor('timeout')
 await expect(lookup(row.hash,endpoints[0],stub.Socket,10)).rejects.toThrow('timeout')
 expect(stub.active()).toBe(0)
 expect(()=>lookup('bad',endpoints[0],stub.Socket)).toThrow('allowlisted')
 expect(()=>lookup(row.hash,'wss://evil.invalid',stub.Socket)).toThrow('allowlisted')
})
it('matches escrow operation identity and rejects cross-role substitution',()=>{
 for(const r of data.rows.filter((r:{group:string})=>r.group==='escrow')){
  const t={hash:r.hash,TransactionType:({create:'EscrowCreate',finish:'EscrowFinish',cancel:'EscrowCancel'} as Record<string,string>)[r.operation],Fee:r.feeDrops,Account:r.owner,Owner:r.owner,Sequence:r.createSequence,OfferSequence:r.createSequence,Amount:r.amountDrops}
  const body={result:{hash:r.hash,ledger_index:r.ledgerIndex,validated:true,tx_json:t,meta:{TransactionResult:'tesSUCCESS'}}}
  expect(classify(r,body)).toContain('validated · tesSUCCESS')
  t.OfferSequence++;t.Sequence++;expect(classify(r,body)).toContain('Historical')
 }
})
it('binds credential transactions to issuer, subject and type',()=>{
 for(const r of data.rows.filter((r:{group:string})=>r.group==='Testnet, credential')) {
  const t={TransactionType:r.operation,Account:r.operation==='CredentialCreate'?r.issuer:r.subject,Subject:r.subject,Issuer:r.issuer,CredentialType:Buffer.from(r.credentialTypeText,'utf8').toString('hex').toUpperCase(),Fee:r.feeDrops}
  const body={result:{hash:r.hash,ledger_index:r.ledgerIndex,validated:true,tx_json:t,meta:{TransactionResult:'tesSUCCESS'}}}
  expect(classify(r,body)).toContain('validated · tesSUCCESS')
  t.CredentialType='00';expect(classify(r,body)).toContain('Historical')
 }
})

it('uses the five-second deadline by default',async()=>{
 vi.useFakeTimers()
 try {
  const stub=socketFor('timeout')
  const result=lookup(row.hash,endpoints[0],stub.Socket).catch((e:Error)=>e.message)
  await vi.advanceTimersByTimeAsync(4999);expect(stub.active()).toBe(1)
  await vi.advanceTimersByTimeAsync(1);expect(await result).toBe('timeout');expect(stub.active()).toBe(0)
 } finally {vi.useRealTimers()}
})
