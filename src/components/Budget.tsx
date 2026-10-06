import { useEffect, useRef, useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts/index.js'
import { money } from '../format'

/** Money never jumps: the remaining amount counts to its new value. */
function useCount(target: number) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = from.current
    if (start === target) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const t0 = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const p = reduce ? 1 : Math.min(1, (now - t0) / 900)
      const value = Math.round(start + (target - start) * (1 - (1 - p) ** 3))
      from.current = value
      setShown(value)
      if (p < 1) frame = requestAnimationFrame(step)
    })
    return () => cancelAnimationFrame(frame)
  }, [target])
  return shown
}

export default function Budget({ run }: { run: RunSnapshot }) {
  const remaining = run.budgetMinor - run.spentMinor - run.reservedMinor
  const shown = useCount(remaining)
  const pct = (minor: number) => `${run.budgetMinor ? Math.min(100, minor / run.budgetMinor * 100) : 0}%`
  return <section className={`ra-panel ra-wallet${run.budgetMinor === 0 ? ' is-zero' : ''}`} aria-label="Prompt budget">
    <div className="ra-panel-h"><h2>Budget for this question</h2><span className="mono">cap {money(run.perSourceCapMinor)} / source</span></div>
    <div className="ra-amt"><span className="ra-odo" aria-live="polite">{money(run.budgetMinor === 0 ? 0 : shown)}</span><span className="ra-of">{run.budgetMinor === 0 ? 'nothing can be bought' : `left of ${money(run.budgetMinor)}`}</span>
      {run.reservedMinor > 0 && <span className="ra-delta">holding {money(run.reservedMinor)}</span>}</div>
    <div className="ra-meter" role="meter" aria-label="Spent plus held budget" aria-valuemin={0} aria-valuemax={run.budgetMinor} aria-valuenow={run.spentMinor + run.reservedMinor}>
      <i className="sp" style={{ width: pct(run.spentMinor) }} /><i className="rs" style={{ width: pct(run.reservedMinor) }} />
    </div>
    {run.budgetMinor === 0
      ? <p className="ra-wl">Free-only run · no purchases authorized. Decisions are still shown.</p>
      : <dl className="ra-wl"><div><dt>spent</dt><dd>{money(run.spentMinor)}</dd></div><div><dt>held</dt><dd>{money(run.reservedMinor)}</dd></div><div><dt>left</dt><dd>{money(remaining)}</dd></div></dl>}
    <p className="ra-wallet-label"><span className="ra-chip is-sim">{run.labels.settlement}</span></p>
    {remaining < 0 && <p role="alert">Budget invariant violated: spent plus reserved exceeds authorization.</p>}
  </section>
}
