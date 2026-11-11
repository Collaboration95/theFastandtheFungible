// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { act, cleanup, render, screen } from '@testing-library/react'
import { getRun } from '../src/api'
import { anchorProgress } from '../shared/anchor-status.js'
import AnchorStatus from '../src/components/AnchorStatus'
import ReportButton from '../src/components/ReportButton'
import { Store } from '../server/store.js'
vi.mock('../src/api', () => ({ getRun: vi.fn() }))
afterEach(cleanup)
function abstention() {
 const store = new Store(':memory:')
 const run = store.createRun('orchids',200,{research:'fixture',decision:'fixture',publisher:'local',settlement:'XRPL TESTNET · no real value'})
 store.updateRun(run.runId,{phase:'DONE'})
 const result = store.getRun(run.runId); store.close(); return result
}
it('exports a DONE abstention even without a validated purchased answer', () => {
 render(<ReportButton run={abstention()} onReport={vi.fn()} />)
 expect(screen.getByText('Export')).toBeTruthy()
 expect(screen.getByText('Download receipts.json')).toBeTruthy()
 expect(screen.getByText('Export report').hasAttribute('disabled')).toBe(true)
})
it('pins the Export verify hint to this release’s wheel (an older verifier fails newer hosted exports)', () => {
 render(<ReportButton run={abstention()} onReport={vi.fn()} />)
 const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
 expect(screen.getByText(`pip install https://github.com/Collaboration95/theFastandtheFungible/releases/download/v${version}/researchagent-${version}-py3-none-any.whl`)).toBeTruthy()
 expect(screen.getByText('researchagent verify receipts.json --ledger')).toBeTruthy()
})
it('labels no purchase, fee and ledger together', () => {
 const run = abstention()
 run.ledgerAnchor = {version:'anchor-v1',network:'xrpl:1',head:'a'.repeat(64),runIdHash:'b'.repeat(64),account:'rAccount',txHash:'c'.repeat(64),ledgerIndex:123,feeDrops:'12'}
 render(<AnchorStatus run={run} />)
 expect(screen.getByText('Anchored on XRPL · no purchase · anchor fee 12 drops (Testnet) · ledger 123')).toBeTruthy()
})
it('keeps a DONE run visibly unavailable after submission failure', () => {
 const run = abstention()
 run.events.push({id:1,runId:run.runId,at:new Date().toISOString(),type:'SNAPSHOT',label:'Anchor unavailable (submission or validation failed)'})
 render(<AnchorStatus run={run} />)
 expect(screen.getByText('Anchor unavailable (submission or validation failed)')).toBeTruthy()
 expect(run.phase).toBe('DONE')
})
const ANCHOR = {version:'anchor-v1',network:'xrpl:1',head:'a'.repeat(64),runIdHash:'b'.repeat(64),account:'rAccount',txHash:'c'.repeat(64),ledgerIndex:123,feeDrops:'12'} as const
const event = (run: ReturnType<typeof abstention>, id: number, label: string) => ({id,runId:run.runId,at:new Date().toISOString(),type:'SNAPSHOT',label})
const freshRun = (...labels: string[]) => { const run = abstention(); run.events = labels.map((label, i) => event(run, i + 1, label)); return run }

it('keeps polling through "Anchoring… awaiting validation" and shows the anchor without a reload', async () => {
 vi.useFakeTimers()
 try {
  const pending = freshRun('Anchoring… awaiting validation')
  const reads: string[][] = []
  vi.mocked(getRun).mockImplementation(async () => { const next = reads.length < 2 ? pending : { ...pending, ledgerAnchor: ANCHOR }; reads.push(next.events.map(e => e.label)); return next })
  render(<AnchorStatus run={pending} />)
  expect(screen.getByText('Anchoring… awaiting validation')).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(reads).toHaveLength(2) // Pending is not terminal: the second read happened.
  expect(screen.getByText('Anchoring… awaiting validation')).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(screen.getByText('Anchored on XRPL · no purchase · anchor fee 12 drops (Testnet) · ledger 123')).toBeTruthy()
  const stopped = reads.length
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(reads).toHaveLength(stopped)
 } finally { vi.useRealTimers() }
})

it('stops polling and says so on a real terminal failure', async () => {
 vi.useFakeTimers()
 try {
  const pending = freshRun('Anchoring… awaiting validation')
  const failed = { ...pending, events: [...pending.events, event(pending, 2, 'Anchor unavailable (validation not confirmed in time)')] }
  let reads = 0
  vi.mocked(getRun).mockImplementation(async () => { reads++; return failed })
  render(<AnchorStatus run={pending} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(screen.getByText('Anchor unavailable (validation not confirmed in time)')).toBeTruthy()
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(reads).toBe(1)
 } finally { vi.useRealTimers() }
})

it('a pre-fix interim "(validation pending or unsuccessful)" event is not terminal', () => {
 expect(anchorProgress(freshRun('Anchor unavailable (validation pending or unsuccessful)').events)).toBeUndefined()
})
