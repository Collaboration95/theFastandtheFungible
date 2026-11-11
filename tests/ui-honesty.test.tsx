// @vitest-environment jsdom
// Judge-visible copy: the plan modal, the subtitle and the anchored abstention must say what the product does.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import Answer from '../src/components/Answer'
import Ask from '../src/components/Ask'
import PlanSheet from '../src/components/PlanSheet'
import ReportButton from '../src/components/ReportButton'
import { MAX_ROUNDS, PURCHASE_RULE, XRPL_LABEL, SIMULATED_LABEL } from '../shared/contracts/index.js'
import { DEMO_QUESTIONS, TESTNET_QUESTIONS, exampleQuestions } from '../shared/contracts/examples.js'
import { uc2Scope } from '../src/fixtures/run.js'
import { Store } from '../server/store.js'
afterEach(cleanup)
const decoded = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ')

describe('buying rule copy', () => {
  it('the rule states the loop cap, and the loop reads the same constant', () => {
    expect(MAX_ROUNDS).toBe(3)
    expect(PURCHASE_RULE).toBe(`at most one article per round, up to ${MAX_ROUNDS} rounds, within your budget; prefer a matching title or topic and stop when the gap is covered`)
    expect(readFileSync('server/agents/loop.ts', 'utf8')).toMatch(/run\.round >= MAX_ROUNDS/)
  })
  it('the plan modal prints the loop cap from policy, in two short steps, not a hand-written claim', () => {
    const text = decoded(renderToStaticMarkup(<PlanSheet plan={uc2Scope.plan} writers={8} onGo={() => {}} onCancel={() => {}} />))
    expect(text).toContain(`Buy at most one article per round, up to ${MAX_ROUNDS} rounds, only if it fills a gap`)
    expect(text).toContain('A new writer may get one test purchase (up to S$0.30)')
    expect(text).toContain('Search 8 writers for your question')
    expect(text).not.toContain('probe purchase')
    expect(text).not.toMatch(/at most one article if/i)
  })
  it('the home subtitle explains the budget in plain English', () => {
    expect(decoded(renderToStaticMarkup(<Ask onAsk={() => {}} settlement={SIMULATED_LABEL} />))).toContain('Searches free sources first. Pays a writer only when it closes a gap, never beyond your budget.')
  })
  it('no copy still promises a single purchase', () => {
    for (const file of ['src/components/PlanSheet.tsx', 'src/components/Ask.tsx', 'docs/submission/pitch-2min.md', 'docs/submission/demo-video-script.md', 'site/index.html', 'site/talk/index.html'])
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/Buy at most one article if|buys one article only|buys the one article|buy one article straight|buy <strong>that one article/)
  })
})

describe('Testnet example questions', () => {
  it('Testnet shows the three XRPL questions; simulated keeps the fixture stories', () => {
    const testnet = decoded(renderToStaticMarkup(<Ask onAsk={() => {}} settlement={XRPL_LABEL} />))
    for (const q of TESTNET_QUESTIONS) expect(testnet).toContain(q.text)
    expect(testnet).not.toMatch(/Bank of Japan|Kestrel|Malaysia/)
    const simulated = decoded(renderToStaticMarkup(<Ask onAsk={() => {}} settlement={SIMULATED_LABEL} />))
    for (const q of DEMO_QUESTIONS.slice(0, 3)) expect(simulated).toContain(q.text)
    expect(exampleQuestions(XRPL_LABEL)).toHaveLength(3)
  })
})

describe('anchored abstention', () => {
  const abstention = (settlement: string, anchored: boolean) => {
    const store = new Store(':memory:')
    const created = store.createRun('Which Singapore banks pilot RLUSD?', 200, { research: 'fixture', decision: 'fixture', publisher: 'local', settlement: settlement as typeof XRPL_LABEL })
    store.updateRun(created.runId, { phase: 'DONE', ...(anchored ? { ledgerAnchor: { version: 'anchor-v1', network: 'xrpl:1', head: 'a'.repeat(64), runIdHash: 'b'.repeat(64), account: 'rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf', txHash: 'C'.repeat(64), ledgerIndex: 22152330, feeDrops: '12' } } : {}) })
    const run = store.getRun(created.runId); store.close(); return run
  }
  const view = (run: ReturnType<typeof abstention>) => renderToStaticMarkup(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} report={<ReportButton run={run} onReport={() => {}} />} />)
  it('a no-purchase Testnet run shows its ledger proof and the Export menu', () => {
    const html = view(abstention(XRPL_LABEL, true))
    expect(decoded(html)).toContain('Anchored on XRPL · CCCCCCCC…CCCCCCCC · no purchase · anchor fee 12 drops (Testnet) · ledger 22152330')
    expect(html).toContain(`href="https://testnet.xrpl.org/transactions/${'C'.repeat(64)}"`)
    expect(decoded(html)).toContain('Export')
    expect(decoded(html)).toContain('Download receipts.json')
  })
  it('a simulated decline stays honestly unanchored', () => {
    const text = decoded(view(abstention(SIMULATED_LABEL, false)))
    expect(text).toContain('not anchored (simulated)')
    expect(text).not.toContain('Anchored on XRPL')
  })
})
