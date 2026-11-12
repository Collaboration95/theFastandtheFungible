import express from 'express'
import { once } from 'node:events'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { Store } from '../server/store.js'
import { HostedLimits } from '../server/hosted/limits.js'
import { loadConfig } from '../server/config.js'
import { writersRouter } from '../server/api/writers.js'
import type { ApiContext } from '../server/api/context.js'
import { resources } from './helpers/resource-scope.js'

it('shows publisher-prewarmed ledger topics when the API disk has no report copies, exposing metadata only', async () => {
  const dir = resources().tempDir('ledger-catalogue-')
  vi.stubEnv('LEDGER_ANALYTICS','1'); vi.stubEnv('LEDGER_REPORT_DIR',join(dir,'empty'))
  const store = new Store(join(dir,'app.db'))
  new HostedLimits(store,loadConfig({HOSTED:'1',HOSTED_IP_HMAC_KEY:'test-only-'.repeat(5)}))
  const search = vi.fn().mockResolvedValue([
    {articleId:'ledger-rlusd-current',title:'RLUSD holder concentration',tier:'PAID',priceMinor:40,body:'PRIVATE_PAID_REPORT'},
    {articleId:'ledger-amm-current',title:'RLUSD/XRP AMM pool statistics',tier:'PAID',priceMinor:40},
    {articleId:'ledger-project-current',title:'Project account activity',tier:'PAID',priceMinor:40},
  ])
  const app = express()
  app.use((_req,res,next)=>{res.locals.hostedSession={principal:'catalogue-visitor'};next()})
  app.use(writersRouter({store,client:{writerCatalogue:async()=>[{slug:'ledger-analytics'}],searchPublisher:search}} as unknown as ApiContext,true))
  const server=app.listen(0,'127.0.0.1');await once(server,'listening')
  try {
    const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/writers/earnings`
    const response=await fetch(url),body=await response.json()
    expect(response.status).toBe(200)
    expect(body.writers).toHaveLength(1)
    expect(body.writers[0]).toMatchObject({publisherSlug:'ledger-analytics',synthetic:false,articleCount:3})
    expect(body.writers[0].articles.map((a:{id:string})=>a.id)).toEqual(['ledger-rlusd-current','ledger-amm-current','ledger-project-current'])
    expect(JSON.stringify(body)).not.toContain('PRIVATE_PAID_REPORT')
    await fetch(url)
    expect(search).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledWith('ledger-analytics','ledger',10)
  } finally {server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));store.close();vi.unstubAllEnvs()}
})
