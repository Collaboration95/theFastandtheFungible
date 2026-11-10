import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Wallet } from 'xrpl'
import { ResourceScope } from '../shared/resource-scope.js'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
import { parseCommand, resolveStartup } from '../shared/startup-plan.js'
import { ledgerInvoiceId } from '../shared/x402.js'
import { testnetLedger, verifyPayment, lookupTx, type Ledger } from '../shared/xrpl.js'
import { DEFAULT_WRITERS, TestnetProvisioner } from '../publisher/publishing/testnet-funding.js'
import { startEngine } from '../server/engine.js'
import { createClient } from '../sdk/index.js'
import { createHireClient, type HireResult } from '../sdk/hire.js'
import { openPaymentJournal } from '../sdk/x402-journal.js'
import { verifyAnswer } from '../sdk/verify.js'
import { prepareMcpTestnet, testnetStateDir } from './testnet.js'

/** Read-only checks cover every link, including sender, amount and intent binding. */
export async function verifyHireChain(result: HireResult, ledger: Ledger) {
  const c = result.moneyChain
  const rows = [
    { ...c.inbound, from: c.inbound.payer, invoiceId: undefined },
    ...c.payments.map(p => ({ ...p, from: c.inbound.payTo, invoiceId: ledgerInvoiceId(p.id) })),
  ]
  for (const row of rows) {
    const found = await lookupTx(ledger, row.txHash)
    if (found.state !== 'validated' || found.tx.Account !== row.from) throw Error('Hire sender is not ledger-proven')
    const proof = await verifyPayment(ledger, row.txHash, { rail: 'xrpl-testnet', network: 'xrpl:1', asset: 'XRP', payTo: row.payTo, amountDrops: row.amountDrops, invoiceId: row.invoiceId ?? String(found.tx.InvoiceID) })
    if (proof.state !== 'ok') throw Error('Hire transfer is not ledger-proven')
    if (row.invoiceId && !JSON.stringify(found.tx.Memos).includes(Buffer.from(JSON.stringify({ runId: result.run_id, kind: 'kind' in row ? row.kind : '', intentId: 'id' in row ? row.id : '' })).toString('hex').toUpperCase())) throw Error('Hire payout memo differs')
  }
  const sum = c.payments.reduce((total, p) => total + BigInt(p.amountDrops), 0n)
  if (BigInt(c.inbound.amountDrops) !== BigInt(c.purchaseDrops) + sum + BigInt(c.retainedDrops)) throw Error('Hire money chain does not balance')
}

