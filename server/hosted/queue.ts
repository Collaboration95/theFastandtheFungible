import { HostedError, requireAdmissions } from './control.js'
import type { Config } from '../config.js'
import { LIMITS } from './limits.js'
type Entry = { id: string; at: number; run: () => Promise<void>; expire: () => void }
/** How many finished jobs the wait estimate remembers, and the least it ever promises for a job already running. */
const RECENT = 10, MIN_REMAINING_MS = 10000
export class HostedQueue {
  private active?: string
  private activeSince = 0
  private recent: number[] = []
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
  /**
   * An honest estimate, in seconds rounded up to 5, of how long until the job at `position` (0 running, 1 first waiting) starts:
   * what is left of the running job plus one typical run (the median of the last ten) for each job ahead. None until a run
   * has finished here, because there is nothing to base a number on (H7).
   */
  estimateSeconds(position = this.waiting.length + 1): number | undefined {
    if (!this.recent.length) return undefined
    if (!this.active && position <= 1) return 0
    const sorted = [...this.recent].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
    const typical = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
    const remaining = this.active ? Math.max(typical - (this.now() - this.activeSince), MIN_REMAINING_MS) : 0
    const ms = position <= 0 ? 0 : remaining + (position - 1) * typical
    return Math.ceil(ms / 5000) * 5
  }
  position(id: string) { return this.active === id ? 0 : this.waiting.findIndex(e => e.id === id) + 1 || null }
  cancel(id: string) { const i = this.waiting.findIndex(e => e.id === id); if (i >= 0) { this.waiting.splice(i, 1)[0].expire(); return true } return false }
  private start(entry: Entry) {
    this.active = entry.id; this.activeSince = this.now()
    void Promise.resolve().then(entry.run).catch(() => undefined).finally(() => {
      this.recent = [...this.recent, this.now() - this.activeSince].slice(-RECENT)
      this.active = undefined; this.tick()
    })
  }
  tick() {
    const entries = this.waiting.splice(0)
    for (const e of entries) {
      try { requireAdmissions(this.config, this.now()); if (this.now() - e.at >= LIMITS.queueMs) throw new Error('expired'); this.waiting.push(e) } catch { e.expire() }
    }
    if (!this.active && this.waiting.length) this.start(this.waiting.shift()!)
  }
  close() { clearInterval(this.timer); for (const e of this.waiting.splice(0)) e.expire() }
}

/** Planning is bounded separately from runs (H7): two plans at once, a short wait for the next, then "busy". */
export const PLANNING = { concurrent: 2, waiting: 6, waitMs: 20000 } as const
/**
 * Planning is one model call that moves no money, so it does not wait for the one running question. Only a question's start
 * queues. The model-dollar caps still apply to the plan through its hold; this only bounds how many plans run at the same time.
 */
export class HostedPlanLane {
  private running = 0
  private closed = false
  private waiting: { resolve: () => void; reject: (error: HostedError) => void; timer: ReturnType<typeof setTimeout> }[] = []
  constructor(private readonly limits: { concurrent: number; waiting: number; waitMs: number } = PLANNING) {}
  get depth() { return this.running + this.waiting.length }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.closed) throw new HostedError(503, 'demo_unavailable')
    if (this.running >= this.limits.concurrent) {
      if (this.waiting.length >= this.limits.waiting) throw new HostedError(429, 'busy')
      await new Promise<void>((resolve, reject) => {
        const entry = { resolve, reject, timer: setTimeout(() => { this.waiting.splice(this.waiting.indexOf(entry), 1); reject(new HostedError(429, 'busy')) }, this.limits.waitMs) }
        this.waiting.push(entry)
      })
    } else this.running++
    try { return await fn() } finally {
      const next = this.waiting.shift()
      if (next) { clearTimeout(next.timer); next.resolve() } else this.running--
    }
  }
  close() {
    this.closed = true
    for (const entry of this.waiting.splice(0)) { clearTimeout(entry.timer); entry.reject(new HostedError(503, 'demo_unavailable')) }
  }
}
