import { beforeAll, afterAll, expect, it, vi } from 'vitest'
import { fixtureRequirements } from '../server/agents/requirements.js'
import { fixturePlan } from '../server/agents/scope.js'
import { runLiveShaped, type LiveQuestion, type LiveShapedResult } from './fixtures/r9-live-shaped.js'

// Reproduced used-bank D04/D15/H07 losses; general field/action rules, not scorer changes.
const fields = ['Which field on EscrowFinish reveals the secret that unlocks a conditional escrow?', 'Which EscrowFinish field carries the fulfillment for a conditional escrow?', 'What field on EscrowFinish supplies the secret for a conditional escrow?']
const orders = ['Which transaction places a limit order on the XRPL decentralized exchange?', 'Which transaction type places an order on the XRPL decentralized exchange?', 'What XRPL transaction places a decentralized-exchange order?']
const questions: LiveQuestion[] = [...fields, ...orders].map((question, i) => {
  const plan = { ...fixturePlan(question, {}), requirements: fixtureRequirements(question).map(r => r.text) }
  return { id: `bank-regression-${i}`, question, budgetMinor: 200, modal: plan, run: plan, requirementsBy: 'fixture · used regression paraphrase', observed: { bought: [], spentMinor: 0, lead: [] } }
})
let results: LiveShapedResult[]
beforeAll(async () => { vi.stubEnv('SEARCH_EMBEDDINGS', 'off'); results = await runLiveShaped(questions) }, 120_000)
afterAll(() => vi.unstubAllEnvs())
it.each(fields)('a field definition leads before an unrelated time field: %s', question => {
  const r = results.find(r => r.question === question)!
  expect(r.lead.join(' ')).toContain('Fulfillment')
  expect(r.bought).toContain('c5-xrpl-crypto-condition-type')
})
it.each(orders)('placing an order needs its create transaction, not cancellation: %s', question => {
  const r = results.find(r => r.question === question)!
  expect(r.lead.join(' ')).toContain('OfferCreate')
  expect(r.bought).toEqual(['xrpl-tx-offercreate'])
})
