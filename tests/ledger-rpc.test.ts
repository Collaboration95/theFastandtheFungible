import { afterEach, expect, it, vi } from 'vitest'
import { publicRead, PUBLIC_LEDGER_ENDPOINTS } from '../src/ledger-rpc'
afterEach(() => vi.unstubAllGlobals())
it('only sends an allowed read and closes its socket after a result', async () => {
  const sent: Record<string, unknown>[] = [], closed: string[] = []
  class Socket {
    onopen?: () => void; onmessage?: (e: { data: string }) => void
    constructor(public url: string) { queueMicrotask(() => this.onopen?.()) }
    send(value: string) { const r = JSON.parse(value); sent.push(r); queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id: r.id, status: 'success', result: { validated: true, ledger_index: 42 } }) })) }
    close() { closed.push(this.url) }
  }
  vi.stubGlobal('WebSocket', Socket)
  expect(await publicRead({ command: 'account_info', ledger_index: 'validated' })).toEqual({ validated: true, ledger_index: 42 })
  expect(sent).toEqual([{ command: 'account_info', ledger_index: 'validated', id: 'read-only' }])
  expect(closed).toEqual([PUBLIC_LEDGER_ENDPOINTS[0]])
})
it('falls back on an RPC error and closes both sockets, without new endpoints', async () => {
  const closed: string[] = []
  class Socket {
    onopen?: () => void; onmessage?: (e: { data: string }) => void
    constructor(public url: string) { queueMicrotask(() => this.onopen?.()) }
    send(value: string) {
      const { id } = JSON.parse(value)
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify(this.url === PUBLIC_LEDGER_ENDPOINTS[0] ? { id, status: 'error', error: 'lgrNotFound' } : { id, status: 'success', result: { found: true } }) }))
    }
    close() { closed.push(this.url) }
  }
  vi.stubGlobal('WebSocket', Socket)
  expect(await publicRead({ command: 'tx' })).toEqual({ found: true })
  expect(closed).toEqual(PUBLIC_LEDGER_ENDPOINTS)
})
it('bounds stalled reads and cleans up both sockets', async () => {
  vi.useFakeTimers()
  let closed = 0
  class Socket { close() { closed++ } }
  vi.stubGlobal('WebSocket', Socket)
  try {
    const outcome = expect(publicRead({ command: 'ledger_entry' })).rejects.toThrow('Public ledger unavailable')
    await vi.runAllTimersAsync(); await outcome
    expect(closed).toBe(2)
  } finally { vi.useRealTimers() }
})
