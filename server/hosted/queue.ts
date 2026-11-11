import { HostedError, requireAdmissions } from './control.js'
import type { Config } from '../config.js'
import { LIMITS } from './limits.js'
type Entry = { id: string; at: number; run: () => Promise<void>; expire: () => void }
export class HostedQueue {
  private active?: string
  private waiting: Entry[] = []
  private timer: ReturnType<typeof setInterval>
  constructor(private config: Config, private now: () => number = Date.now) { this.timer = setInterval(() => this.tick(), 250); this.timer.unref() }
  get canQueue() { return !this.active || this.waiting.length < LIMITS.waiting }
  get busy() { return Boolean(this.active) }
  /** Questions ahead of a new one: the one running plus those waiting. */
  get depth() { return (this.active ? 1 : 0) + this.waiting.length }
  capacity() { this.tick(); if (this.active && this.waiting.length >= LIMITS.waiting) throw new HostedError(429, 'queue_full') }
  enqueue(id: string, run: () => Promise<void>, expire: () => void) {
    requireAdmissions(this.config, this.now()); this.capacity()
    const entry = { id, run, expire, at: this.now() }
    if (!this.active) this.start(entry); else this.waiting.push(entry)
  }
  position(id: string) { return this.active === id ? 0 : this.waiting.findIndex(e => e.id === id) + 1 || null }
  cancel(id: string) { const i = this.waiting.findIndex(e => e.id === id); if (i >= 0) { this.waiting.splice(i, 1)[0].expire(); return true } return false }
  private start(entry: Entry) { this.active = entry.id; void Promise.resolve().then(entry.run).catch(() => undefined).finally(() => { this.active = undefined; this.tick() }) }
  tick() {
    const entries = this.waiting.splice(0)
    for (const e of entries) {
      try { requireAdmissions(this.config, this.now()); if (this.now() - e.at >= LIMITS.queueMs) throw new Error('expired'); this.waiting.push(e) } catch { e.expire() }
    }
    if (!this.active && this.waiting.length) this.start(this.waiting.shift()!)
  }
  close() { clearInterval(this.timer); for (const e of this.waiting.splice(0)) e.expire() }
}
