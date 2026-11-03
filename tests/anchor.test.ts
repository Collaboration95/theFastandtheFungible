import { it, expect } from 'vitest'
import { verifyAnswer } from '../sdk/verify.js'
import { fixture } from './fixtures/anchor.js'
it('checks ledger memo and detects audit edits and answer rewrites',async()=>{
 const {b,result}=fixture()
 expect((await verifyAnswer(b,{onlineLedger:true,anchorLookup:async()=>result})).ok).toBe(true)
 expect((await verifyAnswer(b)).checks.find(c=>c.check==='audit anchor')?.status).toBe('SKIP')
 for(const mutate of [(r:typeof result)=>{r.Account='wrong'},(r:typeof result)=>{r.validated=false},(r:typeof result)=>{r.Memos[0].Memo.MemoData='00'},(r:typeof result)=>{r.meta.TransactionResult='tecFAILED'}]){
 const r=structuredClone(result);mutate(r);expect((await verifyAnswer(b,{onlineLedger:true,anchorLookup:async()=>r})).ok).toBe(false)
 }
 b.answers[0].conclusion+=' edited';expect((await verifyAnswer(b,{onlineLedger:true,anchorLookup:async()=>result})).ok).toBe(false)
})
