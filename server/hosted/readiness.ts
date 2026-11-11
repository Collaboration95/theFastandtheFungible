/**
 * Hosted readiness, refreshed in the background (H7).
 *
 * The readiness probe reads the writer registry and two XRPL Testnet ledgers (a US node from Singapore: about 0.4 s,
 * sometimes over 1.5 s). H6 showed that doing this inside a visitor's `/api/demo/status` made that visitor wait for
 * it. Here the probe runs on its own timer and every request reads the last answer from memory.
 *
 * Staleness bound. An answer is used only while the check that produced it started at most `maxAgeMs` (15 s) ago.
 * The check starts every `intervalMs` (5 s, start to start) and is cut off after `probeTimeoutMs` (6 s, counted as
 * not ready), so in steady state an answer rests on a check that began 5 to 11 s ago. If the timer itself stops
 * (a starved event loop), answers turn into "not ready" after 15 s: this fails closed, it never serves an old yes.
 * A probe that runs long fails readiness after 6 s; another starts only once that underlying call settles. A timeout
 * cannot cancel an arbitrary probe, so retrying it while it is still running would accumulate ledger requests.
 * Before H7 the answer was at most 5 s old but the request that found it expired paid for the refresh.
 *
 * What this does not decide: pauses, the admission window, the money caps and the spending guard are read fresh at
 * every authority boundary (`requireAdmissions`, `requireSpending`, `HostedLimits.reserve`), never from this cache.
 */
export type ReadinessOptions = { intervalMs?: number; maxAgeMs?: number; probeTimeoutMs?: number; now?: () => number }
export const READINESS = { intervalMs: 5000, maxAgeMs: 15000, probeTimeoutMs: 6000 } as const
export class HostedReadiness {
  private healthy = false
  /** When the check behind `healthy` started; -Infinity until the first one finishes. */
  private startedAt = Number.NEGATIVE_INFINITY
  private timer?: ReturnType<typeof setTimeout>
  private closed = false
  private probeInFlight = false
  private readonly intervalMs: number
  private readonly maxAgeMs: number
  private readonly probeTimeoutMs: number
  private readonly now: () => number
  constructor(private readonly probe: () => Promise<boolean>, options: ReadinessOptions = {}) {
    this.intervalMs = options.intervalMs ?? READINESS.intervalMs
    this.maxAgeMs = options.maxAgeMs ?? READINESS.maxAgeMs
    this.probeTimeoutMs = options.probeTimeoutMs ?? READINESS.probeTimeoutMs
    this.now = options.now ?? (() => Date.now())
    void this.refresh()
  }
  /** The last answer, if recent enough. Never starts or waits for a probe; cold startup is not ready. */
  ready(): Promise<boolean> {
    return Promise.resolve(this.fresh())
  }
  private fresh() { return !this.closed && this.healthy && this.now() - this.startedAt <= this.maxAgeMs }
  private async refresh(): Promise<void> {
    const startedAt = this.now()
    let value: boolean, cut: ReturnType<typeof setTimeout> | undefined
    try {
      if (this.probeInFlight) value = false
      else {
        this.probeInFlight = true
        value = await Promise.race([
          Promise.resolve().then(this.probe).finally(() => { this.probeInFlight = false }),
          new Promise<false>(resolve => { cut = setTimeout(() => resolve(false), this.probeTimeoutMs); cut.unref?.() }),
        ]) === true
      }
    } catch { value = false } finally { clearTimeout(cut) }
    if (this.closed) return
    this.healthy = value
    this.startedAt = startedAt
    this.timer = setTimeout(() => { void this.refresh() }, Math.max(Math.min(1000, this.intervalMs), this.intervalMs - (this.now() - startedAt)))
    this.timer.unref?.()
  }
  close() { this.closed = true; clearTimeout(this.timer) }
}

/**
 * The shared payer's balance, as the readiness probe last saw it (H7, J7). An alert, not a gate: below 30 XRP the owner is
 * emailed through the existing uptime-check path, while visitors see nothing different (readiness still fails only at the
 * real shortfall). It reads the probe's own ledger result, so it adds no ledger call.
 */
export const PAYER_LOW_DROPS = 30_000_000
export type PayerFunds = 'ok' | 'low' | 'unknown'
export class PayerWatch {
  private seen?: { drops: number; at: number }
  constructor(private readonly now: () => number = () => Date.now(), private readonly maxAgeMs = 120000) {}
  record(drops: number) { if (Number.isFinite(drops) && drops >= 0) this.seen = { drops, at: this.now() } }
  /** `unknown` (not `low`) when there is no recent reading, so a ledger outage alerts through readiness, not twice. */
  state(): PayerFunds { return !this.seen || this.now() - this.seen.at > this.maxAgeMs ? 'unknown' : this.seen.drops < PAYER_LOW_DROPS ? 'low' : 'ok' }
}
