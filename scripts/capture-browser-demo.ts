// Record the real fixture engine through its public HTTP/SSE path. No .env or live services.
import { once } from 'node:events'
import { writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
process.env.DOTENV_CONFIG_PATH = '.browser-demo-no-env'
process.env.LLM_PROVIDER = 'fixture'
process.env.DECISION_PROVIDER = 'fixture'
const testnet = process.argv.includes('--testnet')
process.env.SETTLEMENT_RAIL = testnet ? 'xrpl-testnet' : 'simulated'
process.env.SEARCH_EMBEDDINGS = 'off'
process.env.LANGFUSE_ENABLED = '0'
const { createApiApp } = await import('../server/routes.js')
const { createPublisherApp } = await import('../publisher/routes.js')
const { DEMO_QUESTIONS } = await import('../shared/contracts/examples.js')
import type { RunSnapshot } from '../shared/contracts/index.js'
const { testnetLedger, lookupTx } = await import('../shared/xrpl.js')
const ledger = testnet ? testnetLedger() : undefined
const publisher = createPublisherApp({ journal: ':memory:', rail: testnet ? 'xrpl-testnet' : 'simulated', env: testnet ? process.env : {}, ...(ledger ? { ledger } : {}) })
await publisher.locals.ready; await publisher.locals.writersReady
const pub = publisher.listen(0, '127.0.0.1'); await once(pub, 'listening')
const pubUrl = `http://127.0.0.1:${(pub.address() as { port: number }).port}`
try {
  for (const question of (testnet ? DEMO_QUESTIONS.filter(q => q.id === 'UC3') : DEMO_QUESTIONS.slice(0, 3))) {
    const api = await createApiApp({ dbPath: ':memory:', publisherUrl: pubUrl, reconcileIntervalMs: 0 })
    const server = api.app.listen(0, '127.0.0.1'); await once(server, 'listening')
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    const get = async (path: string, body?: unknown) => (await fetch(url + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined)).json()
    const abort = new AbortController()
    try {
      const scope = await get('/api/scope', { question: question.text })
      const created = await get('/runs', { question: question.text, budgetMinor: 200, plan: scope.plan, ...(question.id === 'UC2' ? { answers: { angle: 'pricing & margins' } } : {}) })
      if (!created.runId) throw Error('Run creation failed')
      const response = await fetch(`${url}/runs/${created.runId}/events`, { signal: abort.signal })
      if (!response.ok) throw Error(`SSE HTTP ${response.status}`)
      const reader = response.body!.getReader(), decoder = new TextDecoder()
      let buffer = '', run: RunSnapshot | undefined
      outer: for (;;) {
        const { value, done } = await reader.read()
        if (done) {
          // Oversize SSE frames deliberately close; recover through the durable public GET.
          const deadline = Date.now() + 120000
          do {
            run = await get(`/runs/${created.runId}`)
            if (testnet && !process.env.TESTNET_FIRST_HASH) {
              for (const i of run!.intents) if (i.txHash && (await lookupTx(ledger!, i.txHash)).state === 'validated') {
                process.env.TESTNET_FIRST_HASH = '1'; console.log(`First validated hash: ${((Date.now()-Number(process.env.TESTNET_STARTED_AT))/1000).toFixed(3)} s`); break
              }
            }
            if (run?.phase === 'DONE') break outer
            if (run?.phase === 'FAILED' || Date.now() > deadline) throw Error('Capture failed or timed out')
            await new Promise(r => setTimeout(r, 250))
          } while (Date.now() <= deadline)
        }
        buffer += decoder.decode(value, { stream: true })
        let end: number
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2)
          if (!frame.startsWith('event: snapshot\n')) continue
          run = JSON.parse(frame.slice(frame.indexOf('data: ') + 6))
          if (testnet && run?.intents.some(i => i.txHash && ['SETTLED','VERIFIED','CLAIM_FAILED','REFUNDED'].includes(i.status)) && !process.env.TESTNET_FIRST_HASH) { process.env.TESTNET_FIRST_HASH = '1'; console.log(`First validated hash: ${((Date.now() - Number(process.env.TESTNET_STARTED_AT))/1000).toFixed(3)} s`) }
          if (run?.phase === 'FAILED') throw new Error('Fixture failed')
          if (run?.phase === 'DONE') break outer
        }
      }
      const cards: Record<string, unknown> = {}
      for (const slug of new Set(run!.candidates.map(c => c.publisherSlug).filter(Boolean))) {
        const path = `/w/${slug}/.well-known/agent-publisher.json`
        cards[path] = await (await fetch(pubUrl + path)).json()
      }
      if (testnet) {
        if (!run!.intents.some(i => i.status === 'REFUNDED') || !run!.intents.some(i => i.status === 'VERIFIED')) throw Error('UC3 requires validated refund and re-buy')
        const transactions = []
        for (const intent of run!.intents) for (const hash of [intent.txHash, intent.refund?.txHash].filter(Boolean)) {
          const found = await lookupTx(ledger!, hash!)
          if (found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS') throw Error('Unvalidated capture')
          transactions.push({ hash, group:'Testnet UC3', kind:hash === intent.txHash?'purchase':'refund', date:new Date().toISOString().slice(0,10), ledgerIndex:found.ledgerIndex, feeDrops:found.tx.Fee, deliveredAmount:found.meta.delivered_amount, from:found.tx.Account, to:found.tx.Destination, invoiceId:found.tx.InvoiceID, source:'docs/evidence/round2-p2/transactions.json' })
        }
        await mkdir('docs/evidence/round2-p2', {recursive:true})
        await writeFile('docs/evidence/round2-p2/transactions.json', JSON.stringify({transactions},null,2)+'\n')
        console.log(transactions.map(t => `${t.kind}: ${t.hash}`).join('\n'))
      }
      await writeFile(`demo/traces/${testnet ? 'UC3-testnet' : question.id}.json`, JSON.stringify({ provenance: { source: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), capturedAt: new Date().toISOString(), transport: 'HTTP SSE snapshot + persisted event trace', mode: testnet ? 'Recorded on XRPL Testnet · no real value · fixture providers · fictional writers' : 'fixture providers · fictional writers · simulated payments' }, scope, health: await get('/api/health'), reputation: await get('/api/reputation'), cards, run }) + '\n')
      console.log(`${question.id}: ${run!.events.length} events, ${run!.grants.length} grants, ${run!.refundedMinor} refunded`)
    } finally {
      abort.abort(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await api.close()
    }
  }
} finally { pub.closeAllConnections(); await new Promise<void>(r => pub.close(() => r())); publisher.locals.journal.close(); await ledger?.close() }
