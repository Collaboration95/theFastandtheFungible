// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
it.each([
  [[], 'Not applicable · direct research'],
  [[{kind:'inbound'}], 'Pending or unresolved; no payout receipt'],
  [[{kind:'royalty',status:'SIGNED_UNCONFIRMED',amountDrops:'5000',policyVersion:'hire-v1'}], 'SIGNED_UNCONFIRMED · 5000 drops · hire-v1'],
  [[{kind:'royalty',status:'CONFIRMED',amountDrops:'5000',policyVersion:'hire-v1'}], 'CONFIRMED · 5000 drops · hire-v1'],
])('displays existing royalty status without promoting pending or inventing a payout (%j)', async (payments, text) => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({payments})}))
  render(<ReceiptSheet run={run} receipt={b.receipts[0]} onClose={()=>{}}/>)
  await waitFor(()=>expect(screen.getByText(`Royalty: ${text}`,{exact:false})).toBeTruthy())
  expect(screen.getByText('Cited in the final answer')).toBeTruthy()
  expect(screen.getByText(/Semantic contribution: not assessed/)).toBeTruthy()
})
it('keeps an unavailable royalty export unassessed', async () => {
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('offline')))
  render(<ReceiptSheet run={run} receipt={b.receipts[0]} onClose={()=>{}}/>)
  await waitFor(()=>expect(fetch).toHaveBeenCalled())
  expect(screen.getByText(/Royalty: Not assessed/)).toBeTruthy()
})
it('renders a recorded refund separately from ledger validation and never shows quarantined passage use', async () => {
  const rb = ReceiptBundleSchema.parse(JSON.parse(readFileSync('docs/evidence/round2-g/refunded.receipts.json','utf8')))
  const receipt = rb.receipts.find(r => rb.intents.some(i => i.intentId === r.intentId && i.refund))!
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}))
  render(<ReceiptSheet run={{...run,labels:{...run.labels,settlement:receipt.label},intents:rb.intents,contents:rb.sources,candidates:rb.candidates,answers:rb.answers,grants:rb.grants,receipts:rb.receipts}} receipt={receipt} onClose={()=>{}}/>)
  expect(screen.getByText('Recorded refund · ledger lookup not run here')).toBeTruthy()
  expect(screen.getByText('No final citation use')).toBeTruthy()
  expect(screen.getByText('Refund status: recorded verified refund')).toBeTruthy()
  expect(screen.queryByText('Verify this link')).toBeNull()
})
it('preserves removed claim disclosures rather than presenting them as final use', () => {
  const rb = ReceiptBundleSchema.parse(JSON.parse(readFileSync('docs/evidence/round2-g/redundant.receipts.json','utf8')))
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({payments:[]})}))
  render(<ReceiptSheet run={{...run,answers:rb.answers}} receipt={rb.receipts[0]} onClose={()=>{}}/>)
  expect(screen.getByText('No final citation use')).toBeTruthy()
  expect(screen.getAllByText(/removed · answer v1/).length).toBe(4)
})
