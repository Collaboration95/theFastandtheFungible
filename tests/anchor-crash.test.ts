// Crash boundary injection: disk DB reopened; ledger accepts duplicate blobs once.
import { it, expect } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from '../server/store.js'
import { AnswerAnchors } from '../server/anchor.js'
import { XrplPayer } from '../server/xrpl.js'
import { Wallet, decode } from 'xrpl'
import type { Ledger } from '../shared/xrpl.js'
for (const crash of ['before-submit','after-submit','after-validation']) it(`recovers ${crash} with one signature and one fee`,async()=>{
 const path=join(mkdtempSync(join(tmpdir(),'anchor-crash-')),'app.db')
 let store=new Store(path)
 const run=store.createRun('test',200,{research:'fixture',decision:'fixture',publisher:'local',settlement:'XRPL TESTNET · no real value'})
 store.addAnswer(run.runId,{version:1,conclusion:'No evidence',claims:[],openGaps:[],provider:'fixture',model:'fixture'})
 store.updateRun(run.runId,{phase:'DONE'})
 const wallet=Wallet.generate();let submissions=0,charges=0,crashed=false
 const validated=new Map<string,Record<string,unknown>>()
 const ledger:Ledger={async request(req){
  if(req.command==='server_info')return {result:{info:{network_id:1,validated_ledger:{reserve_base_xrp:1,reserve_inc_xrp:.2,age:0}}}}
  if(req.command==='account_info')return {result:{account_data:{Sequence:charges+1,Balance:'100000000',OwnerCount:0}}}
  if(req.command==='ledger')return {result:{ledger_index:100}}
  if(req.command==='ledger_current')return {result:{ledger_current_index:100}}
  if(req.command==='fee')return {result:{drops:{open_ledger_fee:'12'}}}
  if(req.command==='submit'){
   submissions++
   if(crash==='before-submit'&&!crashed){crashed=true;throw Error('power loss')}
   const tx=decode(String(req.tx_blob));const row=store.anchorRows()[0]
   if(!validated.has(row.submission!.txHash)){charges++;validated.set(row.submission!.txHash,{...tx,hash:row.submission!.txHash})}
   if(crash==='after-submit'&&!crashed){crashed=true;throw Error('lost response')}
   return {result:{}}
  }
  if(req.command==='tx'){
   if(crash==='after-validation'&&!crashed&&validated.size){crashed=true;throw Error('power loss')}
   const tx=validated.get(String(req.transaction));return {result:tx?{...tx,validated:true,ledger_index:101,meta:{TransactionResult:'tesSUCCESS'}}:{validated:false}}
  }
  throw Error('unexpected '+req.command)
 }}
 let anchors=new AnswerAnchors(store,new XrplPayer(ledger,wallet))
 await anchors.ensure(run.runId).catch(()=>undefined)
 const blob=store.anchorRows()[0].submission!.txBlob
 store.close();store=new Store(path)
 anchors=new AnswerAnchors(store,new XrplPayer(ledger,wallet))
 await Promise.all([anchors.ensure(run.runId),anchors.ensure(run.runId)])
 await anchors.ensure(run.runId)
 expect(store.getRun(run.runId).ledgerAnchor?.ledgerIndex).toBe(101)
 expect(store.anchorRows()[0].submission?.txBlob).toBe(blob)
 expect(charges).toBe(1);expect(submissions).toBeLessThanOrEqual(2)
 expect(store.getRun(run.runId).spentMinor).toBe(0)
 store.close()
})
