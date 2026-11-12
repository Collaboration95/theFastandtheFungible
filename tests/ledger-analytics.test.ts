import { expect, it, vi } from 'vitest'
import { computeReport, decimal, format } from '../publisher/writers/ledger-analytics/reports.js'
import { publicLedger, type ReadLedger } from '../publisher/writers/ledger-analytics/read-only.js'
import { checkFreshness } from '../publisher/writers/ledger-analytics/freshness.js'
import { simulatedKeys } from '../publisher/registry.js'
import { createManifests } from '../publisher/manifest.js'
import { PublisherJournal } from '../publisher/journal.js'
import { validateWriterCorpus } from '../shared/contracts/writers.js'
import { ledgerCorpus } from '../publisher/writers/ledger-analytics/catalogue.js'
import { verifyDelivery, verifyManifestSignature } from '../shared/manifest.js'
const hash='A'.repeat(64), at='2026-11-12T09:00:00.000Z'
const header={validated:true,ledger_index:100,ledger_hash:hash,ledger:{close_time_iso:'2026-11-12T08:59:59Z'}}
const read:ReadLedger=async(c,_p)=>c==='ledger'?header:c==='amm_info'?{...header,amm:{account:'rAMM',amount:'1000000',amount2:{value:'12'},trading_fee:100}}:c==='ledger_data'?{...header,state:[{LedgerEntryType:'Escrow',Amount:'1000000'},{LedgerEntryType:'Escrow',Amount:{value:'2'}}]}:c==='account_info'?{...header,account_data:{Balance:'1000000',Sequence:4,OwnerCount:2}}:{...header,lines:[{account:'rHolder1',currency:'524C555344000000000000000000000000000000',balance:'-90.00000001'},{account:'rHolder2',currency:'524C555344000000000000000000000000000000',balance:'-10'},{account:'rOther',currency:'USD',balance:'-1000000'}]}
it('permits public read methods only, and never submits on Mainnet', async()=>{
  let calls=0
  const rpc=publicLedger('mainnet',async()=>{calls++;return Response.json({result:header})})
  await expect(rpc('submit',{tx_blob:'secret'})).rejects.toThrow('Only public ledger reads')
  await expect(rpc('simulate')).rejects.toThrow('Only public ledger reads')
  expect(calls).toBe(0)
})
it('keeps supply decimal arithmetic exact',()=>{expect(format(decimal('9.00000001')+decimal('1e-8'))).toBe('9.00000002')})
for(const topic of ['rlusd','amm','project-activity'] as const) it(`computes and signs the normal ${topic} article manifest`,async()=>{
  const report=await computeReport(topic,{read,accounts:['rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'],now:()=>new Date(at)})
  validateWriterCorpus({...ledgerCorpus(),articles:[report.article]})
  const journal=new PublisherJournal(':memory:')
  try {
    const keys=simulatedKeys('ledger-analytics'), entry={publisher:{slug:'ledger-analytics',wallet:keys.wallet,pubKey:keys.publicKey},keys}
    const proofs=createManifests(journal), manifest=proofs.manifestFor(entry,report.article,0.7)!
    expect(verifyManifestSignature(manifest)).toBe(true)
    expect(manifest.ledgerFreshness?.maxLedgerLag).toBe(report.stamp.maxLedgerLag)
    const altered={...manifest,ledgerFreshness:{...manifest.ledgerFreshness!,maxLedgerLag:report.stamp.maxLedgerLag+1}}
    expect(verifyManifestSignature(altered)).toBe(false)
    expect((await checkFreshness(report.article.body,altered,at,read)).ok).toBe(false)
    expect(verifyDelivery(report.article.body,report.article.passages,proofs.saltsFor(report.article),manifest).ok).toBe(true)
    expect((await checkFreshness(report.article.body,manifest,at,read)).ok).toBe(true)
    const stale:ReadLedger=async(c,p)=>p?.ledger_index===100?header:p?.ledger_index==='validated'?{...header,ledger_index:100+report.stamp.maxLedgerLag+10}:{...header,ledger_index:101+report.stamp.maxLedgerLag,ledger:{close_time_iso:at}}
    expect((await checkFreshness(report.article.body,manifest,at,stale)).ok).toBe(false)
    const missingTime:ReadLedger=async()=>({...header,ledger:{}})
    expect((await checkFreshness(report.article.body,manifest,at,missingTime)).ok).toBe(false)
    expect((await checkFreshness(report.article.body.replace(hash,'B'.repeat(64)),manifest,at,read)).ok).toBe(false)
    if(topic==='rlusd') {expect(report.metrics.rlusdSupply).toBe('100.00000001');expect(report.metrics.positiveBalanceTrustLines).toBe(2)}
  } finally {journal.close()}
})
it('disables global escrow reports until a complete live scan is measured',async()=>{
  await expect(computeReport('escrows',{read})).rejects.toThrow('Global escrow reports are disabled')
})
it('never labels an incomplete or shifting ledger scan as a report',async()=>{
  const repeated:ReadLedger=async(c)=>c==='ledger'?header:{...header,lines:[],marker:'same'}
  await expect(computeReport('rlusd',{read:repeated})).rejects.toThrow('Repeated ledger marker')
  await expect(computeReport('rlusd',{read:async c=>c==='ledger'?header:{...header,ledger_index:101,lines:[]}})).rejects.toThrow('not bound')
})
it('rejects a report when its final read crosses the computation deadline',async()=>{
  const clock=vi.spyOn(Date,'now').mockReturnValue(0)
  let headers=0
  const delayed:ReadLedger=async(c,p)=>{
    const result=await read(c,p)
    if(c==='ledger' && ++headers===2) clock.mockReturnValue(240_001)
    return result
  }
  try {await expect(computeReport('amm',{read:delayed})).rejects.toThrow('exceeded four minutes')}
  finally {clock.mockRestore()}
})
