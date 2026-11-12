// Public catalogue plus the caller's own sales/trust history. Never serialize corpus bodies or raw intents.
import { Router } from 'express'
import { loadWriterCorpus } from '../../publisher/corpus.js'
import { confirmedSale, sandboxSalesByArticle } from '../hosted/writers.js'
import type { ApiContext } from './context.js'
import { TEAM_AUTHORED_PUBLISHERS } from '../../shared/writer-authorship.js'
import { PUBLIC_DOCS_PUBLISHERS } from '../../publisher/writers/public-docs.js'
export function writersRouter(context: ApiContext, hosted: boolean) {
  const router = Router()
  let identities: { at: number; value: ReturnType<ApiContext['client']['writerCatalogue']> } | undefined
  let catalogue: ReturnType<typeof loadWriterCorpus> | undefined
  let ledgerTopics: { at: number; value: ReturnType<ApiContext['client']['searchPublisher']> } | undefined
  router.get('/api/writers/earnings', async (_req, res) => {
    const corpus = await (catalogue ??= loadWriterCorpus().catch(error => { catalogue = undefined; throw error }))
    if (!identities || Date.now() - identities.at > 5000) identities = { at: Date.now(), value: context.client.writerCatalogue() }
    const served = await identities.value.catch(() => { identities = undefined; return undefined })
    // Reports live on the publisher's persistent disk, separate from the API image's static corpus.
    const liveLedger = process.env.LEDGER_ANALYTICS === '1' && served?.some(p => p.slug === 'ledger-analytics')
    if (liveLedger && (!ledgerTopics || Date.now() - ledgerTopics.at > 5000)) ledgerTopics = { at: Date.now(), value: context.client.searchPublisher('ledger-analytics','ledger',10) }
    const reports = liveLedger ? await ledgerTopics!.value.catch(() => { ledgerTopics = undefined; return [] }) : undefined
    const principal = hosted ? res.locals.hostedSession.principal as string : undefined
    const runs = context.store.listPastRuns(Number.NaN, principal).slice(0, 300).filter(r => !hosted || context.store.hostedState(db => Boolean(db.prepare('SELECT 1 FROM hosted_holds WHERE run_id=? AND principal=? AND created>?').get(r.runId,principal!,Date.now()-86400000))))
    const snapshots = runs.map(r => context.store.getRun(r.runId))
    const own = new Set(runs.map(r => r.runId))
    const testnet = new Set(snapshots.filter(r => /testnet/i.test(r.labels.settlement) && !/simulat/i.test(r.labels.settlement)).map(r => r.runId))
    const all = context.store.listIntents()
    const intents = all.filter(i => own.has(i.runId) && testnet.has(i.runId))
    // Demo totals use exactly the scoreboard population; personal history stays scoped to this visitor.
    const demo = hosted ? sandboxSalesByArticle(context.store) : undefined
    res.json({ scope: hosted ? 'Your purchases and trust come from your retained history. Settled sales on this demo since 11 Nov (UTC) include all visitors and our test runs on XRPL Testnet, matching the scoreboard.' : 'Your purchases and trust come from your retained history.', writers: corpus.writers.filter(w => !served || served.some(p => p.slug === w.publisherSlug)).slice(0, 100).map(writer => {
      const publisher = corpus.publishers.find(p => p.slug === writer.publisherSlug)!
      const articles = writer.publisherSlug === 'ledger-analytics' && reports ? reports.map(a => ({ articleId: a.articleId, title: a.title, priceMinor: a.priceMinor, tier: a.tier })) : corpus.articles.filter(a => a.writerSlug === writer.slug)
      const ids = new Set(articles.map(a => a.articleId))
      const sales = intents.filter(i => i.profileId === writer.publisherSlug && ids.has(i.resourceId) && confirmedSale(i)).slice(0, 200)
      const trust = snapshots.flatMap(r => r.events.filter(e => e.type === 'REPUTATION' && e.data?.publisherSlug === writer.publisherSlug).map(e => ({ at: e.at, value: (e.data?.after as { T?: number } | undefined)?.T }))).filter((p): p is { at: string; value: number } => typeof p.value === 'number' && Number.isFinite(p.value)).sort((a,b) => a.at.localeCompare(b.at)).slice(-100)
      // `publisher` is the publication every receipt, source and proof names; `name` is the byline.
      return { slug: writer.slug, publisherSlug: writer.publisherSlug, name: writer.name, publisher: publisher.name,
        authorship: PUBLIC_DOCS_PUBLISHERS.has(publisher.slug) ? 'Public documentation' : TEAM_AUTHORED_PUBLISHERS.has(publisher.slug) ? 'Team-authored' : publisher.synthetic ? 'Fictional writer' : 'Author-supplied · unverified',
        synthetic: publisher.synthetic,
        verification: TEAM_AUTHORED_PUBLISHERS.has(publisher.slug) ? served?.find(p => p.slug === writer.publisherSlug)?.verification ?? { status: 'check_failed' } : { status: 'unverified' },
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
