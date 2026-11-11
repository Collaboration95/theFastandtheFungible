// @vitest-environment jsdom
// T2 · Judges' corner: check our work without asking a question. The strip needs no admission, so it renders and works whether the
// sandbox is ready, busy, paused or closed; its recorded run is the committed hosted export, byte for byte. No network: the verifier is mocked.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { HostedDemoStatus } from '../src/api'
import { getDemoStatus } from '../src/api'
import { canAsk, explorerTx, HostedContext, homeState, JUDGE_RUN, proofLink, type HomeState, type Hosted } from '../src/hosted'
import { HostedIntro } from '../src/components/hosted/HostedHome'
import Ask from '../src/components/Ask'
import ledgerFixture from './fixtures/ledger-check/rpc.json'

// Automatic payer reads stay offline, just like the strip's mocked verifier.
vi.mock('../src/ledger-check', async original => ({ ...await original<typeof import('../src/ledger-check')>(), readPayer: async () => ({ network: 'XRPL Testnet', ledger: ledgerFixture.payer.ledger_index, readAt: ledgerFixture.readAt, ownerCount: ledgerFixture.payer.account_data.OwnerCount, openEscrows: ledgerFixture.escrows.account_objects.length, text: 'Shared Testnet payer rbcLo4… · recorded fixture' }) }))

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.doUnmock('../src/verify/browser'); vi.resetModules() })

it('pins the recorded caption to the final answer and audited decision providers', () => {
  const bundle = JSON.parse(readFileSync('public/judge/hosted-run-nov11.receipts.json', 'utf8'))
  const answer = bundle.answers.at(-1)
  expect(answer.provider).toBe('deepseek')
  const decisions = bundle.audit.entries.filter((entry: { kind: string }) => entry.kind === 'decision')
  expect(decisions.length).toBeGreaterThan(0)
  expect(decisions.every((entry: { data: { provider: string } }) => entry.data.provider === 'fixture')).toBe(true)
  expect(JUDGE_RUN.caption).toBe('Recorded on this demo, 11 Nov 2026 · XRPL Testnet · live answers, rule-based buying · team-authored writers · no real value')
})

const status = (patch: Partial<HostedDemoStatus> = {}): HostedDemoStatus => ({
  questionCapMinor: 200, state: 'ready', csrfToken: 't', queue: [],
  capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false },
  remaining: { questions: 5, minor: 1000 }, labels: { models: 'live models · fixture purchase decisions', rail: 'Shared XRPL Testnet demo · no real value' },
  links: { repo: 'https://github.com/example/repo', deck: '', video: '', progress: '', replay: '' }, ...patch,
})
const hosted = (patch: Partial<HostedDemoStatus> = {}): Hosted => ({ status: status(patch) })
/** The hosted home as App builds it: the intro, then the composer and examples (or just the intro when the demo is closed). */
const home = (h: Hosted, state: HomeState) => <HostedContext.Provider value={h}>
  <Ask onAsk={() => {}} settlement="XRPL TESTNET · no real value" intro={<HostedIntro hosted={h} state={state} />} closed={!canAsk(state)} />
</HostedContext.Provider>

const showHome = async (h: Hosted, state: HomeState) => {
  const view = render(home(h, state))
  const disclosure = view.container.querySelector('.ra-hwork') as HTMLDetailsElement
  await act(async () => { disclosure.open = true; fireEvent(disclosure, new Event('toggle')) })
  await screen.findByRole('button', { name: 'Run the checks' })
  return view
}

describe('the committed recorded run', () => {
  it('is the hosted export of 11 Nov, byte for byte, with the pinned SHA-256', async () => {
    const served = readFileSync('public/judge/hosted-run-nov11.receipts.json')
    const evidence = readFileSync('docs/evidence/hosted-export-nov11/receipts.json')
    expect(createHash('sha256').update(served).digest('hex')).toBe('1f2fe4de4de58fedb68c8e04c9f2106fa0b66004c1839ae93f29bb0662ee13ee')
    expect(Buffer.compare(served, evidence)).toBe(0)
    expect(JUDGE_RUN.bundleUrl).toBe('/judge/hosted-run-nov11.receipts.json')
  })
  it('contains the EscrowFinish the strip links to', async () => {
    const bundle = readFileSync('public/judge/hosted-run-nov11.receipts.json', 'utf8')
    expect(bundle).toContain(JUDGE_RUN.keyTx)
    expect(explorerTx(JUDGE_RUN.keyTx)).toBe('https://testnet.xrpl.org/transactions/4CCB4E56137D738847E853535B068329562AD490DA4D9F5551CEC2EB1AC70638')
  })
})

