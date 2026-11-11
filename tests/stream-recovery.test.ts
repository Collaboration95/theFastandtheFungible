import { afterEach, expect, it, vi } from 'vitest'
import { streamRun } from '../src/api.js'
import { exampleRun } from '../shared/contracts/examples.js'
import type { RunSnapshot } from '../shared/contracts/index.js'

class Source extends EventTarget {
  static instance: Source
  close = vi.fn()
  constructor(readonly url: string) { super(); Source.instance = this }
}
const run = (id: number, spent = 0, refunded = 0, phase: RunSnapshot['phase'] = 'SEARCH'): RunSnapshot => ({
  ...exampleRun, runId: 'recovery', phase, spentMinor: spent, refundedMinor: refunded,
  events: [{ id, runId: 'recovery', type: phase, label: 'fixture state', at: '2026-11-04T00:00:00Z' }],
})
const json = (value: RunSnapshot) => new Response(JSON.stringify(value))
const snapshot = (value: RunSnapshot) => Source.instance.dispatchEvent(new MessageEvent('snapshot', { data: JSON.stringify(value) }))
const disconnect = () => Source.instance.dispatchEvent(new Event('error'))
const stops: (() => void)[] = []
function start() {
  vi.useFakeTimers()
  vi.stubGlobal('EventSource', Source)
  const onSnapshot = vi.fn(), onError = vi.fn()
  stops.push(streamRun('recovery', { onSnapshot, onError, onEvent: vi.fn() }))
  return { onSnapshot, onError }
}
afterEach(() => { stops.splice(0).forEach(stop => stop()); vi.useRealTimers(); vi.unstubAllGlobals() })

it('recovers a closed stream through GET of the same run, with one request in flight', async () => {
  let resolve!: (response: Response) => void
  const transport = vi.fn(() => new Promise<Response>(done => { resolve = done }))
  vi.stubGlobal('fetch', transport)
  const { onSnapshot } = start()
  disconnect(); disconnect()
  expect(transport).toHaveBeenCalledTimes(1)
  resolve(json(run(2, 60, 0, 'DONE')))
  await vi.advanceTimersByTimeAsync(0)
  expect(onSnapshot).toHaveBeenCalledWith(run(2, 60, 0, 'DONE'))
  expect(transport).toHaveBeenCalledWith('/runs/recovery', expect.objectContaining({ method: 'GET' }))
  expect(Source.instance.close).toHaveBeenCalledTimes(1)
})
it('resynchronizes a silent stream and retries a failed GET without admitting work', async () => {
  const transport = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json(run(3, 60, 0, 'DONE')))
  vi.stubGlobal('fetch', transport)
  const { onSnapshot, onError } = start()
  await vi.advanceTimersByTimeAsync(5000)
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Run resynchronization failed; retrying the same run' }))
  await vi.advanceTimersByTimeAsync(5000)
  expect(onSnapshot).toHaveBeenCalledWith(run(3, 60, 0, 'DONE'))
  expect(transport.mock.calls.every(([path, init]) => path === '/runs/recovery' && init.method === 'GET')).toBe(true)
})
it('rejects an older GET arriving after SSE and never rolls back charges or refunds', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done })))
  const { onSnapshot } = start()
  snapshot(run(1))
  disconnect()
  snapshot(run(2, 100, 30))
  resolve(json(run(1)))
  await vi.advanceTimersByTimeAsync(0)
  snapshot(run(2, 0, 0))
  snapshot(run(2, 100, 0))
  expect(onSnapshot).toHaveBeenCalledTimes(2)
  expect(onSnapshot).toHaveBeenLastCalledWith(run(2, 100, 30))
})
it('ignores another run and a GET completed after unsubscribe', async () => {
  let resolve!: (response: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done })))
  const { onSnapshot } = start()
  snapshot({ ...run(1), runId: 'another' })
  disconnect()
  stops[0]()
  resolve(json(run(2, 60, 0, 'DONE')))
  await vi.advanceTimersByTimeAsync(0)
  expect(onSnapshot).not.toHaveBeenCalled()
})

it('preserves receipt provenance and rejects an older nonterminal money view', () => {
  vi.stubGlobal('fetch', vi.fn())
  const { onSnapshot } = start()
  const paid = { ...run(4, 60), receipts: [{
    receiptId: 'receipt', intentId: 'intent', runId: 'recovery', resourceId: 'fixture', version: 'v1',
    amountMinor: 60, currency: 'SGD' as const, settledAt: '', label: exampleRun.labels.settlement,
  }] }
  snapshot(paid)
  snapshot(run(4, 60))
  snapshot({ ...paid, phase: 'DONE' })
  snapshot(paid)
  expect(onSnapshot).toHaveBeenCalledTimes(2)
  expect(onSnapshot).toHaveBeenLastCalledWith({ ...paid, phase: 'DONE' })
})
it('does not accept a GET for another identity and can resynchronize again', async () => {
  const transport = vi.fn().mockResolvedValueOnce(json({ ...run(2), runId: 'another' })).mockResolvedValueOnce(json(run(3, 60, 0, 'DONE')))
  vi.stubGlobal('fetch', transport)
  const { onSnapshot } = start()
  disconnect()
  await vi.advanceTimersByTimeAsync(0)
  expect(onSnapshot).not.toHaveBeenCalled()
  disconnect()
  await vi.advanceTimersByTimeAsync(0)
  expect(onSnapshot).toHaveBeenCalledWith(run(3, 60, 0, 'DONE'))
})

it('retries the same durable GET after an SSE close plus HTTP 503, without starting or charging another run', async () => {
  const final = run(5, 90, 0, 'DONE')
  const transport = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'paused' }), { status: 503 })).mockResolvedValueOnce(json(final))
  vi.stubGlobal('fetch', transport)
  const { onSnapshot, onError } = start()
  disconnect()
  await vi.advanceTimersByTimeAsync(0)
  expect(onError).toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(5000)
  expect(onSnapshot).toHaveBeenLastCalledWith(final)
  expect(transport).toHaveBeenCalledTimes(2)
  expect(transport.mock.calls.every(([path, init]) => path === '/runs/recovery' && init.method === 'GET')).toBe(true)
  expect(Source.instance.close).toHaveBeenCalledTimes(1)
})
