// Public catalogue plus the caller's own sales/trust history. Never serialize corpus bodies or raw intents.
import { Router } from 'express'
import { loadWriterCorpus } from '../../publisher/corpus.js'
import { confirmedSale, demoSalesByArticle } from '../hosted/writers.js'
import type { ApiContext } from './context.js'
export function writersRouter(context: ApiContext, hosted: boolean) {
  const router = Router()
  let identities: { at: number; value: ReturnType<ApiContext['client']['writerCatalogue']> } | undefined
  let catalogue: ReturnType<typeof loadWriterCorpus> | undefined
  router.get('/api/writers/earnings', async (_req, res) => {
    const corpus = await (catalogue ??= loadWriterCorpus().catch(error => { catalogue = undefined; throw error }))
    if (!identities || Date.now() - identities.at > 5000) identities = { at: Date.now(), value: context.client.writerCatalogue() }
    const served = await identities.value.catch(() => { identities = undefined; return undefined })
    const principal = hosted ? res.locals.hostedSession.principal as string : undefined
    const runs = context.store.listPastRuns(Number.NaN, principal).slice(0, 300).filter(r => !hosted || context.store.hostedState(db => Boolean(db.prepare('SELECT 1 FROM hosted_holds WHERE run_id=? AND principal=? AND created>?').get(r.runId,principal!,Date.now()-86400000))))
    const snapshots = runs.map(r => context.store.getRun(r.runId))
    const own = new Set(runs.map(r => r.runId))
    const testnet = new Set(snapshots.filter(r => /testnet/i.test(r.labels.settlement) && !/simulat/i.test(r.labels.settlement)).map(r => r.runId))
    const all = context.store.listIntents()
    const intents = all.filter(i => own.has(i.runId) && testnet.has(i.runId))
    // Hosted only (H9-15): confirmed sales across all visitors, as counts. Only a validated key reveal counts, so simulated
    // payments never do.
    const demo = hosted ? demoSalesByArticle(all) : undefined
    res.json({ scope: 'Your retained history only; not total writer earnings.', writers: corpus.writers.filter(w => !served || served.some(p => p.slug === w.publisherSlug)).slice(0, 100).map(writer => {
      const publisher = corpus.publishers.find(p => p.slug === writer.publisherSlug)!
      const articles = corpus.articles.filter(a => a.writerSlug === writer.slug)
      const ids = new Set(articles.map(a => a.articleId))
      const sales = intents.filter(i => i.profileId === writer.publisherSlug && ids.has(i.resourceId) && confirmedSale(i)).slice(0, 200)
      const trust = snapshots.flatMap(r => r.events.filter(e => e.type === 'REPUTATION' && e.data?.publisherSlug === writer.publisherSlug).map(e => ({ at: e.at, value: (e.data?.after as { T?: number } | undefined)?.T }))).filter((p): p is { at: string; value: number } => typeof p.value === 'number' && Number.isFinite(p.value)).sort((a,b) => a.at.localeCompare(b.at)).slice(-100)
      // `publisher` is the publication every receipt, source and proof names; `name` is the byline.
      return { slug: writer.slug, publisherSlug: writer.publisherSlug, name: writer.name, publisher: publisher.name,
        authorship: publisher.authorship === 'team-authored' ? 'Team-authored' : publisher.synthetic ? 'Fictional writer' : 'Author-supplied · unverified',
        synthetic: publisher.synthetic,
        verification: publisher.authorship === 'team-authored' ? served?.find(p => p.slug === writer.publisherSlug)?.verification ?? { status: 'check_failed' } : { status: 'unverified' },
        articleCount: articles.length, priceRange: articles.length ? [Math.min(...articles.map(a => a.priceMinor)), Math.max(...articles.map(a => a.priceMinor))] : undefined,
        articles: articles.slice(0,100).map(a => ({ id: a.articleId, title: a.title, priceMinor: a.priceMinor, tier: a.tier })),
        sales: sales.map(i => ({ finishHash: i.escrow!.finishHash, refunded: !!i.refund, refundHash: i.refund?.txHash })),
        trust,
        ...(demo ? { demoSales: articles.reduce((sum, a) => sum + (demo.get(`${writer.publisherSlug}/${a.articleId}`) ?? 0), 0) } : {}),
      }
    }) })
  })
  return router
}
