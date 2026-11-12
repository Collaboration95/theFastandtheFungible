import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { JUDGE_RUN } from '../src/hosted'
import { verifyAnswer } from '../sdk/verify'
import { summarizeGates } from '../src/verify/gates'
import type { ReceiptBundle } from '../shared/contracts/receipts'
import { DEFAULTS, KEY_TX, RECEIPTS_SHA256 } from '../scripts/stage-check.mjs'

it('the corner, stage kit and future video captures select the same exact export', async () => {
  const { RECEIPTS }: { RECEIPTS: string } = await import(new URL('../scripts/video/config.mjs', import.meta.url).href)
  const file = resolve(`public${JUDGE_RUN.bundleUrl}`)
  const bytes = readFileSync(file)
  expect(DEFAULTS.receipts).toBe(file)
  expect(RECEIPTS).toBe(file)
  expect(readFileSync(DEFAULTS.evidence).equals(bytes)).toBe(true)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(RECEIPTS_SHA256)
  expect(KEY_TX).toBe(JUDGE_RUN.proofTx)
  const bundle: ReceiptBundle = JSON.parse(bytes.toString())
  const payment = bundle.payments.find(row => row.txHash === KEY_TX)!
  expect(payment).toMatchObject({ writer: 'ledger-analytics', status: 'VERIFIED', amountDrops: '40000' })
  const intent = bundle.intents.find(row => row.intentId === payment.intentId)!
  expect(intent.quote?.payment).toMatchObject({ payTo: payment.payee, amountDrops: payment.amountDrops, invoiceId: payment.invoiceId })
  expect(bundle.receipts.find(row => row.intentId === payment.intentId)?.xrpl).toMatchObject({ txHash: KEY_TX, payTo: payment.payee, amountDrops: payment.amountDrops })
  expect(createHash('sha256').update(readFileSync('public/judge/hosted-run-nov12.receipts.json')).digest('hex')).toBe('8cedc67bdbdc51e2e13ad1bb68ed6a5b78e76d75afa7b47e37e7a97cec71f2ae')
  expect(createHash('sha256').update(readFileSync('public/judge/hosted-run-nov11.receipts.json')).digest('hex')).toBe('1f2fe4de4de58fedb68c8e04c9f2106fa0b66004c1839ae93f29bb0662ee13ee')
})

it('the featured hosted export proves all five browser gates, including grant before every paid read', async () => {
  const bundle: ReceiptBundle = JSON.parse(readFileSync(`public${JUDGE_RUN.bundleUrl}`, 'utf8'))
  const verified = await verifyAnswer(bundle)
  expect(verified.ok).toBe(true)
  expect(summarizeGates(bundle, verified.checks).map(row => row.status)).toEqual(Array(5).fill('Held'))
  const entries = bundle.audit.entries.filter(e => 'kind' in e && e.runId === bundle.runId)
  const reads = entries.filter(e => 'kind' in e && e.kind === 'read_paid')
  expect(reads.length).toBeGreaterThan(0)
  for (const read of reads) {
    if (!('kind' in read)) throw Error('Expected paid-read event')
    expect(entries.some(grant => 'kind' in grant && grant.kind === 'grant' && grant.intentId === read.intentId && grant.seq < read.seq)).toBe(true)
  }
})
