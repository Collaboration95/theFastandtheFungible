// Record the real fixture engine through its public HTTP/SSE path. No .env or live services.
import { newRecord } from '../server/reputation.js'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { writeFile, mkdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
process.env.DOTENV_CONFIG_PATH = '.browser-demo-no-env'
process.env.LLM_PROVIDER = 'fixture'
process.env.DECISION_PROVIDER = 'fixture'
const noShow = process.argv.includes('--no-show')
const keyReveal = process.argv.includes('--key-reveal')
const evidencePath = keyReveal ? (noShow ? 'docs/evidence/round2-v1' : (process.argv.includes('--kestrel') ? 'docs/evidence/lane-b3/kestrel' : 'docs/evidence/lane-b3')) : 'docs/evidence/round2-p2'
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
// Labelled fixture fault: this writer never responds to a signed delivery request.
let noShowDelivery = false
const pub = createServer((req, res) => {
  if (noShow && req.url?.startsWith('/w/alphaleak/articles/') && (req.headers['payment-signature'] || noShowDelivery && req.url.endsWith('/escrow-quote'))) { noShowDelivery = true; res.writeHead(503).end('Fixture writer no-show'); return }
  publisher(req, res)
}).listen(0, '127.0.0.1'); await once(pub, 'listening')
const pubUrl = `http://127.0.0.1:${(pub.address() as { port: number }).port}`
try {
  for (const question of (testnet ? DEMO_QUESTIONS.filter(q => q.id === (process.argv.includes('--kestrel') ? 'UC2' : 'UC3')) : DEMO_QUESTIONS.slice(0, 3))) {
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
          const deadline = Date.now() + 300000
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
          if (run?.phase === 'FAILED' && keyReveal) break outer
          if (run?.phase === 'FAILED') { await writeFile('scratch/key-reveal-capture-failed.json', JSON.stringify(run)); throw new Error('Fixture failed') }
          if (run?.phase === 'DONE') break outer
        }
      }
      if (noShow) {
        const deadline = Date.now() + 300000
        while (run!.intents.some(i => i.status === 'SUBMITTING') || !run!.intents.some(i => i.escrow?.state === 'CANCELLED') || !run!.intents.some(i => i.status === 'VERIFIED')) {
          if (Date.now() > deadline) throw Error('Key reveal did not finish and cancel')
          await api.reconcileOnce();
          const current = api.store.getRun(created.runId)
          if (current.phase === 'FAILED' && !current.intents.some(i => i.status === 'SUBMITTING')) {
            // Labelled fixture trust state; this is not automatic no-show reputation scoring.
            const writer = current.candidates.find(c => c.profileId === 'alphaleak')!
            api.store.putReputation({ ...newRecord(writer.profileId, writer.wallet!), H:0, T:0, status:'quarantined' })
            api.store.appendEvent(created.runId, { type:'WRITER_UNAVAILABLE', label:'Fixture-injected quarantine of no-show AlphaLeak before policy replans; not automatic reputation scoring.' })
            await api.loop.start(created.runId)
          }
          await new Promise(r => setTimeout(r, 1000)); run = await get(`/runs/${created.runId}`)
        }
      }
      if (testnet) {
        const deadline = Date.now() + 45000
        do { await api.reconcileOnce(); run = await get(`/runs/${created.runId}`); if (run!.ledgerAnchor) break; await new Promise(r => setTimeout(r, 500)) } while (Date.now() < deadline)
        if (!run!.ledgerAnchor) throw Error('Capture requires validated answer anchor')
      }
      await mkdir(evidencePath, {recursive:true})
      await writeFile(`${evidencePath}/${question.id}.receipts.json`, JSON.stringify(await get(`/runs/${created.runId}/receipts.json`), null, 2)+'\n')
      const cards: Record<string, unknown> = {}
      for (const slug of new Set(run!.candidates.map(c => c.publisherSlug).filter(Boolean))) {
        const path = `/w/${slug}/.well-known/agent-publisher.json`
        cards[path] = await (await fetch(pubUrl + path)).json()
      }
      if (testnet) {
        if (question.id === 'UC3' && !(noShow ? run!.intents.some(i => i.escrow?.state === 'CANCELLED') : run!.intents.some(i => i.status === 'REFUNDED')) || !run!.intents.some(i => i.status === 'VERIFIED')) throw Error('UC3 requires validated refund and re-buy')
        const transactions: Record<string, unknown>[] = []
        const source = `${evidencePath}/transactions.json`
        const look = async (hash: string) => {
          const found = await lookupTx(ledger!, hash)
          if (found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS') throw Error('Unvalidated capture')
          return found
        }
        const common = (hash: string, found: Awaited<ReturnType<typeof look>>) => ({ hash, date: new Date().toISOString().slice(0, 10), ledgerIndex: found.ledgerIndex, feeDrops: found.tx.Fee, deliveredAmount: found.meta.delivered_amount, source })
        const labels: Record<string, string> = { EscrowCreate: 'key reveal: EscrowCreate', EscrowFinish: 'EscrowFinish (key published)', EscrowCancel: 'EscrowCancel (writer no-show)' }
        const operations: Record<string, string> = { EscrowCreate: 'create', EscrowFinish: 'finish', EscrowCancel: 'cancel' }
        for (const intent of run!.intents) {
          if (keyReveal) for (const hash of [intent.escrow?.createHash, intent.escrow?.finishHash, intent.escrow?.cancelHash].filter((h): h is string => !!h)) {
            const found = await look(hash), type = String(found.tx.TransactionType)
            transactions.push({ group: 'escrow', operation: operations[type], label: labels[type], owner: intent.escrow!.owner, createSequence: intent.escrow!.createSequence, amountDrops: String(intent.amountMinor * 1000), condition: found.tx.Condition, cancelAfter: found.tx.CancelAfter, ...common(hash, found), kind: type })
          }
          else if (intent.txHash) { const found = await look(intent.txHash); transactions.push({ group: 'Testnet UC3', ...common(intent.txHash, found), kind: 'purchase', from: found.tx.Account, to: found.tx.Destination, invoiceId: found.tx.InvoiceID }) }
          if (intent.refund?.txHash) {
            const found = await look(intent.refund.txHash)
            transactions.push({ group: 'Testnet UC3', ...(keyReveal ? { label: 'Refund Payment (writer-signed; fixture writer cooperates)' } : {}), ...common(intent.refund.txHash, found), kind: 'refund', from: found.tx.Account, to: found.tx.Destination, invoiceId: found.tx.InvoiceID })
          }
        }
        if (testnet && run!.ledgerAnchor) { const a = run!.ledgerAnchor, found = await look(a.txHash); transactions.push({ group: 'anchor', operation: 'answer-anchor', label: `Answer anchor · memo = audit head ${a.head.slice(0, 8)}…`, account: a.account, head: a.head, type: 'AccountSet', ...common(a.txHash, found), kind: 'anchor' }) }
        await mkdir(evidencePath, {recursive:true})
        if (keyReveal) for (const intent of run!.intents.filter(i => i.status === 'VERIFIED')) {
          const proof = await get(`/runs/${created.runId}/intents/${intent.intentId}/key-reveal-proof.json`)
          const finish = transactions.find(t => t.hash === proof.finishHash), create = transactions.find(t => t.hash === proof.createHash)
          if (finish && create) finish.keyReveal = { create, terms: proof.quote.terms, condition: proof.quote.terms.condition, commitment: proof.quote.terms.keyReveal, ciphertext: proof.quote.ciphertext }
          await writeFile(`${evidencePath}/proof.json`, JSON.stringify(proof, null, 2)+'\n')
        }
        await writeFile(`${evidencePath}/transactions.json`, JSON.stringify({transactions},null,2)+'\n')
        console.log(transactions.map(t => `${t.kind}: ${t.hash}`).join('\n'))
      }
      if (!process.argv.includes('--kestrel')) await writeFile(`demo/traces/${keyReveal ? (noShow ? 'UC-key-reveal' : `${question.id}-key-reveal`) : testnet ? 'UC3-testnet' : question.id}.json`, JSON.stringify({ provenance: { source: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(), capturedAt: new Date().toISOString(), transport: 'HTTP SSE snapshot + persisted event trace', ...(noShow ? { fault: 'AlphaLeak signed delivery requests return fixture 503; harness waits for policy cancellation, injects labelled fixture quarantine for the no-show writer, then resumes existing policy loop' } : {}), mode: testnet ? 'Recorded on XRPL Testnet · no real value · fixture providers · fictional writers' : 'fixture providers · fictional writers · simulated payments' }, scope, health: await get('/api/health'), reputation: await get('/api/reputation'), cards, run }) + '\n')
      console.log(`${question.id}: ${run!.events.length} events, ${run!.grants.length} grants, ${run!.refundedMinor} refunded`)
    } finally {
      abort.abort(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await api.close()
    }
  }
} finally { pub.closeAllConnections(); await new Promise<void>(r => pub.close(() => r())); publisher.locals.journal.close(); await ledger?.close() }
