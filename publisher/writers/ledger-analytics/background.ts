import { deriveAddress, deriveKeypair } from 'ripple-keypairs'
import { mkdirSync, writeFileSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import type { PublisherEntry } from '../../registry.js'
import { buildIndex } from '../../search.js'
import { validateWriterCorpus, type Article } from '../../../shared/contracts/writers.js'
import { LEDGER_REPORT_TOPICS, LEDGER_REPORT_POLICY, ledgerFreshness, type LedgerReportTopic } from '../../../shared/ledger-report.js'
import { computeReport } from './reports.js'
import { publicLedger, validatedHeader, type Network, type ReadLedger } from './read-only.js'

export type BackgroundOptions = {
  read?: (network: Network) => ReadLedger
  compute?: typeof computeReport
  accounts?: string[]
  directory?: string
  now?: () => number
  /** Startup jobs are staggered; periodic refreshes retain those offsets. */
  staggerMs?: number
  onComplete?: (topic: LedgerReportTopic, report: Awaited<ReturnType<typeof computeReport>>) => void
}
type Tip = { index: number; checkedAt: number }
export type LedgerAnalyticsService = {
  listed: (article: Article) => boolean; prewarmed: Promise<void>
  refresh: (topic: LedgerReportTopic) => Promise<void>; poll: () => Promise<void>; stop: () => Promise<void>
}
const services = new WeakMap<PublisherEntry, LedgerAnalyticsService>()
const projectAccounts = (entry:PublisherEntry) => process.env.LEDGER_PROJECT_ACCOUNTS?.split(',').map(a=>a.trim()).filter(Boolean) ?? [...new Set([
  ...Object.entries(process.env).filter(([key,value])=>/^XRPL_(?:PAYER|PUBLISHER_[A-Z0-9_]+)_SEED$/.test(key) && value).map(([,seed])=>deriveAddress(deriveKeypair(seed!).publicKey)),
  ...(entry.keys && !entry.keys.simulated ? [entry.keys.wallet] : []),
])]

/** No network or computation is awaited by a search. Unknown/stale tips fail closed. */
export function reportListed(entry: PublisherEntry, article: Article): boolean {
  if(entry.publisher.slug!=='ledger-analytics') return true
  return services.get(entry)?.listed(article) ?? Boolean(ledgerFreshness(article))
}

export async function startLedgerAnalytics(entry: PublisherEntry, options: BackgroundOptions = {}): Promise<LedgerAnalyticsService> {
  const now = options.now ?? Date.now, abort = new AbortController()
  const reads = new Map<Network,ReadLedger>(), tips = new Map<Network,Tip>()
  const snapshots = new Map<LedgerReportTopic,Article>(), pending = new Map<LedgerReportTopic,Promise<void>>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const initial = new Set<()=>void>()
  const root = resolve(options.directory ?? process.env.LEDGER_REPORT_DIR ?? 'data/ledger-reports')
  let stopped = false, indexing: Promise<void> = Promise.resolve(), polling: Promise<void> | undefined
  const read = (network:Network) => {
    if(!reads.has(network)) reads.set(network, options.read?.(network) ?? publicLedger(network,fetch,abort.signal))
    return reads.get(network)!
  }
  const fresh = (article:Article) => {
    const stamp=ledgerFreshness(article)
    if(!stamp) return false
    const policy=LEDGER_REPORT_POLICY[stamp.topic],tip=tips.get(stamp.network)
    if(stamp.network!==policy.network || stamp.maxLedgerLag!==policy.maxLedgerLag || !tip) return false
    const age=now()-tip.checkedAt
    // Withdraw on stale node telemetry; extrapolate conservatively between polls.
    return age>=0 && age<=10_000 && tip.index>=stamp.ledgerIndex && tip.index+Math.ceil(age/3500)-stamp.ledgerIndex<=stamp.maxLedgerLag
  }
  const listed = (article:Article) => {
    const stamp=ledgerFreshness(article)
    return Boolean(stamp && snapshots.get(stamp.topic)?.articleId===article.articleId && fresh(article))
  }
  const rebuild = () => {
    const work=indexing.then(async()=>{entry.index=await buildIndex([...snapshots.values()].filter(fresh))})
    indexing=work.catch(()=>undefined)
    return work
  }
  for(const article of entry.articles) {
    const stamp=ledgerFreshness(article)
    if(stamp && (!snapshots.has(stamp.topic) || snapshots.get(stamp.topic)!.publishedAt<article.publishedAt)) snapshots.set(stamp.topic,article)
  }
  // Retained bytes are available for historical paid retries, but not listed until checked.
  await rebuild()
  const poll = () => polling ??= Promise.all((['mainnet','testnet'] as const).map(async network=>{
    try {
      const header=await validatedHeader(read(network))
      if(!stopped) tips.set(network,{index:header.ledgerIndex,checkedAt:now()})
    } catch { /* A failed read never declares an old snapshot current. */ }
  })).then(async()=>{if(!stopped) await rebuild()}).finally(()=>{polling=undefined})
  const refresh = (topic:LedgerReportTopic) => {
    if(stopped) return Promise.resolve()
    const existing=pending.get(topic)
    if(existing) return existing
    const work=(async()=>{
      const policy=LEDGER_REPORT_POLICY[topic]
      const report=await (options.compute ?? computeReport)(topic,{read:read(policy.network),accounts:options.accounts ?? projectAccounts(entry),signal:abort.signal,now:()=>new Date(now())})
      if(stopped) return
      validateWriterCorpus({publishers:[entry.publisher],writers:entry.writers,articles:[report.article]})
      const stamp=ledgerFreshness(report.article)
      if(!stamp || stamp.topic!==topic || stamp.maxLedgerLag!==policy.maxLedgerLag || stamp.network!==policy.network) throw Error('Report promise differs from topic policy')
      mkdirSync(root,{recursive:true,mode:0o700})
      const path=join(root,report.article.articleId+'.json')
      writeFileSync(path+'.tmp',JSON.stringify(report.article)+'\n',{mode:0o600});renameSync(path+'.tmp',path)
      if(!entry.articles.some(a=>a.articleId===report.article.articleId)) entry.articles.push(report.article)
      snapshots.set(topic,report.article)
      const prior=tips.get(policy.network)
      if(!prior || report.latestLedgerIndex>=prior.index) tips.set(policy.network,{index:report.latestLedgerIndex,checkedAt:now()})
      // Concurrent topics cannot replace each other's current search index.
      await rebuild()
      options.onComplete?.(topic,report)
    })().finally(()=>pending.delete(topic))
    pending.set(topic,work)
    return work
  }
  const timer = (callback:()=>void, ms:number, interval=false) => {
    const handle=interval?setInterval(callback,ms):setTimeout(callback,ms)
    handle.unref();timers.add(handle)
  }
  const prewarmed = Promise.all(LEDGER_REPORT_TOPICS.map((topic,index)=>new Promise<void>(resolve=>{
    initial.add(resolve)
    timer(()=>{
      void refresh(topic).catch(()=>{}).finally(()=>{initial.delete(resolve);resolve()})
      timer(()=>{void refresh(topic).catch(()=>{})},LEDGER_REPORT_POLICY[topic].refreshMs,true)
    },index*(options.staggerMs ?? 2000))
  }))).then(()=>undefined)
  void poll().catch(()=>{})
  timer(()=>{void poll().catch(()=>{})},3500,true)
  const service={listed,prewarmed,refresh,poll,async stop(){
    stopped=true;abort.abort()
    for(const handle of timers) clearTimeout(handle)
    for(const resolve of initial) resolve()
    await Promise.allSettled([...pending.values(),...(polling?[polling]:[]),indexing])
  }}
  services.set(entry,service)
  return service
}
