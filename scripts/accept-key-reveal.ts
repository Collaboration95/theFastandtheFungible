// Public Testnet only. Three cold make testnet boots; persist hashes and timings only.
import { testnetLedger, TESTNET_WSS, lookupTx } from '../shared/xrpl.js'
import { spawn } from 'node:child_process'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { allocateDemoPorts } from './demo-ports.mjs'
import { DEMO_QUESTIONS } from '../shared/contracts/examples.js'
import type { RunSnapshot } from '../shared/contracts/index.js'
await mkdir('docs/evidence/lane-x', { recursive: true })
const results = []
for (let n = 1; n <= 3; n++) {
  const dir = `scratch/lane-x/accept-${Date.now()}-${n}`
  const ports = await allocateDemoPorts(), started = Date.now()
  const child = spawn('make', ['testnet'], { detached: true, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, TESTNET_WALLET_FILE: `${dir}/wallets.private.json`, DEMO_WEB_PORT: String(ports.web), DEMO_API_PORT: String(ports.api), DEMO_PUBLISHER_PORT: String(ports.pub) }, stdio: 'ignore' })
  const url = `http://127.0.0.1:${ports.web}`
  const get = async (path: string, body?: unknown) => {
    const r = await fetch(url + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
    if (!r.ok) throw Error(`HTTP ${r.status}`)
    return r.json()
  }
  try {
    const deadline = Date.now() + 300000
    for (;;) {
      try { await get('/api/health'); break } catch { if (Date.now() > deadline) throw Error('Cold boot timeout'); await new Promise(r => setTimeout(r, 500)) }
    }
    const question = DEMO_QUESTIONS.find(q => q.id === 'UC3')!.text
    const scope = await get('/api/scope', { question })
    const created = await get('/runs', { question, budgetMinor: 200, plan: scope.plan })
    let run: RunSnapshot, firstHashSeconds: number | undefined
    for (;;) {
      run = await get(`/runs/${created.runId}`)
      if (!run.labels.settlement.startsWith('XRPL')) throw Error('SIMULATED fallback cannot satisfy acceptance')
      if (firstHashSeconds === undefined && run.events.some(e => e.type === 'ESCROW_CREATE')) firstHashSeconds = (Date.now() - started) / 1000
      if (run.phase === 'DONE') break
      if (run.phase === 'FAILED' && !run.intents.some(i=>i.status==='SUBMITTING') || Date.now() > deadline) { console.log(JSON.stringify({phase:run.phase,intents:run.intents.map(i=>({status:i.status,escrow:i.escrow?.state,create:i.escrow?.createHash,finish:i.escrow?.finishHash}))})); throw Error('UC3 failed or timed out') }
      await new Promise(r => setTimeout(r, 250))
    }
    const refunded = run.intents.find(i => i.status === 'REFUNDED'), bought = run.intents.find(i => i.status === 'VERIFIED')
    if (!refunded?.escrow?.finishHash || !refunded.refund?.txHash || !bought?.escrow?.finishHash) throw Error('UC3 requires escrow refund and escrow re-buy')
    const ledger = testnetLedger(TESTNET_WSS)
    try { for (const hash of [refunded.escrow.createHash, refunded.escrow.finishHash, refunded.refund.txHash, bought.escrow.createHash, bought.escrow.finishHash]) { const found = await lookupTx(ledger, hash!); if (found.state !== 'validated' || found.meta.TransactionResult !== 'tesSUCCESS') throw Error('Unvalidated acceptance hash') } } finally { await ledger.close() }
    results.push({ coldRun: n, firstHashSeconds, create: refunded.escrow.createHash, finish: refunded.escrow.finishHash, refund: refunded.refund.txHash, rebuyCreate: bought.escrow.createHash, rebuyFinish: bought.escrow.finishHash })
    await writeFile('docs/evidence/lane-x/cold-runs.json', JSON.stringify({ label: 'XRPL Testnet; public faucet; fixture providers; synthetic corpus; no real value', results }, null, 2) + '\n')
    console.log(JSON.stringify(results.at(-1)))
  } finally {
    if (child.pid) { try { process.kill(-child.pid, 'SIGTERM') } catch { /* already exited */ } }
    await new Promise(r => setTimeout(r, 2000))
    if (child.pid) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* already exited */ } }
    await rm(dir, { recursive: true, force: true })
  }
}
