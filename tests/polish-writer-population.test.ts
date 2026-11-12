// Synthetic retained SQLite rows only: no model calls, Testnet transactions or private visitor data.
import express from 'express'
import { once } from 'node:events'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { Store } from '../server/store.js'
import { HostedLimits } from '../server/hosted/limits.js'
import { loadConfig } from '../server/config.js'
import { writersRouter } from '../server/api/writers.js'
import type { ApiContext } from '../server/api/context.js'
import { sandboxStatsRouter } from '../server/hosted/stats.js'
import { seedSandbox } from './helpers/sandbox-seed.js'
import { resources } from './helpers/resource-scope.js'

it('Writers and scoreboard agree across admission dates, rails, statuses, cancellation and missing receipts', async () => {
  const store = new Store(join(resources().tempDir('polish-sales-'), 'store.db'))
  new HostedLimits(store, loadConfig({ HOSTED: '1', HOSTED_IP_HMAC_KEY: 'test-only-'.repeat(5) }))
  seedSandbox(store, 20)
  store.hostedState(db => {
    db.prepare(`UPDATE intents SET json=json_set(json,'$.profileId','team-xrpl-explainers','$.resourceId','product-writer-paid')`).run()
    db.prepare(`UPDATE runs SET json=json_set(json,'$.labels.settlement','SIMULATED SGD · no real funds') WHERE id='synthetic-0'`).run()
    db.prepare(`UPDATE hosted_holds SET day='2026-11-10' WHERE run_id='synthetic-1'`).run()
    db.prepare(`DELETE FROM hosted_holds WHERE run_id='synthetic-4'`).run()
    db.prepare(`UPDATE intents SET json=json_set(json,'$.escrow.state','CANCELLED','$.status','FAILED_NOT_SETTLED') WHERE id='intent-5'`).run()
    db.prepare(`UPDATE intents SET json=json_set(json,'$.status','PENDING') WHERE id='intent-8'`).run()
    db.prepare(`DELETE FROM receipts WHERE intent_id='intent-8'`).run()
    // Scope hold created before the cutoff, but admitted on/after it: include it.
    db.prepare(`UPDATE hosted_holds SET day='2026-11-10',started_day='2026-11-11' WHERE run_id='synthetic-12'`).run()
    db.prepare(`UPDATE hosted_holds SET day='2026-11-12' WHERE run_id='synthetic-16'`).run()
    db.prepare(`UPDATE runs SET json=json_set(json,'$.labels.settlement','Other testnet rail') WHERE id='synthetic-17'`).run()
  })
  const app = express()
  app.use(sandboxStatsRouter(store))
  app.use((_req, res, next) => { res.locals.hostedSession = { principal: 'fresh-visitor' }; next() })
  app.use(writersRouter({ store, client: { writerCatalogue: async () => [{ slug: 'team-xrpl-explainers' }] } } as unknown as ApiContext, true))
  const server = app.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const statsResponse = await fetch(`${origin}/api/demo/stats`)
    const writersResponse = await fetch(`${origin}/api/writers/earnings`)
    expect([statsResponse.status, writersResponse.status]).toEqual([200, 200])
    const stats = await statsResponse.json()
    const writers = await writersResponse.json()
    expect(stats.purchasesSettled).toBe(4)
    expect(writers.writers.reduce((n: number, w: { demoSales: number }) => n + w.demoSales, 0)).toBe(stats.purchasesSettled)
    expect(writers.scope).toContain('matching the scoreboard')
    for (const w of writers.writers) expect(w.sales).toEqual([])
    expect(JSON.stringify(writers)).not.toMatch(/PRIVATE_|synthetic-principal|intent-\d|synthetic-\d/)
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()))
    store.close()
  }
})
