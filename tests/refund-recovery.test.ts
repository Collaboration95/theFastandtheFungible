import { resources } from './helpers/resource-scope.js'
import { expect, it, vi } from 'vitest'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { Wallet } from 'xrpl'
import { RLUSD_CURRENCY } from '../shared/contracts/asset.js'
import { Store } from '../server/store.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
import { XrplPayer } from '../server/xrpl.js'
import { reconcileRefunds } from '../server/challenges.js'
import type { Ledger } from '../shared/xrpl.js'
import { PurchaseIntentSchema } from '../shared/contracts/ledger.js'
it.each(['XRP', 'issued'] as const)('retains and validates a late %s refund once after restart, without signing', async kind => {
  const path=join(resources().tempDir('refund-recovery-'),'app.db')
  const buyer=Wallet.generate(), writer=Wallet.generate(), hash='A'.repeat(64), original='B'.repeat(64)
  const asset = kind === 'XRP' ? 'XRP' as const : { currency: RLUSD_CURRENCY, issuer: Wallet.generate().classicAddress, label: 'test USD (substitute for RLUSD)' as const }
  const amount = kind === 'XRP' ? '80000' : '0.8'
  let s=resources().own(new Store(path))
  const r=s.createRun('SYNTHETIC refund fixture',200)
  s.updateRun(r.runId,{phase:'FAILED'})
  s.close()
  const db=resources().own(new DatabaseSync(path))
  const identity={intentId:'late',runId:r.runId,profileId:'fixture',resourceId:'fixture',version:'1'}
  const intent=PurchaseIntentSchema.parse({...identity,status:'CHALLENGED',amountMinor:80,txHash:original,createdAt:'2020-01-01T00:00:00Z',quote:{...identity,quoteId:'fixture',quoteHash:original,amountMinor:80,currency:'SGD',expiresAt:'2020-01-01T00:00:00Z',contentDigest:'fixture',payment:{rail:'xrpl-testnet',network:'xrpl:1',asset,payTo:writer.classicAddress,amountDrops:amount,invoiceId:original}}})
  db.prepare('INSERT INTO intents VALUES (?,?,?)').run('late',r.runId,JSON.stringify(intent));db.close()
  s=resources().own(new Store(path))
  s.recordRefundCandidate('late',hash)
  s.recordChallengeOutcome('late','CHALLENGE_REFUSED')
  expect(s.prune({olderThanDays:0}).runIds).toEqual([])
  s.close();s=resources().own(new Store(path))
  let valid=false
  let wrong=false
  const delivered = kind === 'XRP' ? amount : {currency:RLUSD_CURRENCY,issuer:asset === 'XRP' ? '' : asset.issuer,value:amount}
  const ledger:Ledger={request:async()=>({result: valid ? {validated:true,tx_json:{TransactionType:'Payment',Account:wrong ? buyer.classicAddress : writer.classicAddress,Destination:buyer.classicAddress,Amount:delivered,InvoiceID:original},meta:{TransactionResult:'tesSUCCESS',delivered_amount:delivered},ledger_index:123} : {validated:true,tx_json:{TransactionType:'Payment',Account:writer.classicAddress,Destination:buyer.classicAddress,Amount:delivered,InvoiceID:'C'.repeat(64)},meta:{TransactionResult:'tesSUCCESS',delivered_amount:delivered},ledger_index:123}})}
  const payer=new XrplPayer(ledger,buyer)
  const sign=vi.spyOn(buyer,'sign')
  const manager=new PurchaseManager(s,new PublisherClient(),payer)
  try {
    await reconcileRefunds(manager)
    expect(s.getIntent('late')!.status).toBe('CHALLENGE_REFUSED')
    valid=true;wrong=true;await reconcileRefunds(manager)
    expect(s.getRun(r.runId).refundedMinor).toBe(0)
    wrong=false
    const append=s.audit.append.bind(s.audit)
    const fault=vi.spyOn(s.audit,'append').mockImplementation(entry=>{if(entry.kind==='refund') throw new Error('synthetic atomic failure');return append(entry)})
    await expect(reconcileRefunds(manager)).rejects.toThrow('synthetic atomic failure')
    expect(s.getIntent('late')!.status).toBe('CHALLENGE_REFUSED')
    expect(s.getRun(r.runId).events.filter(e=>e.type==='REFUND')).toHaveLength(0)
    fault.mockRestore()
    await Promise.all([reconcileRefunds(manager),reconcileRefunds(manager)])
    await reconcileRefunds(manager)
    expect(s.getRun(r.runId)).toMatchObject({spentMinor:80,refundedMinor:80})
    expect(s.getRun(r.runId).events.filter(e=>e.type==='REFUND')).toHaveLength(1)
    expect(s.auditEntries().filter(e=>e.kind==='refund')).toHaveLength(1)
    expect(sign).not.toHaveBeenCalled()
  } finally { s.close() }
})
