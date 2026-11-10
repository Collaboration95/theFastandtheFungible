// @vitest-environment jsdom
// H5 (live hosted sweep, 11 Nov): what the judges' path on the deployed demo showed, fixed in the shared client code.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { RunSnapshot } from '../shared/contracts'
import { runSettled, ANCHOR_PENDING_LABEL } from '../shared/anchor-status'
import { offlineZeroBudgetRun, ucRuns } from '../src/fixtures/run'
import Answer, { finding } from '../src/components/Answer'

afterEach(() => cleanup())

describe('a lead reads as a sentence', () => {
  it('capitalises an extract that starts mid-sentence, and leaves identifiers alone', () => {
    // Live leads: "…reveals the secret.¹ the only supported crypto-condition type…", "prompt injection cannot increase…".
    expect(finding('the only supported crypto-condition type is PREIMAGE-SHA-256')).toBe('The only supported crypto-condition type is PREIMAGE-SHA-256.')
    expect(finding('prompt injection cannot increase spending authorization: the budget is the only authorization.')).toBe('Prompt injection cannot increase spending authorization: the budget is the only authorization.')
    expect(finding('x402 uses PAYMENT-REQUIRED.')).toBe('x402 uses PAYMENT-REQUIRED.')
    expect(finding('tesSUCCESS in a validated ledger is final.')).toBe('tesSUCCESS in a validated ledger is final.')
    expect(finding('rNY14qvMuBi6CqU4wPbWaS5nztPLCxJTFn holds the escrow')).toBe('rNY14qvMuBi6CqU4wPbWaS5nztPLCxJTFn holds the escrow.')
  })
})

describe('a decline counts each article once', () => {
  it('three rounds over the same sources read as those sources, with the latest verdict', () => {
    const base = offlineZeroBudgetRun.decisions[0]
    const rows = Array.from({ length: 4 }, (_, i) => ({ ...base.rows[0], candidate: { ...offlineZeroBudgetRun.candidates[0], tier: 'PAID' as const, resourceId: `n${i}`, title: `Note ${i}` }, value: 0.1, verdict: 'SKIP_LOW_VALUE' as const, reason: `Reason ${i}` }))
    const last = rows.map(row => ({ ...row, verdict: 'SKIP_OVER_BUDGET' as const }))
    const run = { ...offlineZeroBudgetRun, phase: 'DONE', answers: [], intents: [], receipts: [], candidates: rows.map(row => row.candidate), decisions: [1, 2, 3].map(round => ({ ...base, round, threshold: 0.2, rows: round === 3 ? last : rows })) } as RunSnapshot
    const why = render(<Answer run={run} view="latest" onView={() => {}} compare={false} onCompare={() => {}} />).container.querySelector('details.ra-why-not')!
    expect(why.querySelector('summary')?.textContent).toBe('Why nothing was bought · 4 articles considered')
    expect(why.querySelectorAll('li')).toHaveLength(4)
    expect(why.textContent).toContain('Over the budget left')
  })
})

describe('a settled run needs no live stream', () => {
  const anchor = { version: 'anchor-v1', network: 'xrpl:1', head: 'a'.repeat(64), runIdHash: 'b'.repeat(64), account: 'r', txHash: 'C'.repeat(64), ledgerIndex: 1, feeDrops: '12' }
  const done = { ...ucRuns.UC2, phase: 'DONE' as const, intents: ucRuns.UC2.intents.map(intent => ({ ...intent, status: 'VERIFIED' as const })) }
  it('waits for final payments and the ledger anchor (or its final failure)', () => {
    expect(runSettled({ ...done, ledgerAnchor: anchor })).toBe(true)
    expect(runSettled({ ...done, ledgerAnchor: undefined })).toBe(false)
    expect(runSettled({ ...done, ledgerAnchor: undefined, events: [...done.events, { ...done.events[0], label: ANCHOR_PENDING_LABEL }] })).toBe(false)
    expect(runSettled({ ...done, ledgerAnchor: undefined, events: [...done.events, { ...done.events[0], label: 'Anchor unavailable (failed)' }] })).toBe(true)
    // Stop during a live escrow: the run is STOPPED but the cancel is still on its way.
    expect(runSettled({ ...done, phase: 'STOPPED', stopped: true, ledgerAnchor: anchor, intents: [{ ...done.intents[0], status: 'SUBMITTING' }] })).toBe(false)
    expect(runSettled({ ...done, phase: 'SEARCH' as never, ledgerAnchor: anchor })).toBe(false)
  })
})
