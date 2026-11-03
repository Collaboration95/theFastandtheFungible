// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import ReceiptSheet from '../src/components/ReceiptSheet'
import { exampleRun } from '../shared/contracts/examples'
import { ReceiptBundleSchema } from '../shared/contracts/receipts'
const b = ReceiptBundleSchema.parse(JSON.parse(readFileSync('docs/evidence/round2-g/useful.receipts.json','utf8')))
const run = {...exampleRun, runId:b.runId,contents:b.sources,candidates:b.candidates,answers:b.answers,intents:b.intents,grants:b.grants,receipts:b.receipts}
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function(){this.open=true}
  HTMLDialogElement.prototype.close = function(){this.open=false}
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
/** The status row for a label, e.g. 'Royalty': its text carries the chip label and the recorded-status note. */
const rowText = (label: string) => screen.getByText(label, { selector: 'dt' }).parentElement!.textContent ?? ''
it.each([
  [[], 'Not applicable', 'Direct research · no inbound hire', 'Royalty n/a', 'none'],
  [[{kind:'inbound'}], 'Pending', 'Pending or unresolved; no payout receipt', 'Royalty pending', 'pending'],
  [[{kind:'royalty',status:'SIGNED_UNCONFIRMED',amountDrops:'5000',policyVersion:'hire-v1'}], 'Pending', 'SIGNED_UNCONFIRMED · 5000 drops · hire-v1', 'Royalty pending', 'pending'],
  [[{kind:'royalty',status:'CONFIRMED',amountDrops:'5000',policyVersion:'hire-v1'}], 'Confirmed · recorded', 'CONFIRMED · 5000 drops · hire-v1 (recorded status; not checked on ledger here)', 'Royalty confirmed (recorded)', 'ok'],
])('displays existing royalty status without promoting pending or inventing a payout (%j)', async (payments, label, text, summary, tone) => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({payments})}))
  render(<ReceiptSheet run={run} receipt={b.receipts[0]} onClose={()=>{}}/>)
  await waitFor(()=>expect(rowText('Royalty')).toContain(text))
  const chip = within(screen.getByText('Royalty', { selector: 'dt' }).parentElement!).getByText(label)
  expect(chip.className).toContain(`tone-${tone}`)
  expect(screen.getByText(/Cited in 4 claims/).textContent).toContain(summary)
  expect(screen.getByText('Cited in the final answer')).toBeTruthy()
  expect(rowText('Semantic contribution')).toContain('Not assessed')
  expect(rowText('Semantic contribution')).toContain('Not independently verified')
})
it('keeps an unavailable royalty export unassessed', async () => {
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')))
  render(<ReceiptSheet run={run} receipt={b.receipts[0]} onClose={()=>{}}/>)
  await waitFor(()=>expect(fetch).toHaveBeenCalled())
  expect(rowText('Royalty')).toContain('Not assessed')
  expect(rowText('Royalty')).toContain('Separate hire receipts record payouts')
  expect(screen.getByText(/Royalty not assessed/)).toBeTruthy()
})
it('renders a recorded refund separately from ledger validation and never shows quarantined passage use', async () => {
  const rb = ReceiptBundleSchema.parse(JSON.parse(readFileSync('docs/evidence/round2-g/refunded.receipts.json','utf8')))
  const receipt = rb.receipts.find(r => rb.intents.some(i => i.intentId === r.intentId && i.refund))!
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}))
  render(<ReceiptSheet run={{...run,labels:{...run.labels,settlement:receipt.label},intents:rb.intents,contents:rb.sources,candidates:rb.candidates,answers:rb.answers,grants:rb.grants,receipts:rb.receipts}} receipt={receipt} onClose={()=>{}}/>)
  expect(screen.getByText('Recorded refund · ledger lookup not run here')).toBeTruthy()
  expect(screen.getByText('No final citation use')).toBeTruthy()
  expect(rowText('Refund')).toContain('Recorded verified refund')
  expect(screen.queryByText('Verify this link')).toBeNull()
})
it('preserves removed claim disclosures rather than presenting them as final use', () => {
  const rb = ReceiptBundleSchema.parse(JSON.parse(readFileSync('docs/evidence/round2-g/redundant.receipts.json','utf8')))
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({payments:[]})}))
  render(<ReceiptSheet run={{...run,answers:rb.answers}} receipt={rb.receipts[0]} onClose={()=>{}}/>)
  expect(screen.getByText('No final citation use')).toBeTruthy()
  expect(screen.getAllByText('Removed').length).toBe(4)
  expect(screen.getAllByText('answer v1').length).toBe(4)
})
it('expands a claim row to the exact delivered passage, then to the verify detail', () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({payments:[]})}))
  render(<ReceiptSheet run={run} receipt={b.receipts[0]} onClose={()=>{}}/>)
  const rows = screen.getAllByRole('button', { name: /^Claim \d/ })
  expect(rows.length).toBe(4)
  expect(rows[0].getAttribute('aria-expanded')).toBe('false')
  expect(screen.queryByText(/Exact delivered passage/)).toBeNull()
  fireEvent.click(rows[0])
  expect(rows[0].getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByText(/Exact delivered passage/).textContent).toMatch(/·\s*p1$/)
  expect(screen.queryByText('Manifest root')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Verify this link' }))
  expect(screen.getByText('Manifest root')).toBeTruthy()
})