describe('the strip', () => {
  const states: [HomeState, Partial<HostedDemoStatus>][] = [
    ['ready', {}], ['busy', { state: 'busy', wait: { ahead: 2, own: false } }], ['paused', { state: 'paused', capabilities: { ...status().capabilities, ask: false } }],
    ['ended', { state: 'ended', capabilities: { ...status().capabilities, ask: false } }],
  ]
  it.each(states)('renders its three items when the sandbox is %s, and the proof link only when one is configured', async (expected, patch) => {
    const h = hosted(patch)
    expect(homeState(h)).toBe(expected)
    await showHome(h, expected)
    const strip = screen.getByRole('region', { name: 'Check our work without asking a question' })
    expect(within(strip).getByRole('heading', { name: 'Verify a real run from this demo in your browser' })).toBeTruthy()
    expect(within(strip).getByRole('heading', { name: 'See the key on the ledger' })).toBeTruthy()
    expect(within(strip).getByText('The Fulfillment field is the article key.')).toBeTruthy()
    expect(within(strip).getByRole('button', { name: 'Run the checks' })).toBeTruthy()
    expect(within(strip).getByText(JUDGE_RUN.caption)).toBeTruthy()
    expect(within(strip).queryByText('See it refuse to spend')).toBeNull()
  })
  it('sits after the composer and examples while the demo takes questions, and in the intro (no composer) when it does not', async () => {
    await showHome(hosted(), 'ready')
    const order = (node: Element | null) => node!.compareDocumentPosition.bind(node)
    const strip = screen.getByRole('region', { name: 'Check our work without asking a question' }), composer = screen.getByRole('textbox', { name: 'Your question' }), examples = screen.getByRole('group', { name: 'Demo questions' })
    expect(order(composer)(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(order(examples)(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    cleanup()
    await showHome(hosted({ state: 'paused' }), 'paused')
    expect(screen.queryByRole('textbox', { name: 'Your question' })).toBeNull()
    expect(screen.getAllByRole('region', { name: 'Check our work without asking a question' })).toHaveLength(1)
  })
  it('shows the proof of refusal only for a safe configured link', async () => {
    const shown = hosted({ links: { ...status().links, proof: 'https://ra-front.example/proof/' + 'a'.repeat(32) } })
    await showHome(shown, 'ready')
    expect(screen.getByRole('link', { name: /Open the proof of refusal/ }).getAttribute('href')).toBe('https://ra-front.example/proof/' + 'a'.repeat(32))
    cleanup()
    expect(proofLink(hosted({ links: { ...status().links, proof: `/proof/${'b'.repeat(32)}` } }))).toBe(`/proof/${'b'.repeat(32)}`)
    for (const bad of ['', '   ', 'javascript:alert(1)', 'http://insecure.example/x', '//evil.example/x', '/proof/../../etc', 'https://x.example/a b', 'data:text/html,hi']) expect(proofLink(hosted({ links: { ...status().links, proof: bad } })), bad).toBeUndefined()
    await showHome(hosted({ links: { ...status().links, proof: 'javascript:alert(1)' } }), 'ready')
    expect(screen.queryByText('See it refuse to spend')).toBeNull()
  })
  it('corrects the tile copy to "It buys only to fill a gap"', async () => {
    await showHome(hosted(), 'ready')
    expect(screen.getByText('It buys only to fill a gap')).toBeTruthy()
    expect(document.body.textContent).not.toContain('It buys only what helps')
  })
})

describe('using it costs no question', () => {
  const check = (status: 'PASS' | 'FAIL' | 'SKIP') => ({ check: `c-${status}`, status, detail: '' })
  const setup = (checks: ReturnType<typeof check>[]) => {
    vi.doMock('../src/verify/browser', () => ({ verifyInBrowser: async () => ({ ok: !checks.some(c => c.status === 'FAIL'), checks, groups: [], endpoint: 's.altnet.rippletest.net', testnet: true, at: '' }) }))
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ label: 'recorded' }) }))
    vi.stubGlobal('fetch', fetchSpy)
    return fetchSpy
  }
  it.each(['ready', 'busy', 'paused', 'ended'] as const)('(a) in %s reads only the committed file, with no admission call', async state => {
    const fetchSpy = setup([...Array.from({ length: 26 }, () => check('PASS')), check('SKIP'), check('SKIP')])
    const h = hosted({ state, capabilities: { ...status().capabilities, ask: state === 'ready' || state === 'busy' } })
    const before = JSON.stringify(h.status.remaining)
    await showHome(h, state)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run the checks' })) })
    expect((await screen.findByText(/passed/, { selector: '.ra-hv-head' })).textContent).toBe('26 passed · 2 not checked')
    expect(fetchSpy.mock.calls.map(call => String((call as unknown[])[0]))).toEqual(['/judge/hosted-run-nov11.receipts.json'])
    expect(JSON.stringify(h.status.remaining)).toBe(before)
    expect(screen.getByText(JUDGE_RUN.caption)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Run again' })).toBeTruthy()
  })
  it('(a) says so plainly when the file cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    await showHome(hosted(), 'ready')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run the checks' })) })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('could not be downloaded'))
  })
  it('(b) is a plain link to the explorer: clicking it makes no request of ours', async () => {
    const fetchSpy = setup([check('PASS')])
    await showHome(hosted({ state: 'ended' }), 'ended')
    const link = screen.getByRole('link', { name: /Open the EscrowFinish/ })
    expect(link.getAttribute('href')).toBe(explorerTx(JUDGE_RUN.keyTx))
    expect(link.getAttribute('target')).toBe('_blank'); expect(link.getAttribute('rel')).toContain('noopener')
    link.addEventListener('click', event => event.preventDefault())
    fireEvent.click(link)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('the status schema', () => {
  const body = (links: Record<string, unknown>) => ({ ...status(), links })
  const serve = (payload: unknown) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => payload })))
  it('accepts a server that sends no links.proof, and one that does', async () => {
    serve(body({ repo: 'r', deck: '', video: '', progress: '', replay: '' }))
    expect((await getDemoStatus()).links.proof).toBeUndefined()
    serve(body({ repo: 'r', deck: '', video: '', progress: '', replay: '', proof: 'https://x.example/proof/' + 'c'.repeat(32) }))
    expect((await getDemoStatus()).links.proof).toContain('/proof/')
  })
})
