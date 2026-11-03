// Equivalent to make testnet's isolated faucet setup, with a durable anchor receipt.
import { prepare, provision } from './testnet-wallets.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { once } from 'node:events'
const { env, fallback } = await prepare(async () => { try { return await provision() } catch (e) { console.error('Provisioning stage:', e instanceof Error ? e.message : 'unavailable'); throw e } })
if (fallback) throw Error('Live anchor unavailable: public Testnet faucet/network provisioning failed')
for (const name of Object.keys(process.env)) delete process.env[name]
Object.assign(process.env, env, { ANCHOR_RAIL: 'xrpl-testnet' })
const { createApiApp } = await import('../server/routes.js')
const { createPublisherApp } = await import('../publisher/routes.js')
const { receiptBundle } = await import('../server/receipt-bundle.js')
const { DEMO_QUESTIONS } = await import('../shared/contracts/examples.js')
const pubApp = createPublisherApp({ journal: ':memory:', rail: 'xrpl-testnet', env: process.env })
await pubApp.locals.ready; await pubApp.locals.writersReady
const pub = pubApp.listen(0, '127.0.0.1'); await once(pub, 'listening')
const api = await createApiApp({ dbPath: 'scratch/testnet-first-touch/anchor.db', publisherUrl: `http://127.0.0.1:${(pub.address() as {port:number}).port}`, reconcileIntervalMs: 1000 })
try {
 const run = api.store.createRun(DEMO_QUESTIONS.find(q=>q.id==='UC3')!.text,200,{research:'fixture',decision:'fixture',publisher:'local',settlement:'XRPL TESTNET · no real value'})
 await api.loop.start(run.runId)
 const end = Date.now()+120000
 while (!api.store.getRun(run.runId).ledgerAnchor && Date.now()<end) { await api.reconcileOnce(); await new Promise(r=>setTimeout(r,1000)) }
 const bundle = receiptBundle(api.store,run.runId)
 if (!bundle.ledgerAnchor) throw Error('Live anchor not validated before deadline')
 await mkdir('docs/evidence/round2-t',{recursive:true})
 await writeFile('docs/evidence/round2-t/receipts.json',JSON.stringify(bundle,null,2)+'\n')
 console.log(JSON.stringify(bundle.ledgerAnchor))
} finally { await api.close(); await new Promise<void>(r=>pub.close(()=>r())); await pubApp.locals.close?.() }
