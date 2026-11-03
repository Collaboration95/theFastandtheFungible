export class OverloadedError extends Error { constructor() { super('Engine active-work limit reached') } }
/** No queue. A release lease is idempotent and must be held through finally. */
export class ActiveWork {
  readonly controller = new AbortController()
  get signal() { return this.controller.signal }
  active = 0
  peak = 0
  constructor(readonly limit = 4) {}
  acquire() {
    if (this.signal.aborted || this.active >= this.limit) throw new OverloadedError()
    this.peak = Math.max(this.peak, ++this.active)
    let released = false
    return () => { if (!released) { released = true; this.active-- } }
  }
}
