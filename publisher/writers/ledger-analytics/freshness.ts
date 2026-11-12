import type { Manifest } from '../../../shared/contracts/manifest.js'
import { publicLedger, type ReadLedger } from './read-only.js'
import { reportStamp } from '../../../shared/ledger-report.js'
export { reportStamp } from '../../../shared/ledger-report.js'
const closeTime=(ledger:Record<string,unknown>)=>{
  const at=typeof ledger.close_time_iso==='string'?Date.parse(ledger.close_time_iso):(Number(ledger.close_time)+946684800)*1000
  if(!Number.isFinite(at)) throw Error('Ledger close time unavailable')
  return at
}
/** Same-network header checks: Mainnet index is never compared with Testnet's. */
export async function checkFreshness(body:string, manifest:Manifest, purchasedAt:string, read?:ReadLedger, purchaseTestnetLedger?:number):Promise<{ok:boolean;failedClaimId?:string;reason:string}> {
  if(manifest.publisherSlug!=='ledger-analytics') return {ok:true,reason:'No ledger freshness promise'}
  const claim=manifest.claims.find(c=>c.id==='p1:dated-figure')
  try {
    if(!claim) throw Error('Freshness claim absent')
    const s=reportStamp(body), rpc=read ?? publicLedger(s.network)
    if(manifest.ledgerFreshness) {
      const {topic,...promised}=manifest.ledgerFreshness
      if(!manifest.articleId.startsWith(`ledger-${topic}-`) || Object.entries(s).some(([key,value])=>promised[key as keyof typeof promised]!==value)) throw Error('Manifest freshness differs from the signed report')
    }
    let at=Date.parse(purchasedAt)
    if (purchaseTestnetLedger !== undefined) {
      const purchase=await publicLedger('testnet')('ledger',{ledger_index:purchaseTestnetLedger})
      if (purchase.validated!==true || Number(purchase.ledger_index)!==purchaseTestnetLedger || !purchase.ledger) throw Error('Validated purchase ledger required')
      at=closeTime(purchase.ledger as Record<string,unknown>)
    }
    if(!Number.isFinite(at) || Date.parse(s.computedAt)>at) throw Error('Report computed after purchase')
    const header=await rpc('ledger',{ledger_index:s.ledgerIndex}), ledger=header.ledger as Record<string,unknown>
    if(header.validated!==true || Number(header.ledger_index)!==s.ledgerIndex || header.ledger_hash!==s.ledgerHash || !ledger) throw Error('Report ledger header does not match')
    if(closeTime(ledger)>at) throw Error('Report ledger closed after purchase')
    // The first ledger beyond the signed bound must close AFTER the purchase.
    // This historical check also works when the buyer retries or challenges later.
    const current=await rpc('ledger',{ledger_index:'validated'})
    if(current.validated!==true || !Number.isSafeInteger(Number(current.ledger_index)) || Number(current.ledger_index)<s.ledgerIndex) throw Error('Validated network tip unavailable')
    if(Number(current.ledger_index)>s.ledgerIndex+s.maxLedgerLag) {
      const boundary=await rpc('ledger',{ledger_index:s.ledgerIndex+s.maxLedgerLag+1})
      if(boundary.validated!==true || Number(boundary.ledger_index)!==s.ledgerIndex+s.maxLedgerLag+1 || !boundary.ledger) throw Error('Freshness boundary unavailable')
      if(closeTime(boundary.ledger as Record<string,unknown>)<=at) return {ok:false,failedClaimId:claim.id,reason:'Report was stale at purchase'}
    }
    return {ok:true,reason:`Within ${s.maxLedgerLag} ledgers at purchase on ${s.network}`}
  } catch { return {ok:false,failedClaimId:claim?.id ?? 'p1:dated-figure',reason:'Ledger freshness could not be verified'} }
}
