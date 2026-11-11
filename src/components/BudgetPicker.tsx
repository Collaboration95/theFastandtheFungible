import { BUDGET } from '../../shared/contracts'
import { money } from '../../shared/presentation'
/** `max` (minor units) is the server's per-question cap where one applies (the hosted demo: S$2.00); locally S$5.00. */
export default function BudgetPicker({ value, onChange, disabled = false, max = BUDGET.maxMinor }: { value: number; onChange: (minor: number) => void; disabled?: boolean; max?: number }) {
  const fractions = max >= BUDGET.maxMinor ? [0, 0.2, 0.4, 0.6, 1] : [0, 0.25, 0.5, 1]
  const picks = [...new Set(fractions.map(fraction => Math.round(max * fraction / BUDGET.stepMinor) * BUDGET.stepMinor))].filter(amount => amount <= max)
  return <div className="ra-budget-picker"><div role="group" aria-label="Budget choices">{picks.map(amount => <button type="button" key={amount} disabled={disabled} aria-pressed={value === amount} onClick={() => onChange(amount)}>{amount ? money(amount) : 'Free'}</button>)}</div><label>Custom budget (S$)<input type="number" min="0" max={max / 100} step="0.05" disabled={disabled} value={value / 100} onChange={event => { const n = Number(event.target.value); if (Number.isFinite(n) && n >= 0 && n <= max / 100) onChange(Math.round(n * 20) * 5) }} /></label></div>
}
