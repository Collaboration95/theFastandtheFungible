import { createApiApp } from '../server/routes.js'
import { createClient } from '../sdk/index.js'
import { auditRuns } from './gate-audit.js'
import { createServer } from 'node:http'
import { decide } from '../server/agents/decision.js'
/** Offline finals topology proof. No inherited credentials, providers or Testnet. */
import { once } from 'node:events'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { publishSite } from '../publisher/publishing/publish.js'
import { createPublisherApp } from '../publisher/routes.js'
import { loadWriterCorpus } from '../publisher/corpus.js'
import { PublisherClient } from '../server/publisher-client.js'
import { retrieve, writeAnswer } from '../server/agents/research.js'
import { PurchaseManager } from '../server/purchases.js'
import { Store } from '../server/store.js'
import { receiptBundle } from '../server/receipt-bundle.js'
import { verifyAnswer } from '../sdk/verify.js'
import { sourceKey } from '../shared/source-identity.js'
import { presentRun } from '../sdk/present.js'

export async function demoMultiOrigin() {
  for (const name of Object.keys(process.env)) if (/(?:API_KEY|TOKEN|SEED|SECRET)$/.test(name)) delete process.env[name]
  Object.assign(process.env,{LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SEARCH_EMBEDDINGS:'off',SETTLEMENT_RAIL:'simulated',LANGFUSE_ENABLED:'0'})
  const root = await mkdtemp(join(tmpdir(), 'ra-multi-origin-'))
  try {
  const folder = join(root, 'markdown'); await mkdir(folder)
  await writeFile(join(folder, 'evidence.md'), '---\ntitle: Capacity evidence\nabstract: Independent capacity analysis\ntier: PAID\nprice: 0.50\ntags: capacity\nsynthetic: true\n---\nOnly 240 of the 600 MW has confirmed energisation slots before 2028.\n\nSubstation works have slipped fourteen months.\n\nThe remaining capacity depends on new transmission infrastructure.\n\nAn independent engineering assessment identifies the critical commissioning constraints.\n' + ('The synthetic engineering scenario records planning assumptions and commissioning dependencies for comparison across independent reports. '.repeat(40)))
  const started = performance.now()
  const a = await publishSite({ folder, slug: 'collision', name: 'Fixture writer A', rail: 'simulated', port: 0, root: join(root, 'a'), env: {}, log: () => {} })
  const b = await publishSite({ folder, slug: 'collision', name: 'Fixture writer B', rail: 'simulated', port: 0, root: join(root, 'b'), env: {}, log: () => {} })
  const onboardingMs = performance.now() - started
  const roster = createPublisherApp({ writers: await loadWriterCorpus(new URL('../data/', import.meta.url)), rail: 'simulated', journal: ':memory:', env: {} }); await roster.locals.ready
  const server = roster.listen(0, '127.0.0.1'); await once(server, 'listening')
  const rosterUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const urls = [rosterUrl, a.baseUrl, b.baseUrl]
  const db = join(root, 'engine.db'); let store = new Store(db)
  try {
    const client = new PublisherClient({ baseUrls: urls })
    const found = await retrieve(client, 'capacity energisation slots')
    const mcpOrigins = await (async () => {
      const api=await createApiApp({dbPath:':memory:',publisherUrls:urls,reconcileIntervalMs:100000})
      const server=api.app.listen(0,'127.0.0.1');await once(server,'listening')
      try {
        const response=await createClient({baseUrl:`http://127.0.0.1:${(server.address() as {port:number}).port}`}).search('capacity',{k:50})
        const identities=response.hits.filter(h=>h.source?.profileId === 'collision').map(h=>h.source!)
        if (identities.length !== 2 || identities.some(s=>!found.candidates.some(c=>c.source && sourceKey(c) === sourceKey({source:s,resourceId:s.resourceId,version:s.version})))) throw new Error('SDK/MCP identity differs from research')
        return new Set(response.hits.map(h=>h.source?.origin)).size
      } finally {server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await api.close()}
    })()
    const run = store.createRun('capacity energisation slots', 200)
    store.updateRun(run.runId, { candidates: found.candidates })
    for (const content of found.contents) store.addContent(run.runId, content)
    const collided = found.candidates.filter(c => c.profileId === 'collision')
    if (collided.length !== 2 || new Set(collided.map(sourceKey)).size !== 2) throw new Error('Collided sources were lost')
    let manager = new PurchaseManager(store, client)
    for (const [i,candidate] of collided.entries()) {
      const decision = await decide({ question: run.question, conclusion: '', gap: 'capacity', candidates: [candidate], readSources: [], budgetMinor: 200, spentMinor: store.getRun(run.runId).spentMinor, reservedMinor: 0, perSourceCapMinor: 100, round: i+1, provider: { name: 'fixture', model: 'declared-two-origin-rubric', judgeRound: async () => ({gapMaterial:1}), judgeCandidate: async () => ({addressesGap:1,credibility:1,originality:{original:1,rewrite:0,overlap:0}}) } })
      if (decision.selectedSourceKey !== sourceKey(candidate)) throw new Error('Policy selected wrong origin')
      store.addDecision(run.runId,decision)
      store.appendEvent(run.runId,{type:'DECIDE',label:'Explicit fixture rubric'})
      const intentId=JSON.stringify([run.runId,i+1,sourceKey(candidate)])
      store.appendEvent(run.runId,{type:'BUY',label:'Policy selection',data:{intentId}})
      await Promise.all(Array.from({ length: 10 }, () => manager.purchase({ runId: run.runId, candidate, intentId })))
    }
    store.close(); store = new Store(db)
    manager = new PurchaseManager(store, new PublisherClient({ baseUrls: [rosterUrl] }))
    await manager.reconcile()
    const current = store.getRun(run.runId)
    const { answer } = await writeAnswer({ question: run.question, candidates: current.candidates, contents: current.contents, version: 1 })
    // Explicit fixture rubric: report each independently granted source's exact first passage.
    answer.claims = current.contents.filter(c => c.source?.profileId === 'collision').map(c => ({ id: sourceKey(c), text: c.spans[0].text, stance: 'SUPPORTS', citations: [{ source: c.source, resourceId: c.resourceId, version: c.version, spanId: c.spans[0].id }] }))
    answer.conclusion = answer.claims.map(c => c.text).join(' ')
    store.addAnswer(run.runId, answer)
    const gateAudit = auditRuns([store.getRun(run.runId)], { publishers: [], writers: [], articles: [...(await loadWriterCorpus(new URL('../data/', import.meta.url))).articles, ...a.corpus.articles, ...b.corpus.articles] })
    if (gateAudit.total) throw new Error(JSON.stringify(gateAudit))
    const bundle = receiptBundle(store, run.runId)
    const verified = await verifyAnswer(bundle)
    if (!verified.ok) throw new Error(JSON.stringify(verified.checks.filter(c => c.status === 'FAIL')))
    const presented = presentRun(store.getRun(run.runId), rosterUrl)
    b.server.closeAllConnections(); await new Promise<void>(r => b.server.close(() => r()))
    const deadStarted = performance.now(); const partial = await retrieve(client, 'capacity energisation slots'); const deadMs = performance.now() - deadStarted
    const hung = createServer(() => {}); await new Promise<void>(r => hung.listen(0,'127.0.0.1',r))
    let hungMs: number
    try { const start = performance.now(); await retrieve(new PublisherClient({baseUrls:[rosterUrl,a.baseUrl,`http://127.0.0.1:${(hung.address() as {port:number}).port}`]}), 'capacity energisation slots'); hungMs=performance.now()-start }
    finally {hung.closeAllConnections();await new Promise<void>(r=>hung.close(()=>r()))}
    return { mcpOrigins, gateAudit, hungMs, label: 'SYNTHETIC / SIMULATED / pinned-local-origin topology', urls, onboardingMs, originsFound: new Set(found.candidates.map(c => c.source?.origin)).size, collided: collided.map(c => c.source), sameWallet: collided[0].wallet === collided[1].wallet, receipts: current.receipts.length, spentMinor: current.spentMinor, grants: current.grants.length, citations: presented.citations.filter(c => c.source?.profileId === 'collision'), deadMs, healthyOrigins: new Set(partial.candidates.map(c => c.source?.origin)).size, verification: verified, bundle, root }
  } finally { store.close(); for (const s of [a.server,b.server,server]) { s.closeAllConnections(); if(s.listening) await new Promise<void>(r => s.close(() => r())) }; roster.locals.journal.close() }
  } finally {
    if(process.env.KEEP_CONSUMER_SCRATCH === '1') console.log('Multi-origin scratch retained: '+root)
    else await rm(root,{recursive:true,force:true})
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes('--fixture')) throw new Error('--fixture required')
  const outputIndex = process.argv.indexOf('--output')
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : 'scratch/multi-origin.json'
  if (!output || output.startsWith('--')) throw new Error('--output requires a path')
  const result = await demoMultiOrigin(); await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(result,null,2)); console.log(JSON.stringify({ origins: result.originsFound, receipts: result.receipts, deadMs: result.deadMs, onboardingMs: result.onboardingMs, verified: result.verification.ok }))
}
