import { resources } from './helpers/resource-scope.js'
import { expect,it } from 'vitest'
import { Store } from '../server/store.js'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { reconcileRefunds } from '../server/challenges.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { XrplPayer } from '../server/xrpl.js'
import { Wallet } from 'xrpl'
it('A06 reaches candidate seventeen despite sixteen permanent mismatches',async()=>{
 const path=join(resources().tempDir('hm-fair-'),'app.db'), s=resources().own(new Store(path)), db=resources().own(new DatabaseSync(path)), r=s.createRun('SYNTHETIC',200), buyer=Wallet.generate(),writer=Wallet.generate(), seen=new Set<string>()
 for(let i=1;i<=17;i++)db.prepare('INSERT INTO intents VALUES (?,?,?)').run(String(i),r.runId,JSON.stringify({intentId:String(i),runId:r.runId,profileId:'fixture',resourceId:'fixture',version:'1',amountMinor:1,status:'CHALLENGED',refundCandidate:{txHash:i.toString(16).toUpperCase().padStart(64,'0'),observedAt:'2020-01-01'},txHash:'A'.repeat(64),quote:{intentId:String(i),runId:r.runId,profileId:'fixture',resourceId:'fixture',version:'1',quoteId:'fixture',quoteHash:'A'.repeat(64),amountMinor:1,currency:'SGD',contentDigest:'fixture',expiresAt:'2020-01-01',payment:{rail:'xrpl-testnet',network:'xrpl:1',asset:'XRP',amountDrops:'1000',payTo:writer.classicAddress,invoiceId:'A'.repeat(64)}}}))
 const payer=new XrplPayer({request:async r=>{seen.add(String(r.transaction)); return {result:{validated:true,tx_json:{TransactionType:'Payment',Account:writer.classicAddress,Destination:buyer.classicAddress,Amount:'1000',InvoiceID:r.transaction==='11'.padStart(64,'0')?'A'.repeat(64):'B'.repeat(64)},meta:{TransactionResult:'tesSUCCESS',delivered_amount:'1000'},ledger_index:123}}}},buyer)
 const manager=new PurchaseManager(s,new PublisherClient(),payer)
 await reconcileRefunds(manager); await reconcileRefunds(manager)
 expect(seen.size).toBe(17);expect(s.getIntent('17')?.status).toBe('REFUNDED')
})
