import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { summarizeGates } from '../src/verify/gates'
import { verifyAnswer } from '../sdk/verify'
import type { ReceiptBundle } from '../shared/contracts/receipts'

const fixtures = {
  hosted: 'public/judge/hosted-run-nov11.receipts.json',
  UC3: 'docs/evidence/round4-j1/replays/key-reveal/UC3.receipts.json',
}
const load = (path: string): ReceiptBundle => JSON.parse(readFileSync(path, 'utf8'))
const statuses = (bundle: ReceiptBundle, checks: Awaited<ReturnType<typeof verifyAnswer>>['checks']) => summarizeGates(bundle, checks).map(r => r.status)

describe.each(Object.entries(fixtures))('%s receipt bundle', (_name, path) => {
  it('pins the P4 policy/order/budget/uniqueness predicates and reuses published citation checks', async () => {
    const bundle = load(path), before = JSON.stringify(bundle)
    const verified = await verifyAnswer(bundle)
    expect(verified.ok).toBe(true)
    expect(statuses(bundle, verified.checks)).toEqual(['Not checked', 'Held', 'Held', 'Held', 'Held'])
    // P4 is not yet merged: pin its decision-before-reserve, gross-budget and unique-intent
    // expectations against the committed export. Missing read telemetry is never a pass.
    expect(summarizeGates(bundle, verified.checks).every(row => row.seqs.length > 0)).toBe(true)
    expect(JSON.stringify(bundle)).toBe(before)
    const labels = summarizeGates(bundle, verified.checks)[4].labels!
    expect(labels.at(-1)?.value).toBe(bundle.label)
    const admission = bundle.audit.entries.find(e => !('commitment' in e) && e.kind === 'admission')!
    if ('kind' in admission) for (const [name, value] of Object.entries(admission.data.labels as object)) expect(labels).toContainEqual({ name, value })
  })

  it('flips only the paid-read row when a read moves before its grant', async () => {
    const bundle = load(path), checks = (await verifyAnswer(bundle)).checks
    const proof = bundle.audit.entries.find(e => !('commitment' in e) && e.kind === 'proof' && e.data.verified === true)!
    if (!('kind' in proof)) throw Error('fixture proof missing')
    const finish = bundle.audit.entries.find(e => !('commitment' in e) && e.kind === 'ESCROW_FINISH' && e.intentId === proof.intentId)!
    const read = { ...structuredClone(proof), seq: finish.seq + 0.5, kind: 'READ_PAID', data: {} }
    // Synthetic ordering telemetry; sequence numbers remain positive integers.
    for (const entry of bundle.audit.entries) entry.seq *= 2
    read.seq *= 2
    bundle.audit.entries.push(read)
    expect(statuses(bundle, checks)).toEqual(['Held', 'Held', 'Held', 'Held', 'Held'])
    read.seq = proof.seq - 1
    expect(statuses(bundle, checks)).toEqual(['Broken', 'Held', 'Held', 'Held', 'Held'])
    expect(summarizeGates(bundle, checks)[0].seqs).toContain(read.seq)
  })

  it('flips only the intent row for a duplicated intent', async () => {
    const bundle = load(path), checks = (await verifyAnswer(bundle)).checks
    bundle.intents.push(structuredClone(bundle.intents[0]))
    expect(statuses(bundle, checks)).toEqual(['Not checked', 'Held', 'Broken', 'Held', 'Held'])
  })

  it('flips only the policy/budget row for spend over the admitted budget', async () => {
    const bundle = load(path), checks = (await verifyAnswer(bundle)).checks
    for (const e of bundle.audit.entries) if (!('commitment' in e)) {
      if (e.kind === 'admission') e.data.admittedMinor = 1
      if (e.kind === 'reserve') e.data.runBudgetMinor = 1
    }
    expect(statuses(bundle, checks)).toEqual(['Not checked', 'Broken', 'Held', 'Held', 'Held'])
    const intentSpend = load(path)
    intentSpend.intents[0].amountMinor = 201
    expect(statuses(intentSpend, checks)).toEqual(['Not checked', 'Broken', 'Held', 'Held', 'Held'])
  })
})

it('counts distinct charges on one intent toward gross spend', async () => {
  const bundle = load(fixtures.hosted), checks = (await verifyAnswer(bundle)).checks
  const payment = structuredClone(bundle.payments[0])
  payment.txHash = 'A'.repeat(64)
  payment.amountMinor = 201
  bundle.payments.push(payment)
  expect(statuses(bundle, checks)).toEqual(['Not checked', 'Broken', 'Broken', 'Held', 'Held'])
})

it('does not treat absent, redacted, malformed or another run’s evidence as held', () => {
  expect(summarizeGates({}).map(r => r.status)).toEqual(Array(5).fill('Not checked'))
  const bundle = load(fixtures.hosted)
  bundle.audit.entries = bundle.audit.entries.map(e => ({ seq: e.seq, hash: e.hash, prevHash: e.prevHash, commitment: true }))
  expect(summarizeGates(bundle).map(r => r.status)).toEqual(Array(5).fill('Not checked'))
  expect(summarizeGates({ ...bundle, runId: 'another-run' }).every(r => r.status === 'Not checked')).toBe(true)
  const partial = load(fixtures.hosted)
  for (const entry of partial.audit.entries) if (!('commitment' in entry) && entry.kind === 'reserve') delete entry.data.committedMinor
  expect(summarizeGates(partial)[1].status).toBe('Not checked')
})

it('detects missing policy, duplicate/orphan receipts and label mismatch independently', async () => {
  const base = load(fixtures.hosted), checks = (await verifyAnswer(base)).checks
  const policy = structuredClone(base)
  policy.audit.entries = policy.audit.entries.filter(e => 'commitment' in e || e.kind !== 'decision')
  expect(statuses(policy, checks)).toEqual(['Not checked', 'Broken', 'Held', 'Held', 'Held'])
  const orphan = structuredClone(base)
  orphan.receipts[0].intentId = 'missing'
  expect(summarizeGates(orphan, checks)[2].status).toBe('Broken')
  const duplicate = structuredClone(base)
  duplicate.receipts.push(structuredClone(duplicate.receipts[0]))
  expect(statuses(duplicate, checks)).toEqual(['Not checked', 'Held', 'Broken', 'Held', 'Held'])
  const labels = structuredClone(base)
  labels.receipts[0].label = 'SIMULATED SGD · no real funds'
  expect(statuses(labels, checks)).toEqual(['Not checked', 'Held', 'Held', 'Held', 'Broken'])
  expect(summarizeGates(base)[3].status).toBe('Not checked')
  expect(summarizeGates(base, [{ check: 'citation answer v1', status: 'FAIL', detail: 'missing passage' }])[3].status).toBe('Broken')
})

it('counts refunded UC3 spend as gross spend, not as a fresh budget', async () => {
  const bundle = load(fixtures.UC3), checks = (await verifyAnswer(bundle)).checks
  expect(bundle.intents.some(i => i.refund)).toBe(true)
  for (const e of bundle.audit.entries) if (!('commitment' in e)) {
    if (e.kind === 'admission') e.data.admittedMinor = 50
    if (e.kind === 'reserve') e.data.runBudgetMinor = 50
  }
  expect(summarizeGates(bundle, checks)[1].status).toBe('Broken')
})
