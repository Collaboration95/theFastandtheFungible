import { createHash } from 'node:crypto'
import { publicLedger, validatedHeader, type ReadLedger, type LedgerStamp, type RpcResult } from './read-only.js'
import type { Article } from '../../../shared/contracts/writers.js'
import { LEDGER_REPORT_POLICY } from '../../../shared/ledger-report.js'
export const RLUSD_ISSUER = 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'
export const RLUSD_CURRENCY = '524C555344000000000000000000000000000000'
export type Topic = 'rlusd' | 'escrows' | 'amm' | 'project-activity'
export const REPORT_TITLES: Record<Topic,string> = {rlusd:'RLUSD supply, trust-line holders and concentration',escrows:'Disabled global escrow diagnostic (not for sale)',amm:'RLUSD/XRP AMM pool statistics','project-activity':'ResearchAgent Testnet account activity'}
const rows = (v:unknown) => { if (!Array.isArray(v)) throw Error('Incomplete ledger page'); return v as RpcResult[] }
async function pages(read:ReadLedger, command:string, params:RpcResult, field:string) {
  const all:RpcResult[] = [], seen = new Set<string>(); let marker:unknown
  do {
    const r = await read(command,{...params, limit:400, ...(marker ? {marker} : {})})
    if (r.validated === false || Number(r.ledger_index) !== Number(params.ledger_index)) throw Error('Ledger page is not bound to the requested validated ledger')
    all.push(...rows(r[field])); marker=r.marker
    if (marker) { const key=JSON.stringify(marker); if(seen.has(key)) throw Error('Repeated ledger marker'); seen.add(key) }
    if (seen.size>100000) throw Error('Ledger scan exceeded its safety bound; report unavailable')
  } while(marker)
  return all
}
/** Decimal arithmetic stays integer-scaled at 10^-96; no floating-point supply totals. */
const SCALE=10n**96n
export function decimal(s:string):bigint {
  if(!/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(s)) throw Error('Invalid ledger decimal')
  const [m,e='0']=s.toLowerCase().split('e'), neg=m.startsWith('-'), [a,b='']=m.replace('-','').split('.'), exp=96+Number(e)-b.length
  const n=BigInt(a+b); return (neg?-1n:1n)*(exp>=0?n*10n**BigInt(exp):n/10n**BigInt(-exp))
}
export function format(n:bigint):string {const sign=n<0n?'-':''; const x=n<0n?-n:n; return sign+(x/SCALE).toString()+((x%SCALE)?'.'+(x%SCALE).toString().padStart(96,'0').replace(/0+$/,''):'')}
export async function computeReport(topic:Topic, options:{read?:ReadLedger; accounts?:string[]; now?:()=>Date;signal?:AbortSignal} = {}) {
  // Global scans have no complete live measurement. Never compute, list or sell this topic.
  if(topic==='escrows') throw Error('Global escrow reports are disabled pending complete live measurement')
  const started=Date.now(), network=LEDGER_REPORT_POLICY[topic].network, raw=options.read ?? publicLedger(network,fetch,options.signal), deadline=started+240_000
  const withinDeadline=()=>{options.signal?.throwIfAborted();if(Date.now()>deadline)throw Error('Public scan exceeded four minutes; no incomplete report sold')}
  const read:ReadLedger=async(command,params)=>{withinDeadline();const result=await raw(command,params);withinDeadline();return result}
  const start=await validatedHeader(read)
  const stamp:LedgerStamp={network,...start,computedAt:'',maxLedgerLag:LEDGER_REPORT_POLICY[topic].maxLedgerLag}
  let metrics:RpcResult
  if(topic==='rlusd') {
    const lines=await pages(read,'account_lines',{account:RLUSD_ISSUER,ledger_index:start.ledgerIndex},'lines')
    const balances=lines.filter(l=>l.currency===RLUSD_CURRENCY && decimal(String(l.balance))<0n).map(l=>({account:String(l.account),balance:-decimal(String(l.balance))})).sort((a,b)=>a.balance>b.balance?-1:a.balance<b.balance?1:0)
    const supply=balances.reduce((s,l)=>s+l.balance,0n), top10=balances.slice(0,10).reduce((s,l)=>s+l.balance,0n)
    metrics={rlusdSupply:format(supply),positiveBalanceTrustLines:balances.length,rlusdTrustLines:lines.filter(l=>l.currency===RLUSD_CURRENCY).length,top10Balance:format(top10),top10SharePercent:supply?format(top10*100n*SCALE/supply):'0',topHolders:balances.slice(0,10).map(l=>({account:l.account,balance:format(l.balance)})), scope:'XRPL-issued RLUSD only; trust-line accounts, not unique beneficial owners. Issuer-side negative balances count as issued supply; positive issuer balances are excluded.'}
  } else if(topic==='amm') {
    const r=await read('amm_info',{asset:{currency:'XRP'},asset2:{currency:RLUSD_CURRENCY,issuer:RLUSD_ISSUER},ledger_index:start.ledgerIndex})
    if(Number(r.ledger_index)!==start.ledgerIndex || r.validated===false || !r.amm) throw Error('Validated AMM snapshot unavailable')
    const a=r.amm as RpcResult; metrics={account:a.account,amount:a.amount,amount2:a.amount2,lpToken:a.lp_token,tradingFee:a.trading_fee,scope:'Single native AMM for the canonical RLUSD issuer and XRP; quantities and fee units as returned by amm_info.'}
  } else {
    if(!options.accounts?.length || options.accounts.some(a=>!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a))) throw Error('Explicit project Testnet account allowlist required')
    const accounts=[]
    for(const account of [...new Set(options.accounts)]) {
      const r=await read('account_info',{account,ledger_index:start.ledgerIndex})
      if(Number(r.ledger_index)!==start.ledgerIndex || r.validated===false) throw Error('Validated project account required')
      const d=r.account_data as RpcResult
      accounts.push({account,balanceDrops:d.Balance,sequence:d.Sequence,ownerCount:d.OwnerCount,previousTransaction:d.PreviousTxnID})
    }
    metrics={accounts,scope:'Configured project-owned Testnet accounts only. Current sequence, owned objects and previous transaction show account activity; no Mainnet account activity is inferred.'}
  }
  const end=await validatedHeader(read)
  if(end.ledgerIndex-start.ledgerIndex>stamp.maxLedgerLag || end.ledgerIndex<start.ledgerIndex) throw Error('Report expired during computation; no report sold')
  stamp.computedAt=(options.now?.() ?? new Date()).toISOString()
  const id=createHash('sha256').update(JSON.stringify({topic,stamp,metrics})).digest('hex').slice(0,24)
  const texts=[`As of validated ledger ${stamp.ledgerIndex} (hash ${stamp.ledgerHash}), computed at ${stamp.computedAt}. Network: ${network}. The writer promises this report is no more than ${stamp.maxLedgerLag} validated ledgers old at purchase. This timestamp describes a public ledger snapshot, not a market forecast or a statement about another network.`,
    `Computed ledger measurements: ${JSON.stringify(metrics)}. These values come only from public ledger read methods and refer to the exact validated ledger identified above. The report does not initiate ledger writes, transfer assets, infer the identity of beneficial owners, or estimate off-ledger balances.`,
    `Verification method: query the public ${network} node with ledger_index ${stamp.ledgerIndex}, confirm ledger_hash ${stamp.ledgerHash}, then repeat ${topic==='rlusd'?'account_lines for the RLUSD issuer, following every marker':topic==='amm'?'amm_info for XRP and the canonical RLUSD issuer':'account_info for each listed project account'}. All pages must use the same ledger index. An incomplete scan is an error and is never published as a zero total.`,
    `Evidence limits: ${String(metrics.scope)} Read the ledger header on an independent public node or explorer. A writer signature binds these exact report passages to the normal purchase manifest; it proves who signed the measurements, not that the node operator or issuer is trustworthy. Freshness must be checked at purchase on this report's network. A stale report is a broken promise and its content must not support an answer.`]
  const url=`https://${network==='mainnet'?'livenet.xrpl.org':'testnet.xrpl.org'}/ledgers/${stamp.ledgerIndex}`
  const article:Article={articleId:`ledger-${topic}-${id}`,version:id,publisherSlug:'ledger-analytics',writerSlug:'ledger-analytics',title:REPORT_TITLES[topic],publishedAt:stamp.computedAt,tier:'PAID',priceMinor:40,abstract:`Public ledger snapshot of ${REPORT_TITLES[topic].toLowerCase()}; writer-signed with a bounded freshness promise.`,tags:[topic,'ledger','analytics','RLUSD','XRP'],family:`ledger-${topic}`,sources:[{url,accessedAt:stamp.computedAt.slice(0,10)}],body:texts.join('\n\n'),passages:texts.map((text,i)=>({id:`p${i+1}`,text}))}
  return {article,stamp,metrics,computeTimeMs:Date.now()-started,latestLedgerIndex:end.ledgerIndex}
}
