// Hosted judge UI (lane HU): the state, copy and environment derived from GET /api/demo/status, Stop wording per
// payment phase, the budget cap, and the browser verifier's crypto shims against Node's own implementation.
import { createHash as nodeHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { encryptDelivery } from '../shared/key-reveal'
import { canonicalJson } from '../shared/manifest'
import type { PurchaseIntent } from '../shared/contracts'
import { ApiError, type HostedDemoStatus } from './api'
import { allowanceText, canAsk, environment, homeState, hostedLinks, refusal, type Hosted } from './hosted'
import { stopLine } from './stopLine'
import { ucRuns } from './fixtures/run'
import BudgetPicker from './components/BudgetPicker'
import Sidebar from './components/Sidebar'
import { BrowserBuffer } from './verify/shims/buffer'
import { createDecipheriv, createHash, prepareDecryption } from './verify/shims/node-crypto'
import { groupChecks } from './verify/browser'

const status = (patch: Partial<HostedDemoStatus> = {}): HostedDemoStatus => ({
  state: 'ready', csrfToken: 'token', queue: [],
  capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false },
  remaining: { questions: 5, minor: 1000 },
  labels: { models: 'live research configured · per-answer fallback labelled', rail: 'Shared XRPL Testnet demo · no real value' },
  links: { repo: 'https://github.com/example/repo', deck: '', video: '', progress: '', replay: '' },
  ...patch,
})
const hosted = (patch: Partial<HostedDemoStatus> = {}, connection?: Hosted['connection']): Hosted => ({ status: status(patch), connection })

describe('hosted home state', () => {
  it('shows one state, with the used-up allowance ahead of the gateway’s generic degraded', () => {
    expect(homeState(hosted())).toBe('ready')
    expect(homeState(hosted({ state: 'busy' }))).toBe('busy')
    expect(homeState(hosted({ state: 'paused' }))).toBe('paused')
    expect(homeState(hosted({ state: 'ended' }, 'offline'))).toBe('ended')
    expect(homeState(hosted({ state: 'degraded' }))).toBe('degraded')
    expect(homeState(hosted({ state: 'degraded', remaining: { questions: 0, minor: 0 } }))).toBe('allowance')
    expect(homeState(hosted({ remaining: { questions: 2, minor: 150 } }))).toBe('allowance') // less than one question's hold
    expect(homeState(hosted({}, 'offline'))).toBe('offline')
    expect(homeState(hosted({}, 'unreachable'))).toBe('unreachable')
    expect(['ready', 'busy', 'allowance', 'paused', 'ended', 'degraded', 'offline', 'unreachable'].filter(state => canAsk(state as never))).toEqual(['ready', 'busy'])
    expect(allowanceText(status({ remaining: { questions: 3, minor: 600 } }))).toBe('3 of 5 questions left today')
    expect(allowanceText(status({ remaining: { questions: 0, minor: 0 } }))).toBe('No questions left today')
  })

  it('labels the environment from the server, never claiming Testnet or live models it does not have', () => {
    expect(environment(status()).full).toBe('Shared XRPL Testnet demo · live models · no real value')
    expect(environment(status({ labels: { models: 'fixture models', rail: 'Shared XRPL Testnet demo · no real value' } })).full).toBe('Shared XRPL Testnet demo · fixture models · no real value')
    const simulated = environment(status({ labels: { models: 'fixture models', rail: 'SIMULATED · no real value' } }))
    expect(simulated.testnet).toBe(false)
    expect(simulated.full).toBe('Shared demo · simulated payments · fixture models · no real value')
    expect(environment(status({ state: 'paused' })).full).toBe('Shared XRPL Testnet demo · paused · no real value')
    expect(environment(status(), 'offline').tone).toBe('off')
  })

  it('maps every gateway refusal to a plain sentence, and nothing to a generic server error', () => {
    expect(refusal(new ApiError(429, 'busy')).kind).toBe('wait')
    expect(refusal(new ApiError(429, 'queue_full')).kind).toBe('wait')
    expect(refusal(new ApiError(409, 'idempotency_conflict')).kind).toBe('retry-new-key')
    for (const code of ['paused', 'spending_paused', 'ended', 'demo_unavailable']) expect(refusal(new ApiError(503, code)).kind).toBe('state')
    expect(refusal(new ApiError(429, 'allowance_exhausted')).text).toBe('You’ve used today’s questions on the shared demo.')
    expect(refusal(new ApiError(400, 'invalid_budget')).text).toBe('Choose a budget up to S$2.00.')
    expect(refusal(new ApiError(429, 'model_daily_cap')).text).toContain('08:00 SGT')
    expect(refusal(new ApiError(408, 'queue_expired')).text).toContain('Nothing was charged')
    expect(refusal(new ApiError(422, 'private_input')).text).toContain('personal or secret details')
    expect(refusal(new ApiError(403, 'csrf_denied')).text).toContain('Reload the page')
    expect(refusal(new ApiError(502)).text).toBe('The research service hit a problem and nothing was charged. Try again in a moment.')
    expect(refusal(new TypeError('Failed to fetch')).text).toBe('The demo server didn’t answer. Your question is still here; try again in a moment.')
    for (const error of [new ApiError(500), new ApiError(418), new TypeError('x')]) expect(refusal(error).text).not.toMatch(/can.t reach the server/i)
  })

  it('keeps an unconfigured video link out and falls back to the public pages', () => {
    const links = hostedLinks(hosted())
    expect(links.video).toBe('')
    expect(links.progress).toMatch(/^https:\/\/.+\/progress\/$/)
    expect(links.keyReveal).toMatch(/\/demo\/\?scenario=UC-key-reveal$/)
    expect(hostedLinks(hosted({ links: { ...status().links, replay: 'https://example.test/demo/?pace=real' } })).keyReveal).toBe('https://example.test/demo/?pace=real&scenario=UC-key-reveal')
  })
})

