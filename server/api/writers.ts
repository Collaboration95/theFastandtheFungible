// Public catalogue plus the caller's own sales/trust history. Never serialize corpus bodies or raw intents.
import { Router } from 'express'
import { loadWriterCorpus } from '../../publisher/corpus.js'
import type { ApiContext } from './context.js'
export function writersRouter(context: ApiContext, hosted: boolean) {
  const router = Router()
  let catalogue: ReturnType<typeof loadWriterCorpus> | undefined
  router.get('/api/writers/earnings', async (_req, res) => {
    const corpus = await (catalogue ??= loadWriterCorpus().catch(error => { catalogue = undefined; throw error }))
    const principal = hosted ? res.locals.hostedSession.principal as string : undefined
    const runs = context.store.listPastRuns(Number.NaN, principal).slice(0, 300).filter(r => !hosted || context.store.hostedState(db => Boolean(db.prepare('SELECT 1 FROM hosted_holds WHERE run_id=? AND principal=? AND created>?').get(r.runId,principal!,Date.now()-86400000))))
    const snapshots = runs.map(r => context.store.getRun(r.runId))
    const own = new Set(runs.map(r => r.runId))
    const testnet = new Set(snapshots.filter(r => /testnet/i.test(r.labels.settlement) && !/simulat/i.test(r.labels.settlement)).map(r => r.runId))
    const intents = context.store.listIntents().filter(i => own.has(i.runId) && testnet.has(i.runId))
    res.json({ scope: 'Your retained history only; not total writer earnings.', writers: corpus.writers.slice(0, 100).map(writer => {
      const publisher = corpus.publishers.find(p => p.slug === writer.publisherSlug)!
      const articles = corpus.articles.filter(a => a.writerSlug === writer.slug).slice(0, 100)
      const ids = new Set(articles.map(a => a.articleId))
      const sales = intents.filter(i => i.profileId === writer.publisherSlug && ids.has(i.resourceId) && i.escrow?.finishHash && i.escrow.revealLedger && /^[A-F0-9]{64}$/i.test(i.escrow.finishHash)).slice(0, 200)
      const trust = snapshots.flatMap(r => r.events.filter(e => e.type === 'REPUTATION' && e.data?.publisherSlug === writer.publisherSlug).map(e => ({ at: e.at, value: (e.data?.after as { T?: number } | undefined)?.T }))).filter((p): p is { at: string; value: number } => typeof p.value === 'number' && Number.isFinite(p.value)).sort((a,b) => a.at.localeCompare(b.at)).slice(-100)
      return { slug: writer.slug, publisherSlug: writer.publisherSlug, name: writer.name,
        authorship: publisher.synthetic ? 'Fictional writer' : publisher.slug.startsWith('team-') ? 'Team-authored' : 'Author-supplied · unverified',
        verification: snapshots.flatMap(r => r.candidates).find(c => c.publisherSlug === writer.publisherSlug && c.verification?.status === 'verified')?.verification ?? publisher.verification,
        articles: articles.map(a => ({ id: a.articleId, title: a.title, priceMinor: a.priceMinor, tier: a.tier })),
        sales: sales.map(i => ({ finishHash: i.escrow!.finishHash, refunded: !!i.refund, refundHash: i.refund?.txHash })),
        trust,
      }
    }) })
  })
  return router
}
