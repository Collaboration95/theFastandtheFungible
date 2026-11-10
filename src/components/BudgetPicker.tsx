/** `max` (minor units) is the server's per-question cap where one applies (the hosted demo: S$2.00); locally S$5.00. */
export default function BudgetPicker({ value, onChange, disabled = false, max = 500 }: { value: number; onChange: (minor: number) => void; disabled?: boolean; max?: number }) {
  const picks = max >= 500 ? [0, 100, 200, 300, 500] : [0, 50, 100, 200].filter(amount => amount <= max)
  return <div className="ra-budget-picker"><div role="group" aria-label="Budget choices">{picks.map(amount => <button type="button" key={amount} disabled={disabled} aria-pressed={value === amount} onClick={() => onChange(amount)}>{amount ? `S$${amount / 100}` : 'Free'}</button>)}</div><label>Custom budget (S$)<input type="number" min="0" max={max / 100} step="0.05" disabled={disabled} value={value / 100} onChange={event => { const n = Number(event.target.value); if (Number.isFinite(n) && n >= 0 && n <= max / 100) onChange(Math.round(n * 20) * 5) }} /></label></div>
}