describe('Stop during each payment phase', () => {
  const run = { ...ucRuns.UC2, phase: 'STOPPED' as const, stopped: true }
  const base = run.intents[0]
  const line = (patch: Partial<PurchaseIntent>, over = run) => stopLine(over, { ...base, ...patch } as PurchaseIntent)
  it('gives a final word only to recorded outcomes; anything unsettled is still being checked', () => {
    expect(line({ status: 'VERIFIED' })).toMatchObject({ tone: 'ok', text: expect.stringContaining('paid S$0.90 before you stopped') })
    expect(line({ status: 'REFUNDED', refund: { amountMinor: 90 } } as Partial<PurchaseIntent>).text).toContain('refunded S$0.90, confirmed on the simulated ledger')
    expect(line({ status: 'CHALLENGED' })).toMatchObject({ tone: 'pending', text: expect.stringContaining('could refuse') })
    expect(line({ status: 'CHALLENGE_REFUSED' }).tone).toBe('bad')
    expect(line({ status: 'DELIVERY_FAILED' }).text).toContain('without paying again')
    expect(line({ status: 'SETTLED' }).tone).toBe('pending')
    expect(line({ status: 'SUBMITTING' })).toMatchObject({ tone: 'pending', text: expect.stringContaining('already on its way when you stopped') })
    expect(line({ status: 'RESERVED' }, { ...run, stopped: false, phase: 'PURCHASING' as never }).tone).toBe('pending')
    expect(line({ status: 'RESERVED' })).toMatchObject({ tone: 'ok', text: expect.stringContaining('not paid. Nothing was charged.') })
  })
  it('says where escrowed money goes', () => {
    const escrow = (state: string) => line({ status: 'RESERVED', escrow: { mode: 'key-reveal', state } } as Partial<PurchaseIntent>)
    expect(escrow('LOCKED').text).toContain('paid only by publishing the article key')
    expect(escrow('CANCEL_DUE').text).toContain('Returning S$0.90 to the sponsor wallet')
    expect(escrow('CANCELLED')).toMatchObject({ tone: 'ok', text: expect.stringContaining('escrow cancelled') })
    expect(line({ status: 'VERIFIED' }, { ...run, labels: { ...run.labels, settlement: 'XRPL TESTNET · no real value' as const } }).text).not.toContain('simulated')
    expect(line({ status: 'REFUNDED', refund: { amountMinor: 90 } } as Partial<PurchaseIntent>, { ...run, labels: { ...run.labels, settlement: 'XRPL TESTNET · no real value' as const } }).text).toContain('the XRPL Testnet ledger')
  })
})

