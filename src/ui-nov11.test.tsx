// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import ClarifyChips from './components/ClarifyChips'
import PlanSheet from './components/PlanSheet'
import SpendPanel from './components/SpendPanel'
import MobileSpend from './components/MobileSpend'
import ReceiptSheet from './components/ReceiptSheet'
import Ledger from './components/Ledger'
import ReportButton from './components/ReportButton'
import { EnvNote } from './components/EnvIndicator'
import WriterChip, { TrustChip } from './components/WriterChip'
import Passage from './components/Passage'
import { ucRuns, uc2Scope } from './fixtures/run'
import { VERDICT_LABEL } from './copy'
import { readFileSync } from 'node:fs'
import { RunSnapshotSchema } from '../shared/contracts'
import { money } from '../shared/presentation'

Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { value() { this.setAttribute('open', '') }, configurable: true })
Object.defineProperty(HTMLDialogElement.prototype, 'close', { value() { this.removeAttribute('open') }, configurable: true })
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })
it('renders both server questions without replacing their text', () => {
 render(<ClarifyChips questions={[{id:'time',text:'Which time horizon?',options:['2026','2027']},{id:'place',text:'Which market?',options:['Japan','Singapore']}]} answers={{}} onAnswer={()=>{}} onSkip={()=>{}} />)
 expect(screen.getByText('Which time horizon?')).toBeTruthy(); expect(screen.getByText('Which market?')).toBeTruthy()
})
it('labels a failed faucet as a simulated preview without retrying spending', () => {
 render(<EnvNote labels={{...ucRuns.UC2.labels,testnetFallback:'faucet_unavailable'}} onDone={()=>{}} />)
 expect(screen.getByRole('status').textContent).toContain('faucet unavailable')
 expect(screen.getByRole('status').textContent).toContain('simulated preview')
 expect(screen.getByRole('status').textContent).toContain('Retry Testnet setup from the terminal')
})
it('requires explicit Start under reduced motion and announces paused time', async () => {
 vi.useFakeTimers(); vi.stubGlobal('matchMedia', () => ({matches:true,addEventListener(){},removeEventListener(){}}))
 const go=vi.fn(); render(<PlanSheet plan={uc2Scope.plan} onGo={go} onCancel={()=>{}} />)
 await act(async()=>vi.advanceTimersByTimeAsync(6000)); expect(go).not.toHaveBeenCalled()
 expect(screen.getByRole('timer').textContent).toContain('paused')
 fireEvent.click(screen.getByRole('button',{name:'Start now'})); expect(go).toHaveBeenCalledOnce()
})
it('names escrow holds and separates refunded net cost from remaining allowance', () => {
 const run={...ucRuns.UC2,budgetMinor:200,spentMinor:70,refundedMinor:30,reservedMinor:20}
 render(<><SpendPanel run={run} onRetry={()=>{}} onReceipt={()=>{}} /><MobileSpend run={run} onRetry={()=>{}} onReceipt={()=>{}} /></>)
 expect(screen.getAllByText(/Held in escrow/).length).toBeGreaterThan(0)
 expect(screen.getByRole('img',{name:/Paid S\$0.70, held in escrow S\$0.20, refunded S\$0.30, budget left S\$1.10/})).toBeTruthy()
 expect(screen.getByRole('button',{name:/Net cost S\$0.40 · S\$1.10 budget left/})).toBeTruthy()
})
it('handles a denied invoice clipboard write with visible feedback', async () => {
 const run=ucRuns.UC2,receipt=run.receipts[0]
 vi.stubGlobal('navigator',{clipboard:{writeText:vi.fn().mockRejectedValue(Error('denied'))}})
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}))
 render(<ReceiptSheet run={run} receipt={receipt} onClose={()=>{}} />)
 const invoice=run.intents.find(i=>i.intentId===receipt.intentId)?.quote?.quoteHash
 expect(invoice).toBeTruthy();fireEvent.click(screen.getByTitle(invoice!))
 expect(await screen.findByRole('status')).toBeTruthy();expect(screen.getByRole('status').textContent).toContain('Couldn’t copy')
})
it('shows a holdback refund as partial net cost with the buyer cancel link', () => {
 const run=RunSnapshotSchema.parse(JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json','utf8')).run)
 const receipt=run.receipts.find(r=>r.amountMinor>0 && run.intents.some(i=>i.intentId===r.intentId && i.status==='VERIFIED'))!,intent=run.intents.find(i=>i.intentId===receipt.intentId)!,hash='B'.repeat(64),refund=receipt.amountMinor/5
 intent.escrow!.holdback={state:'refunded',amount:String(refund*1000),amountMinor:refund,percent:20,condition:`A0258020${'A'.repeat(64)}810120`,cancelAfter:800000600,cancelHash:hash}
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}))
 render(<ReceiptSheet run={run} receipt={receipt} onClose={()=>{}} />)
 expect(screen.getByText('Net cost').nextElementSibling?.textContent).toBe(money(receipt.amountMinor-refund))
 expect(screen.getAllByText('Holdback refunded').length).toBeGreaterThan(0)
 expect(screen.getByText('Refund tx').nextElementSibling?.querySelector('a')?.getAttribute('href')).toContain(hash)
})
it('retries a failed ledger balance read on a terminal run', async () => {
 const recording=JSON.parse(readFileSync('demo/traces/UC3-key-reveal.json','utf8'))
 const run=RunSnapshotSchema.parse(recording.run)
 const fetch=vi.fn().mockResolvedValueOnce({ok:false,status:503}).mockResolvedValue({ok:true,json:async()=>({rail:'xrpl-testnet',network:'xrpl:1',updatedAt:new Date().toISOString(),accountExplorer:'https://testnet.xrpl.org/accounts',wallets:[]})})
 vi.stubGlobal('fetch',fetch);render(<Ledger run={run} />)
 fireEvent.click(await screen.findByRole('button',{name:'Retry balances'}))
 await act(async()=>{});expect(fetch).toHaveBeenCalledTimes(2);expect(screen.queryByText('Balances unavailable.')).toBeNull()
})
it('covers every policy verdict with the shared working vocabulary',()=>{
 expect(Object.values(VERDICT_LABEL).every(word=>['Buy','Skip','Rewrite','Blocked'].includes(word))).toBe(true)
})

