import { Router } from 'express'
import type { ApiContext } from './context.js'
import { z } from 'zod'
import { startRun } from './runs.js'

export function mcpRouter(context: ApiContext) {
  const router = Router()
  router.post('/api/mcp/runs', startRun(context, 'mcp'))
  const { store, client, payer, labels, publisherUrl, mcpPolicy } = context
  router.get('/api/mcp/runs/:id', (req, res) => {
    if (!store.isMcpRun(String(req.params.id))) return res.status(404).json({ error: 'Run not found.' })
    res.json(store.getRun(String(req.params.id)))
  })
  router.get('/api/mcp/status', async (_req, res) => {
    const agent = res.locals.agent ? store.agentStatus(res.locals.agent.id) : undefined
    res.json({ labels, corpusLabel: 'SYNTHETIC · fictional writers and articles', publisherUrl, ...mcpPolicy, ...store.mcpStatus(), ...(agent ? { ...agent, agent } : {}), wallet: store.walletStatus(), paused: store.isPaused() || Boolean(agent?.paused), rail: payer ? 'xrpl-testnet' : 'simulated', payerAddress: payer?.address ?? null })
  })
  router.get('/api/mcp/search', async (req, res) => {
    const { query, k } = z.object({ query: z.string().trim().min(1).max(2000), k: z.coerce.number().int().min(1).max(50).default(10) }).parse(req.query)
    const writers = await client.registry()
    const found = await Promise.allSettled(writers.map(async writer => (await client.searchPublisher(writer.slug, query, k)).map(hit => ({ untrusted: true, title: hit.title, writer: writer.name, tier: hit.tier, priceMinor: hit.priceMinor, abstract: hit.abstract, relevance: hit.relevance, url: new URL(hit.url, publisherUrl).href }))))
    res.json({ labels, corpusLabel: 'SYNTHETIC · fictional writers and articles', hits: found.flatMap(result => result.status === 'fulfilled' ? result.value : []).sort((a, b) => b.relevance - a.relevance).slice(0, k), unavailable: writers.filter((_, i) => found[i].status === 'rejected').map(w => w.slug) })
  })
  return router
}
