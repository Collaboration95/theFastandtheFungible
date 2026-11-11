// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import PlanSheet from '../src/components/PlanSheet'
import { HostedContext } from '../src/hosted'
import { uc2Scope } from '../src/fixtures/run'
import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { detectHosted, type HostedDemoStatus } from '../src/api'
import Connecting from '../src/components/Connecting'
import { verificationError, verificationNetworkFailure } from '../src/verify-network'
import { warmVerifier } from '../src/warm-verifier'
import type { BrowserVerification } from '../src/verify/browser'

const status: HostedDemoStatus = { state: 'ready', capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false }, remaining: { questions: 5, minor: 100 }, labels: { models: 'fixture models', rail: 'SIMULATED' }, links: { repo: '', deck: '', video: '', progress: '', replay: '' } }
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

for (const delay of [6000, 12000]) it(`keeps the first status request alive for ${delay} ms, then uses its hosted answer`, async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn(() => new Promise<Response>(resolve => setTimeout(() => resolve(Response.json(status)), delay)))
  vi.stubGlobal('fetch', fetcher)
  const boot = detectHosted()
  const settled = vi.fn(); void boot.then(settled)
  await vi.advanceTimersByTimeAsync(delay - 1)
  expect(settled).not.toHaveBeenCalled()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0]).toEqual(['/api/demo/status']) // No abort signal, no overlapping retry.
  await vi.advanceTimersByTimeAsync(1)
  expect(await boot).toEqual({ status, failed: false })
})
it('backs off failed fetches by 4, 8 and 15 seconds without overlapping requests', async () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockRejectedValue(new TypeError('network'))
  vi.stubGlobal('fetch', fetcher)
  const result = detectHosted(4)
  for (const [i, delay] of [4000, 8000, 15000].entries()) {
    await vi.advanceTimersByTimeAsync(delay - 1); expect(fetcher).toHaveBeenCalledTimes(i + 1)
    await vi.advanceTimersByTimeAsync(1); expect(fetcher).toHaveBeenCalledTimes(i + 2)
  }
  expect(await result).toEqual({ failed: true })
})
it('a remote 404 never selects simulated UI; an explicit hosted:false answer can select local', async () => {
  vi.stubGlobal('location', { hostname: 'demo.example', protocol: 'https:' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 404 })))
  expect(await detectHosted(1)).toEqual({ failed: true })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ hosted: false })))
  expect(await detectHosted(1)).toEqual({ failed: false })
})
it('keeps older local servers compatible even when their 404 body is HTML', async () => {
  vi.stubGlobal('location', { hostname: 'localhost', protocol: 'http:' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<h1>Not found</h1>', { status: 404 })))
  expect(await detectHosted(1)).toEqual({ failed: false })
})
it('uses a valid paused 503 status without falling back', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...status, state: 'paused' }, { status: 503 })))
  expect((await detectHosted()).status?.state).toBe('paused')
})
it('shows honest slow-network copy after five seconds with accessible fallback links', async () => {
  vi.useFakeTimers(); render(<Connecting />)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByRole('link', { name: /recorded walkthrough/ }).getAttribute('href')).toContain('/demo/')
  await act(() => vi.advanceTimersByTimeAsync(5000))
  expect(screen.getByRole('status').textContent).toBe('Your network is slow; still trying.')
})
it('separates offline, unreachable ledger, receipt failure and genuine failed checks', () => {
  expect(verificationError(new TypeError('fetch'), false)).toMatch(/^You're offline: the checker couldn't load/)
  expect(verificationError(new Error('Ledger timeout'), true)).toMatch(/^Couldn't reach a public XRPL node/)
  expect(verificationError(new TypeError('Failed to fetch dynamically imported module'), true)).toContain('The checker couldn’t load')
  expect(verificationError(new Error('receipts'), true)).toContain('receipts could not be downloaded')
  const result = (detail: string): BrowserVerification => ({ ok: false, checks: [{ check: 'testnet', status: 'FAIL', detail }], groups: [], endpoint: '', testnet: true, at: '' })
  expect(verificationNetworkFailure(result('Read-only Testnet lookup unavailable'))).toBeInstanceOf(Error)
  expect(verificationNetworkFailure(result('Transaction amount does not match'))).toBeUndefined()
})
it('schedules the verifier only at idle and cancels unused prefetches', () => {
  const idle = vi.fn().mockReturnValue(7), cancel = vi.fn()
  vi.stubGlobal('requestIdleCallback', idle); vi.stubGlobal('cancelIdleCallback', cancel)
  const stop = warmVerifier()
  expect(idle).toHaveBeenCalledOnce(); stop(); expect(cancel).toHaveBeenCalledWith(7)
})

it('explains the existing hosted rule that planning counts even when a run never starts', () => {
  const html = renderToStaticMarkup(<HostedContext.Provider value={{ status }}><PlanSheet plan={uc2Scope.plan} onGo={() => {}} onCancel={() => {}} /></HostedContext.Provider>)
  expect(html).toContain('Planning uses one of your daily questions, even if you cancel or the run doesn’t start.')
})

it('offers the published video when the build supplies its public HTTPS URL', () => {
  vi.stubEnv('VITE_DEMO_VIDEO_URL', 'https://video.example/demo')
  render(<Connecting />)
  expect(screen.getByRole('link', { name: 'Watch the demo video' }).getAttribute('href')).toBe('https://video.example/demo')
})