export async function runTryHire() {
  const started = performance.now()
  process.chdir(fileURLToPath(new URL('..', import.meta.url)))
  const scope = new ResourceScope()
  const plan = resolveStartup(process.env, parseCommand(['try', '--testnet', '--hire']))
  const root = testnetStateDir()
  // Same faucet batch and private wallet store as try; free writers need funded accounts for royalties.
  const setup = await prepareMcpTestnet(async (file, faucet, ledger, allowedRoot) => new TestnetProvisioner({ ledger: ledger ?? testnetLedger(), faucet: faucet!, walletStore: { file: file!, allowedRoot: allowedRoot! } }).prepare({ writers: [...DEFAULT_WRITERS, 'client-agent'], fundFreeWriters: true }), 'XRP')
  console.log(setup.labels.join(' · '))
  if (!setup.testnet) {
    console.log('Client agent → ResearchAgent → writer · hire preview unavailable on the SIMULATED rail; verifying a simulated research answer instead')
    // Reuse the ordinary labelled fallback without attempting a second faucet call.
    return runHireFallback(setup, plan, scope, started)
  }
  let engine: Awaited<ReturnType<typeof startEngine>> | undefined
  const ledger = testnetLedger()
  const journal = openPaymentJournal(join(root, 'hire-caller.db'))
  try {
    const seeds = JSON.parse(await readFile(join(root, 'wallets.private.json'), 'utf8')) as Record<string, string>
    const caller = Wallet.fromSeed(seeds['client-agent'])
    engine = await startEngine({ dataDir: plan.stateDir, live: false, env: { ...setup.env, ESCROW_ASSET: 'XRP', MCP_MAX_BUDGET_MINOR: String(plan.caps.maxMinor), MCP_DAILY_CAP_MINOR: String(plan.caps.dailyMinor), WALLET_DAILY_CAP_MINOR: String(plan.caps.walletDailyMinor) } })
    const client = createClient({ baseUrl: engine.apiUrl, token: engine.apiToken })
    // Each invocation is an explicitly new question; retries inside x402 keep the saved blob.
    const hire = createHireClient({ baseUrl: engine.apiUrl, token: engine.apiToken, wallet: caller, ledger, journal, maxDrops: '220000' })
    const question = DEMO_QUESTIONS.find(q => q.id === 'UC2')!.text.replace(/\?$/, ' (pricing & margins)?')
    const intent = { budgetMinor: 200 as const, idempotencyKey: `try-hire-${randomUUID()}` }
    const retryDeadline = Date.now() + 180_000
    let result: HireResult
    for (;;) {
      try { result = await hire.hire(question, intent); break }
      catch (error) {
        if (!(error instanceof Error) || error.message !== 'Hire delivery unavailable; retry the same idempotency key' || Date.now() >= retryDeadline) throw error
        // Anchoring and royalties share the payer sequence. Retry delivery of the
        // same persisted inbound blob; this never creates another invoice/payment.
        await new Promise(done => scope.timer(setTimeout(done, 1000)))
      }
    }
    if (result.phase !== 'DONE') throw Error('Hired answer did not finish')
    let bundle = await client.receipts(result.run_id)
    const deadline = Date.now() + 60_000
    while (!bundle.ledgerAnchor && Date.now() < deadline) {
      await new Promise(done => scope.timer(setTimeout(done, 250)))
      bundle = await client.receipts(result.run_id)
    }
    const purchases = bundle.payments.filter(p => p.kind === 'purchase')
    if (!purchases.length || purchases.some(p => !p.escrowCreateHash) || !bundle.ledgerAnchor) throw Error('Hire requires key-reveal purchase and answer anchor')
    const rows: [string, string][] = [['Client agent → ResearchAgent · x402 hire', result.moneyChain.inbound.txHash]]
    for (const p of purchases) {
      rows.push(['ResearchAgent → writer · escrow create', p.escrowCreateHash!], ['Writer → ResearchAgent · key reveal / escrow finish', p.txHash!])
      if (p.refundTxHash) rows.push(['Writer → ResearchAgent · refund', p.refundTxHash])
    }
    for (const p of result.moneyChain.payments) rows.push([p.kind === 'royalty' ? 'ResearchAgent → writer · citation royalty' : 'ResearchAgent → client agent · change', p.txHash])
    rows.push(['ResearchAgent → ledger · answer anchor', bundle.ledgerAnchor.txHash])
    const verification = await verifyAnswer(bundle, { onlineLedger: true, ledger })
    if (!verification.ok) throw Error('Hired answer receipt verification failed')
    await verifyHireChain(result, ledger)
    rows.forEach(([label, hash], i) => console.log(`${i + 1}. ${label}: https://testnet.xrpl.org/transactions/${hash}`))
    const excerpt = result.answer?.claims[0]?.text ?? result.answer?.conclusion ?? ''
    console.log(`Answer excerpt: ${excerpt.length > 240 ? `${excerpt.slice(0, 240).trimEnd()}…` : excerpt}`)
    console.log('Verified read-only: inbound hire, escrow create, finish / key reveal, citation royalties, change and answer anchor')
    const seconds = ((performance.now() - started) / 1000).toFixed(1)
    console.log(`Finished in ${seconds} s · research cap S$2.00 + fixed S$0.20 service fee · retained ${result.moneyChain.retainedDrops} drops · network fees separate`)
    // Public evidence contains no signer material; private journals remain in the state directory.
    await writeFile(join(plan.stateDir, 'try-hire.latest.json'), JSON.stringify({ label: 'XRPL Testnet · fixture models and fictional writers · no real value', seconds: Number(seconds), result, receipts: bundle, verification, timeline: rows.map(([label, hash]) => ({ label, hash, explorerUrl: `https://testnet.xrpl.org/transactions/${hash}` })) }, null, 2))
    console.log('RESULT PASS')
  } finally {
    try { await engine?.close() } finally { journal.close(); await ledger.close(); await scope.close() }
  }
}

async function runHireFallback(setup: Awaited<ReturnType<typeof prepareMcpTestnet>>, plan: ReturnType<typeof resolveStartup>, scope: ResourceScope, started: number) {
  let engine: Awaited<ReturnType<typeof startEngine>> | undefined
  try {
    engine = await startEngine({ dataDir: join(plan.stateDir, 'hire-simulated'), live: false, env: { DOTENV_CONFIG_PATH: '.try-no-env', MCP_MAX_BUDGET_MINOR: String(plan.caps.maxMinor), MCP_DAILY_CAP_MINOR: String(plan.caps.dailyMinor), WALLET_DAILY_CAP_MINOR: String(plan.caps.walletDailyMinor) } })
    const client = createClient({ baseUrl: engine.apiUrl, token: engine.apiToken })
    const answer = await client.ask(DEMO_QUESTIONS.find(q => q.id === 'UC2')!.text, { budgetSgd: 2, idempotencyKey: 'try-hire-simulated-v1' })
    const proof = await verifyAnswer(await client.receipts(answer.run_id))
    if (answer.phase !== 'DONE' || !proof.ok) throw Error('Simulated research verification failed')
    console.log(`${setup.labels[0]} · no inbound hire, royalties, change or explorer links`)
    console.log(`Finished in ${((performance.now() - started) / 1000).toFixed(1)} s · SIMULATED research receipts verified; hire chain not exercised`)
    console.log('RESULT PASS')
  } finally { try { await engine?.close() } finally { await scope.close() } }
}