describe('hosted controls', () => {
  it('caps the budget picks at the hosted per-question hold', () => {
    const html = renderToStaticMarkup(<BudgetPicker value={200} onChange={() => {}} max={200} />)
    expect(html).toContain('S$2<')
    expect(html).not.toContain('S$3<')
    expect(html).not.toContain('S$5<')
    expect(html).toContain('max="2"')
    expect(renderToStaticMarkup(<BudgetPicker value={200} onChange={() => {}} />)).toContain('S$5<')
  })
  it('offers Clear my history instead of Settings', () => {
    const props = { runs: [], onOpenRun: () => {}, onNew: () => {}, onPin: () => {}, onDelete: () => {}, busy: false, open: true, width: 260 }
    const html = renderToStaticMarkup(<Sidebar {...props} hosted={{ onClear: () => {} }} />)
    expect(html).toContain('Your questions appear here. They’re private to this browser and kept for 24 hours.')
    expect(html).not.toContain('aria-label="Settings"')
  })
})

describe('in-browser verifier shims', () => {
  it('hashes exactly like node:crypto', () => {
    for (const input of ['', 'abc', 'Kestrel – “quoted” ✓', 'x'.repeat(10_000)]) {
      expect(createHash('sha256').update(input).digest('hex')).toBe(nodeHash('sha256').update(input).digest('hex'))
      expect(createHash('sha256').update(new TextEncoder().encode(input)).digest('hex')).toBe(nodeHash('sha256').update(input).digest('hex'))
    }
    expect(() => createHash('md5')).toThrow(/Unsupported/)
  })
  it('round-trips hex, base64 and UTF-8 like Buffer', () => {
    const text = 'Writer’s passage · 55.2%'
    const bytes = BrowserBuffer.from(text)
    expect(bytes.toString('hex')).toBe(Buffer.from(text).toString('hex'))
    expect(bytes.toString('base64')).toBe(Buffer.from(text).toString('base64'))
    expect(BrowserBuffer.from(bytes.toString('hex'), 'hex').toString('utf8')).toBe(text)
    expect(BrowserBuffer.from(Buffer.from(text).toString('base64'), 'base64').toString()).toBe(text)
    expect(() => BrowserBuffer.from('abc', 'hex')).toThrow()
    expect(BrowserBuffer.concat([BrowserBuffer.from('a'), BrowserBuffer.from('b')]).equals(BrowserBuffer.from('ab'))).toBe(true)
  })
  it('decrypts a published key with WebCrypto exactly as the writer encrypted it, and fails closed on a wrong tag', async () => {
    const delivery = { passages: [{ id: 'p1', text: 'Margins fell to 55.2%.' }] }
    const sealed = encryptDelivery(delivery)
    const { iv, tag } = sealed.commitment
    await prepareDecryption(sealed.secret, iv, tag, sealed.ciphertext)
    const decipher = createDecipheriv('aes-256-gcm', BrowserBuffer.from(sealed.secret, 'hex'), BrowserBuffer.from(iv, 'hex'))
    decipher.setAuthTag(BrowserBuffer.from(tag, 'hex'))
    decipher.update(BrowserBuffer.from(sealed.ciphertext, 'hex'))
    expect(decipher.final().toString('utf8')).toBe(canonicalJson(delivery))
    const forged = tag.slice(0, -2) + (tag.endsWith('00') ? '01' : '00')
    await prepareDecryption(sealed.secret, iv, forged, sealed.ciphertext)
    const wrong = createDecipheriv('aes-256-gcm', BrowserBuffer.from(sealed.secret, 'hex'), BrowserBuffer.from(iv, 'hex'))
    wrong.setAuthTag(BrowserBuffer.from(forged, 'hex'))
    wrong.update(BrowserBuffer.from(sealed.ciphertext, 'hex'))
    expect(() => wrong.final()).toThrow(/authenticate/)
  })
  it('groups checks in plain English, keeps skipped identity checks visible and never counts them as passed', () => {
    const groups = groupChecks([
      { check: 'testnet tx ABC', status: 'PASS', detail: '' },
      { check: 'manifest signature', status: 'PASS', detail: '' },
      { check: 'passages hash', status: 'FAIL', detail: 'mismatch' },
      { check: 'writer credentials', status: 'SKIP', detail: 'online only' },
      { check: 'something new', status: 'PASS', detail: '' },
    ] as never)
    expect(groups.map(group => [group.id, group.status, group.passed, group.total])).toEqual([
      ['ledger', 'PASS', 1, 1], ['signatures', 'PASS', 1, 1], ['passages', 'FAIL', 0, 1], ['identity', 'SKIP', 0, 1], ['other', 'PASS', 1, 1],
    ])
  })
})
