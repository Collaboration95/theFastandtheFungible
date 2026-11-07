import { ResourceScope } from '../shared/resource-scope.js'
import { parseCommand, resolveStartup } from '../shared/startup-plan.js'
import { writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
import { prepareMcpTestnet } from './testnet.js'
import { startEngine } from '../server/engine.js'
import { createClient } from '../sdk/index.js'

export async function runTry(argv: string[]) {
  if (argv.length !== 1 || argv[0] !== '--testnet') throw Error('Usage: researchagent-mcp try --testnet')
  const started = performance.now()
  process.chdir(fileURLToPath(new URL('..', import.meta.url)))
  const scope = new ResourceScope()
  const scratch = scope.tempDir('ra-try-')
  const plan = resolveStartup(process.env, parseCommand(['try', ...argv]))
  let engine: Awaited<ReturnType<typeof startEngine>> | undefined
  try {
    const setup = await prepareMcpTestnet()
    console.log(setup.labels.join(' · '))
    engine = await startEngine({ dataDir: plan.stateDir, live: false, env: { ...setup.env, DOTENV_CONFIG_PATH: '.try-no-env', MCP_MAX_BUDGET_MINOR: String(plan.caps.maxMinor), MCP_DAILY_CAP_MINOR: String(plan.caps.dailyMinor), WALLET_DAILY_CAP_MINOR: String(plan.caps.walletDailyMinor) } })
    const client = createClient({ baseUrl: engine.apiUrl, token: engine.apiToken })
    const answer = await client.ask(DEMO_QUESTIONS.find(q => q.id === 'UC3')!.text, { budgetSgd: 2, idempotencyKey: `researchagent-try-uc3-${setup.testnet ? 'testnet' : 'simulated'}-v1`, escrow: setup.testnet })
    if (answer.phase !== 'DONE') throw Error('UC3 did not finish')
    let bundle = await client.receipts(answer.run_id)
    if (setup.testnet) {
      const deadline = Date.now() + 30_000
      while (!bundle.ledgerAnchor && Date.now() < deadline) {
        await new Promise(done => scope.timer(setTimeout(done, 250)))
        bundle = await client.receipts(answer.run_id)
      }
      const purchases = bundle.payments.filter(p => p.kind === 'purchase')
      const refunded = purchases.find(p => p.refundTxHash)
      const kept = purchases.find(p => !p.refundTxHash)
      if (!refunded?.escrowCreateHash || !kept?.escrowCreateHash || !bundle.ledgerAnchor) throw Error('UC3 requires refund, re-buy and anchor')
      const rows = [
        ['Create', refunded.escrowCreateHash], ['Finish', refunded.txHash],
        ['Refund · writer-signed · fixture writer cooperates (a real writer could refuse)', refunded.refundTxHash],
        ['Re-buy create', kept.escrowCreateHash], ['Re-buy finish', kept.txHash], ['Anchor', bundle.ledgerAnchor.txHash],
      ]
      // Verification is performed before asserting the cryptographic success label.
      await writeFile(join(scratch, 'receipts.json'), JSON.stringify(bundle))
      const verifier = scope.spawn(process.execPath, [resolve('scripts/verify-answer.js'), join(scratch, 'receipts.json'), '--ledger'])
      let stdout = ''
      verifier.stdout.on('data', data => { stdout += data; if (stdout.length > 1024 * 1024) verifier.kill() })
      verifier.stderr.resume()
      await new Promise<void>((done, fail) => { verifier.once('error', fail); verifier.once('exit', code => code === 0 ? done() : fail(Error('Ledger verifier failed'))) })
      const verification = { stdout }
      rows.forEach(([label, hash], i) => console.log(`${i + 1}. ${label}${label.includes('Finish') || label.includes('finish') ? ' · sha256(K) = Condition ✓' : ''}: https://testnet.xrpl.org/transactions/${hash}`))
      console.log(verification.stdout.trim())
    } else {
      const { verifyAnswer, verificationText } = await import('../sdk/verify.js')
      const result = await verifyAnswer(bundle, { onlineLedger: true })
      console.log('SIMULATED · no explorer links or ledger transactions')
      console.log(verificationText(result))
      if (!result.ok) throw Error('Simulated receipt verification failed')
    }
    console.log(`Finished in ${((performance.now() - started) / 1000).toFixed(1)} s · budget S$2.00 · spent S$${(answer.spentMinor / 100).toFixed(2)}`)
    console.log('RESULT PASS')
  } finally {
    try { await engine?.close() } finally { await scope.close() }
  }
}
