import { useId, type CSSProperties } from 'react'
import { BUDGET } from '../../shared/contracts/index.js'
import { money } from '../format'
import Roll from './Roll'

export interface BudgetSliderProps { value: number; onChange: (minor: number) => void; disabled?: boolean; label?: string; stops?: boolean }

/** The tick marks (also drawn in the track by styles.css, which hard-codes the same fractions). */
const STOPS = [0, 100, 200, 300, 500] as const

/** The per-question budget: S$0 to S$5 in 5-cent steps (articles cost from S$0.05). A notched track with a grab handle; `stops` adds the labelled quick picks. */
export default function BudgetSlider({ value, onChange, disabled = false, label = 'Budget', stops = false }: BudgetSliderProps) {
  const id = useId()
  const shown = value === 0 ? 'Free' : money(value)
  return <div className={`ra-slider${disabled ? ' is-off' : ''}${stops ? ' has-stops' : ''}`} style={{ '--p': value / BUDGET.maxMinor } as CSSProperties}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="range" min={0} max={BUDGET.maxMinor} step={BUDGET.stepMinor} value={value} disabled={disabled}
      onChange={event => onChange(Number(event.target.value))} aria-valuetext={value === 0 ? 'Free sources only' : shown}
      title={`At most ${money(BUDGET.capMinor)} per source`} />
    <output htmlFor={id} aria-live="polite">{value === 0 ? shown : <Roll text={shown} />}</output>
    {stops && <div className="ra-stops" role="group" aria-label="Quick picks">{STOPS.map(stop => <button key={stop} type="button" className={stop === value ? 'is-on' : ''} disabled={disabled} aria-pressed={stop === value}
      style={{ '--at': stop / BUDGET.maxMinor } as CSSProperties} onClick={() => onChange(stop)}>{stop === 0 ? 'Free' : money(stop)}{stop === BUDGET.initialMinor && <small>Default</small>}</button>)}</div>}
  </div>
}
