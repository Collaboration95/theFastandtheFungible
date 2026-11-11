import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { Store } from '../server/store'
import { HostedLimits } from '../server/hosted/limits'
import { loadConfig } from '../server/config'
import { aggregateSandbox } from '../server/hosted/stats'
import { summarizeGates } from '../src/verify/gates'
import { verifyAnswer } from '../sdk/verify'
import type { ReceiptBundle } from '../shared/contracts/receipts'

/** Synthetic server projection of the SAME exported audit. The export omits SSE traces,
 * so project reservations as policy BUY/PURCHASE and verified, released grants as GRANT.
 * Never invent READ_PAID for the original export: its browser ordering row stays unchecked.
 * This imports P4's actual aggregator only in Node tests, never in the browser bundle.
 */
function serverAudit(bundle: ReceiptBundle) {
  const store = new Store(':memory:')
  try {
    new HostedLimits(store, loadConfig({ HOSTED: '1', HOSTED_IP_HMAC_KEY: 'p5-parity-test-only-'.repeat(4) }))
    const entries = bundle.audit.entries.filter(e => !('commitment' in e) && e.runId === bundle.runId).sort((a, b) => a.seq - b.seq)
    store.hostedState(db => {
      const admission = entries.find(e => 'kind' in e && e.kind === 'admission')
      const budget = admission && 'kind' in admission ? admission.data.admittedMinor : 200
      const spent = bundle.receipts.reduce((sum, receipt) => sum + receipt.amountMinor, 0)
      db.prepare('INSERT INTO runs VALUES (?,?)').run(bundle.runId, JSON.stringify({ phase: 'DONE', budgetMinor: budget, spentMinor: spent, ledgerAnchor: bundle.ledgerAnchor, labels: { settlement: 'XRPL TESTNET · no real value' } }))
      db.prepare(`INSERT INTO hosted_holds (id,principal,request_key,question,ip,day,created,minor,model_used,run_id,state) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run('parity', 'synthetic', 'parity', 'hash-only', 'hash-only', '2026-11-11', Date.parse('2026-11-11T01:00:00Z'), 200, 0, bundle.runId, 'done')
      bundle.intents.forEach((intent, index) => db.prepare('INSERT INTO intents VALUES (?,?,?)').run(
        bundle.intents.findIndex(i => i.intentId === intent.intentId) === index ? intent.intentId : `duplicate-${index}`, bundle.runId, JSON.stringify(intent)))
      // Keep the SQL foreign key valid while retaining any corrupt identity in the raw JSON,
      // exactly the distinction P4 audits instead of hydrating Store.getRun().
      bundle.receipts.forEach((receipt, index) => db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(bundle.intents[index].intentId, JSON.stringify(receipt), 'synthetic'))
      const event = (type: string, at: string, data: Record<string, unknown> = {}) => db.prepare('INSERT INTO events (run_id,json) VALUES (?,?)').run(bundle.runId, JSON.stringify({ type, at, data }))
      for (const entry of entries) {
        if (!('kind' in entry)) continue
        const { kind, at, data, intentId } = entry
        if (kind === 'admission') event('SEARCH', at)
        if (kind === 'decision') {
          const candidate = bundle.candidates.find(c => c.resourceId === data.selectedResourceId)
          db.prepare('INSERT INTO decisions VALUES (?,?,?)').run(bundle.runId, Number(data.round), JSON.stringify({ round: data.round, selectedResourceId: data.selectedResourceId, selectedSourceKey: data.selectedSourceKey, rows: candidate ? [{ verdict: 'BUY', candidate }] : [] }))
          event('DECIDE', at, { round: data.round })
        }
        if (kind === 'reserve') { event('BUY', at, { intentId }); event('PURCHASE', at, { intentId }) }
        const intent = bundle.intents.find(i => i.intentId === intentId)
        const granted = bundle.grants.some(g => g.intentId === intentId)
        if (granted && (kind === 'ESCROW_FINISH' && data.proofOk === true || kind === 'proof' && data.verified === true && !intent?.escrow)) event('GRANT', at, { intentId })
        if (kind === 'READ_PAID') event('READ_PAID', at, { intentId })
        if (kind === 'answer-anchor') event('DONE', at)
      }
    })
    return aggregateSandbox(store)
  } finally { store.close() }
}

for (const [name, path] of Object.entries({ hosted: 'public/judge/hosted-run-nov11.receipts.json', UC3: 'docs/evidence/round4-j1/replays/key-reveal/UC3.receipts.json' })) {
  for (const tamper of ['original', 'early-read', 'duplicate-intent', 'overspend', 'missing-policy', 'orphan-receipt'] as const) it(`agrees with P4 on ${name}: ${tamper}`, async () => {
    const bundle: ReceiptBundle = JSON.parse(readFileSync(path, 'utf8'))
    if (tamper === 'early-read') {
      const proof = bundle.audit.entries.find(e => 'kind' in e && e.kind === 'proof' && e.data.verified === true)!
      if (!('kind' in proof)) throw Error('fixture proof missing')
      bundle.audit.entries.forEach(e => { e.seq *= 2 })
      bundle.audit.entries.push({ ...structuredClone(proof), seq: proof.seq - 1, kind: 'READ_PAID', data: {} })
    }
    if (tamper === 'duplicate-intent') bundle.intents.push(structuredClone(bundle.intents[0]))
    if (tamper === 'overspend') bundle.intents[0].amountMinor = 201
    if (tamper === 'missing-policy') bundle.audit.entries = bundle.audit.entries.filter(e => !('kind' in e) || e.kind !== 'decision')
    if (tamper === 'orphan-receipt') bundle.receipts[0].intentId = 'missing'
    const rows = summarizeGates(bundle, (await verifyAnswer(bundle)).checks)
    const stats = serverAudit(bundle)
    expect([rows[0].status === 'Broken', rows[1].status === 'Broken', rows[2].status === 'Broken']).toEqual([
      stats.audit.readBeforeGrant > 0, stats.audit.buyWithoutPolicy > 0 || stats.audit.overBudget > 0, stats.audit.duplicateIntent > 0 || stats.audit.receiptWithoutIntent > 0,
    ])
    expect(stats.anchored).toBe(1) // P4's fifth predicate remains separate from hard gate 5 (labels).
    if (tamper === 'original') expect(rows.map(r => r.status)).toEqual(['Not checked', 'Held', 'Held', 'Held', 'Held'])
  })
}
