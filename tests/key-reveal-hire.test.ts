import { it, expect, vi } from 'vitest'
import { Wallet } from 'xrpl'
import { createPublisherApp } from '../publisher/routes.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { seedEnvName } from '../publisher/registry.js'
import { createApiApp } from '../server/routes.js'
import { XrplPayer } from '../server/xrpl.js'
import { chain } from './fixtures/key-reveal-ledger.js'
import { payAndFetch } from '../sdk/x402.js'
import { openPaymentJournal } from '../sdk/x402-journal.js'
import { USE_CASES } from './scenarios/use-cases.js'

it('normal hire flow refunds and re-buys by key reveal across approved origins (SIMULATED ledger)', async () => {
  for (const [k,v] of Object.entries({ ESCROW_MODE:'key-reveal', LLM_PROVIDER:'fixture', DECISION_PROVIDER:'fixture', SEARCH_EMBEDDINGS:'off', RA_API_TOKEN:'fixture-hire', WALLET_DAILY_CAP_MINOR:'1000' })) vi.stubEnv(k,v)
  const c = chain(), corpus = await loadWriterCorpus()
  const env = { ESCROW_MODE:'key-reveal', ...Object.fromEntries(corpus.publishers.map(p => [seedEnvName(p.slug), Wallet.generate().seed!])) }
  const servers: ReturnType<ReturnType<typeof createPublisherApp>['listen']>[] = []
  const apps: ReturnType<typeof createPublisherApp>[] = []
  const listen = async (app: ReturnType<typeof createPublisherApp>) => { const s = app.listen(0,'127.0.0.1'); servers.push(s); await new Promise(r=>s.once('listening',r)); return `http://127.0.0.1:${(s.address() as {port:number}).port}` }
  const journal = openPaymentJournal(':memory:')
  let api: Awaited<ReturnType<typeof createApiApp>> | undefined
  try {
    const urls = []
    for (let n=0;n<2;n++) {
      const writers = { ...corpus, publishers: corpus.publishers.filter((_,i)=>i%2===n), articles: corpus.articles.filter(a=>corpus.publishers.findIndex(p=>p.slug===a.publisherSlug)%2===n) }
      const app=createPublisherApp({writers,rail:'xrpl-testnet',ledger:c.ledger,journal:':memory:',env,escrowWriters:corpus.publishers.map(p=>p.slug),facilitatorTiming:{pollMs:1,timeoutMs:100}})
      apps.push(app); await app.locals.ready; urls.push(await listen(app))
    }
    api=await createApiApp({dbPath:':memory:',publisherUrls:urls,payer:new XrplPayer(c.ledger,Wallet.generate(),{pollMs:1,timeoutMs:100})})
    const url=await listen(api.app)
    const result=await payAndFetch(url+'/v1/ask',{wallet:Wallet.generate(),maxDrops:'220000',journal,ledger:c.ledger,method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer fixture-hire'},body:JSON.stringify({question:USE_CASES.UC3.question,budgetMinor:200}),idempotencyKey:'escrow-hire'})
    const answer=await result.response.json()
    expect(answer.phase).toBe('DONE')
    const run=api.store.getRun(answer.run_id)
    expect(run.intents.some(i=>i.status==='REFUNDED' && i.escrow?.finishHash && i.refund?.txHash)).toBe(true)
    expect(run.intents.some(i=>i.status==='VERIFIED' && i.escrow?.decryptVerified)).toBe(true)
    expect(new Set(run.candidates.map(i=>i.source?.origin)).size).toBe(2)
  } finally {
    for (const s of servers.reverse()) { s.closeAllConnections(); await new Promise(r=>s.close(r)) }
    await api?.close(); for (const a of apps) a.locals.journal.close(); journal.close(); vi.unstubAllEnvs()
  }
},30000)
