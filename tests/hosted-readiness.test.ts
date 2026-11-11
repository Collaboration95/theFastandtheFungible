import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HostedReadiness, READINESS } from '../server/hosted/readiness.js'

// H7: hosted readiness is probed in the background; a request reads the last answer and never waits for a probe.
beforeEach(() => { vi.useFakeTimers({ now: Date.parse('2026-11-11T12:00:00Z') }) })
const open: HostedReadiness[] = []
afterEach(() => { for (const r of open.splice(0)) r.close(); vi.useRealTimers() })
const make = (probe: () => Promise<boolean>, options?: ConstructorParameters<typeof HostedReadiness>[1]) => { const r = new HostedReadiness(probe, options); open.push(r); return r }
const deferred = () => { let resolve!: (v: boolean) => void; const promise = new Promise<boolean>(r => { resolve = r }); return { promise, resolve } }

it('answers from memory while a refresh is still running, and never starts a probe itself', async () => {
  const slow = deferred(), probe = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(true).mockReturnValueOnce(slow.promise)
  const readiness = make(probe)
  await vi.advanceTimersByTimeAsync(0)
  expect(probe).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(READINESS.intervalMs)
  expect(probe).toHaveBeenCalledTimes(2) // the second refresh is now in flight, as a slow Testnet round trip would be
  // 50 requests while it runs: each resolves at once (a request that waited on the probe would hang here) with the last answer.
  const answers = await Promise.all(Array.from({ length: 50 }, () => readiness.ready()))
  expect(answers).toEqual(Array(50).fill(true))
  expect(probe).toHaveBeenCalledTimes(2)
  slow.resolve(true)
  await vi.advanceTimersByTimeAsync(0)
  expect(await readiness.ready()).toBe(true)
})

it('makes only the very first request wait, for the first probe', async () => {
  const first = deferred(), readiness = make(() => first.promise)
  let settled = false
  const pending = readiness.ready().then(v => { settled = true; return v })
  await vi.advanceTimersByTimeAsync(1000)
  expect(settled).toBe(false)
  first.resolve(true)
  expect(await pending).toBe(true)
})

it('refuses as soon as a refresh says not ready or fails, and recovers on the next good one', async () => {
  const answers: (boolean | Error)[] = [true, false, true, new Error('ledger down'), true]
  const readiness = make(async () => { const next = answers.shift()!; if (next instanceof Error) throw next; return next })
  const seen: boolean[] = []
  for (let i = 0; i < 5; i++) { await vi.advanceTimersByTimeAsync(i ? READINESS.intervalMs : 0); seen.push(await readiness.ready()) }
  expect(seen).toEqual([true, false, true, false, true])
})

it('starts a refresh every 5 s from the start of the last one, never overlapping', async () => {
  const starts: number[] = []
  let running = 0, overlapped = false
  const readiness = make(async () => {
    starts.push(Date.now()); if (running++) overlapped = true
    await new Promise(r => setTimeout(r, 1900)); running--; return true
  })
  await vi.advanceTimersByTimeAsync(5 * READINESS.intervalMs + 100)
  expect(overlapped).toBe(false)
  expect(starts.slice(1).map((t, i) => t - starts[i])).toEqual(Array(starts.length - 1).fill(READINESS.intervalMs))
  expect(await readiness.ready()).toBe(true)
})

it('counts a hung probe as not ready after 6 s, never overlaps it, and recovers after it settles', async () => {
  let calls = 0
  const hung = deferred()
  const readiness = make(() => ++calls === 2 ? hung.promise : Promise.resolve(true))
  await vi.advanceTimersByTimeAsync(0)
  expect(await readiness.ready()).toBe(true)
  await vi.advanceTimersByTimeAsync(READINESS.intervalMs + READINESS.probeTimeoutMs)
  expect(await readiness.ready()).toBe(false)
  await vi.advanceTimersByTimeAsync(10 * READINESS.intervalMs)
  expect(calls).toBe(2)
  expect(await readiness.ready()).toBe(false)
  hung.resolve(true)
  await vi.advanceTimersByTimeAsync(READINESS.intervalMs)
  expect(calls).toBe(3)
  expect(await readiness.ready()).toBe(true)
})

it('fails closed when the answer is older than 15 s because the timer stopped', async () => {
  const readiness = make(async () => true)
  await vi.advanceTimersByTimeAsync(0)
  expect(await readiness.ready()).toBe(true)
  // The clock moves but no timer fires (a starved event loop): the answer expires instead of being served forever.
  vi.setSystemTime(Date.now() + READINESS.maxAgeMs)
  expect(await readiness.ready()).toBe(true)
  vi.setSystemTime(Date.now() + 1)
  expect(await readiness.ready()).toBe(false)
})

it('stops probing once closed', async () => {
  const probe = vi.fn(async () => true), readiness = make(probe)
  await vi.advanceTimersByTimeAsync(0)
  readiness.close()
  await vi.advanceTimersByTimeAsync(10 * READINESS.intervalMs)
  expect(probe).toHaveBeenCalledTimes(1)
  expect(await readiness.ready()).toBe(false) // nothing refreshes it any more, so the last yes has expired
})