it('updates countdown time and replaces it with an accurate paused state', async()=>{
 vi.useFakeTimers(); vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}))
 const go=vi.fn();render(<PlanSheet plan={uc2Scope.plan} onGo={go} onCancel={()=>{}} />)
 await act(async()=>vi.advanceTimersByTimeAsync(2100));expect(screen.getByRole('timer').getAttribute('aria-label')).toBe('Starting in 3 seconds')
 fireEvent.click(screen.getByRole('button',{name:'Pause countdown'}));await act(async()=>vi.advanceTimersByTimeAsync(6000))
 expect(screen.getByRole('timer').getAttribute('aria-label')).toContain('paused');expect(go).not.toHaveBeenCalled()
})
it('acknowledges a copied bare link and safely reports a later clipboard failure', async()=>{
 const writeText=vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('denied'))
 vi.stubGlobal('navigator',{clipboard:{writeText}});render(<ReportButton run={ucRuns.UC2} onReport={()=>{}} />)
 const copy=screen.getByRole('button',{name:'Copy link',hidden:true});fireEvent.click(copy)
 expect((await screen.findByRole('status',{hidden:true})).textContent).toBe('Link copied');expect(writeText).toHaveBeenCalledWith(window.location.href)
 fireEvent.click(screen.getByRole('button',{name:'Link copied',hidden:true}));expect((await screen.findByRole('alert',{hidden:true})).textContent).toContain('Couldn’t copy the link')
})

it('says trust and authorship in plain words, with the detail in a tooltip', () => {
 const { container } = render(<><TrustChip reputation={{ H: 0.8, C: 1, T: 0.8, status: 'active' }} /><TrustChip /></>)
 expect(container.textContent).toContain('Trust 0.80');expect(container.textContent).toContain('No history')
 expect(container.textContent).not.toMatch(/\bT 0\.|T new|Honesty H/)
 const candidate = { ...ucRuns.UC2.candidates[0], publisherSlug: 'team-xrpl-explainers', publisher: 'ResearchAgent builders · XRPL explainers' }
 render(<WriterChip candidate={candidate} variant="card" />)
 const badge = screen.getByText('Team-authored');expect(badge.getAttribute('title')).toContain('Not an independent writer')
 expect(document.body.textContent).not.toContain('not an independent writer · Testnet')
})
it('makes the scrolling passage keyboard-focusable and named', () => {
 const run = ucRuns.UC3, candidate = run.candidates.find(item => item.tier === 'PAID') ?? run.candidates[0]
 render(<Passage candidate={candidate} content={undefined} citation={undefined} onClose={() => {}} />)
 const region = screen.getByRole('region', { name: 'Source text', hidden: true })
 expect(region.getAttribute('tabindex')).toBe('0')
})
