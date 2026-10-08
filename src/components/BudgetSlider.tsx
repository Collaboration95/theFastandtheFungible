import { useId, type CSSProperties } from 'react'
import { BUDGET } from '../../shared/contracts/index.js'
import { money } from '../format'

export interface BudgetSliderProps { value: number; onChange: (minor: number) => void; disabled?: boolean; label?: string }

/** The per-question budget: S$0 to S$5 in 5-cent steps (articles cost from S$0.05). The per-source cap shows on hover. */
export default function BudgetSlider({ value, onChange, disabled = false, label = 'Budget' }: BudgetSliderProps) {
  const id = useId()
  const shown = value === 0 ? 'Free' : money(value)
  return <div className={`ra-slider${disabled ? ' is-off' : ''}`}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="range" min={0} max={BUDGET.maxMinor} step={BUDGET.stepMinor} value={value} disabled={disabled}
      onChange={event => onChange(Number(event.target.value))} aria-valuetext={value === 0 ? 'Free sources only' : shown}
      title={`At most ${money(BUDGET.capMinor)} per source`} style={{ '--fill': `${(value / BUDGET.maxMinor) * 100}%` } as CSSProperties} />
    <output htmlFor={id} aria-live="polite">{shown}</output>
  </div>
}
