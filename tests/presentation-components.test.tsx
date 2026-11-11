// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ENV } from '../shared/presentation'
import { ucRuns } from '../src/fixtures/run'
import EnvIndicator from '../src/components/EnvIndicator'
import HostedEnv from '../src/components/hosted/HostedEnv'
import ReceiptSheet from '../src/components/ReceiptSheet'
import BudgetPicker from '../src/components/BudgetPicker'
import type { Hosted } from '../src/hosted'
import { readFileSync } from 'node:fs'
import type { RunSnapshot } from '../shared/contracts'
import recording from '../demo/traces/UC3-key-reveal.json'

it('renders canonical labels for local simulated/Testnet, hosted, and receipt surfaces', () => {
  for (const [settlement, full, short] of [['SIMULATED SGD · no real funds', ENV.simulated, ENV.simulatedShort], ['XRPL TESTNET · no real value', ENV.localTestnet('fixture models'), ENV.testnetShort]]) {
    const labels = { ...ucRuns.UC2.labels, settlement } as RunSnapshot['labels']
    const html = renderToStaticMarkup(<EnvIndicator labels={labels} />)
    expect(html).toContain(full); expect(html).toContain(short)
  }
  const status = { state: 'ready', remaining: { questions: 5, minor: 1000 }, labels: { rail: 'XRPL Testnet', models: 'live research · fixture purchase decisions' } } as Hosted['status']
  expect(renderToStaticMarkup(<HostedEnv hosted={{ status }} />)).toContain(ENV.hosted)
  const run = recording.run as unknown as RunSnapshot
  const receipt = run.receipts[0]
  const html = renderToStaticMarkup(<ReceiptSheet run={run} receipt={receipt} onClose={() => {}} />)
  expect(html).toContain(ENV.testnet)
  const simulated = renderToStaticMarkup(<ReceiptSheet run={ucRuns.UC2} receipt={ucRuns.UC2.receipts[0]} onClose={() => {}} />)
  expect(simulated).toContain(ENV.simulatedReceipt); expect(simulated).not.toContain('On the ledger')
})
it('bridges the committed hosted receipt to the explorer XRP amount', () => {
  const exported = JSON.parse(readFileSync('docs/evidence/hosted-export-nov11/receipts.json', 'utf8'))
  const payment = exported.receipts.find((r: { xrpl?: { amountDrops: string } }) => r.xrpl?.amountDrops === '40000')
  expect(payment).toBeDefined()
  const html = renderToStaticMarkup(<ReceiptSheet run={recording.run as unknown as RunSnapshot} receipt={{ ...payment, settledAt: '2026-11-11T07:06:05Z' }} onClose={() => {}} />)
  expect(html).toContain('S$0.40'); expect(html).toContain('0.04 XRP (40,000 drops)')
  expect(html).toContain('11 Nov 2026, 15:06 SGT')
  const exact = renderToStaticMarkup(<ReceiptSheet run={recording.run as unknown as RunSnapshot} receipt={{ ...payment, xrpl: { ...payment.xrpl, amountDrops: '9007199254740993' } }} onClose={() => {}} />)
  expect(exact).toContain('9,007,199,254.740993 XRP (9,007,199,254,740,993 drops)')
})
it('renders every quick budget with two decimals', () => {
  for (const [max, amounts] of [[200, ['Free','S$0.50','S$1.00','S$2.00']], [500, ['Free','S$1.00','S$2.00','S$3.00','S$5.00']]] as const) {
    const html = renderToStaticMarkup(<BudgetPicker value={200} max={max} onChange={() => {}} />)
    for (const amount of amounts) expect(html).toContain(`>${amount}</button>`)
  }
})
