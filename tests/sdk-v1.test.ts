import { expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import express from 'express'
import { Wallet, decode, hashes } from 'xrpl'
import { startEngine } from '../server/engine.js'
import { createClient } from '../sdk/index.js'
import { openPaymentJournal } from '../sdk/x402-journal.js'
import { decodeHeader, encodeHeader } from '../shared/x402.js'
import { hireLedger } from './fixtures/hire-ledger.js'
import { USE_CASES } from './scenarios/use-cases.js'
const exec = promisify(execFile)

it('streams checked answers, clamps budgets, charges once, verifies exports and runs all examples on ephemeral fixtures', async () => {
  vi.stubEnv('MCP_MAX_BUDGET_MINOR', '200'); vi.stubEnv('MCP_DAILY_CAP_MINOR', '1000')
  const dir = mkdtempSync(join(tmpdir(), 'sdk-v1-'))
  const engine = await startEngine({ dataDir: dir })
  const client = createClient({ baseUrl: engine.apiUrl, token: engine.apiToken })
  const chain = hireLedger(), payee = Wallet.generate().classicAddress
  const app = express()
  const terms = { scheme: 'exact' as const, network: 'xrpl:1' as const, asset: 'XRP' as const, payTo: payee, amount: '1000', maxTimeoutSeconds: 60, extra: { invoiceId: 'sdk-fixture', areFeesSponsored: false as const } }
  app.get('/resource', async (req, res) => {
    if (!req.headers['payment-signature']) {
      res.set('PAYMENT-REQUIRED', encodeHeader('PAYMENT-REQUIRED', { x402Version: 2, resource: { url: '/resource', mimeType: 'application/json' }, accepts: [terms] })).status(402).end(); return
    }
    const signature = decodeHeader('PAYMENT-SIGNATURE', String(req.headers['payment-signature']))
    await chain.ledger.request({ command: 'submit', tx_blob: signature.payload.signedTxBlob })
    const tx = decode(signature.payload.signedTxBlob)
    res.set('PAYMENT-RESPONSE', encodeHeader('PAYMENT-RESPONSE', { success: true, transaction: hashes.hashSignedTx(signature.payload.signedTxBlob), payer: String(tx.Account), network: 'xrpl:1' })).json({ label: 'SYNTHETIC fixture; no Testnet submission' })
  })
  app.get('/fixture/tx/:hash', async (req, res) => res.json(await chain.ledger.request({ command: 'tx', transaction: req.params.hash })))
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r))
  const paymentUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const journalPath = join(dir, 'payments.db')
  let journal = openPaymentJournal(journalPath)
  try {
    const task = client.ask(USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?'), { budget: 99, idempotencyKey: 'sdk-v1' })
    const events = []
    for await (const event of task.events) events.push(event)
    const run = await task
    expect(events.some(e => e.type === 'FREE_DRAFT')).toBe(true)
    expect(events.some(e => e.type === 'ANSWER_READY')).toBe(true)
    expect(run.clamped).toBe(true)
    expect(run.purchases.filter(p => p.verified)).toHaveLength(1)
    const again = await client.ask(USE_CASES.UC2.question.replace(/\?$/, ' (pricing & margins)?'), { budget: 99, idempotencyKey: 'sdk-v1' })
    expect(again.run_id).toBe(run.run_id)
    expect(again.receipts).toEqual(run.receipts)
    const bundle = await client.receipts(run.run_id)
    expect((await client.verify(bundle)).ok).toBe(true)
    bundle.sources[0].spans[0].text += 'TAMPER'
    expect((await client.verify(bundle)).ok).toBe(false)
    const file = join(dir, 'receipts.json')
    writeFileSync(file, JSON.stringify(await client.receipts(run.run_id)))
    const env = { ...process.env, RA_URL: engine.apiUrl, RA_API_TOKEN: engine.apiToken }
    for (const [script, args] of [['ask', []], ['verify', [file]]] as const) {
      const { stdout } = await exec(process.execPath, ['--import', 'tsx', `examples/${script}.ts`, ...args], { env })
      expect(stdout).toContain(script === 'ask' ? 'SIMULATED' : '"ok":true')
    }
    const { stdout } = await exec(process.execPath, ['--import', 'tsx', 'examples/pay.ts', `${paymentUrl}/resource`], {
      env: { ...env, RA_URL: paymentUrl, RA_SDK_FIXTURE: '1', RA_JOURNAL: join(dir, 'example-pay.db') },
    })
    expect(stdout).toContain('"fixture":true')
    const wallet = Wallet.generate()
    const payment = { wallet, maxDrops: '1000', journal, ledger: chain.ledger }
    await (await createClient({ baseUrl: paymentUrl, payment }).pay(`${paymentUrl}/resource`, { idempotencyKey: 'durable' })).response.body?.cancel()
    const count = chain.txs.size
    journal.close(); journal = openPaymentJournal(journalPath)
    await (await createClient({ baseUrl: paymentUrl, payment: { ...payment, journal } }).pay(`${paymentUrl}/resource`, { idempotencyKey: 'durable' })).response.body?.cancel()
    expect(chain.txs.size).toBe(count)
  } finally {
    journal.close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r()))
    await engine.close(); rmSync(dir, { recursive: true, force: true }); vi.unstubAllEnvs()
  }
}, 30_000)

it('keeps every documented method on the public client', () => {
  const doc = readFileSync('docs/sdk.md', 'utf8')
  const names = [...doc.matchAll(/^### `([A-Za-z]+)`/gm)].map(m => m[1])
  expect(names.length).toBeGreaterThanOrEqual(6)
  const client = createClient({ baseUrl: 'http://localhost' })
  for (const name of names) expect(typeof client[name as keyof typeof client]).toBe('function')
})

it('types public API and failures', async () => {
  const client = createClient({ baseUrl: 'http://localhost' })
  // Compiled by check:fast's tsc; these assertions catch public contract drift.
  const typed = async () => {
    const task: import('../sdk/index.js').AskTask = client.ask('question', { budget: 1, idempotencyKey: 'key' })
    const events: AsyncIterable<import('../shared/contracts/run.js').TraceEvent> = task.events
    const result: import('../sdk/index.js').AskResult = await task
    const verified: import('../sdk/verify.js').VerificationResult = await client.verify({})
    return { events, result, verified }
  }
  expect(typeof typed).toBe('function')
  await expect(client.pay('http://localhost')).rejects.toMatchObject({ code: 'invalid' })
  await expect(client.verify('/definitely/missing.json')).rejects.toMatchObject({ code: 'verification_failed' })
  const abort = new AbortController(); abort.abort()
  await expect(client.ask('q', { budget: 1, signal: abort.signal })).rejects.toMatchObject({ code: 'cancelled' })
  await expect(client.ask('q', { budget: NaN })).rejects.toMatchObject({ code: 'invalid' })
})
