import { useEffect } from 'react'
import BudgetSlider from './BudgetSlider'
import InfoDot from './InfoDot'

export interface SettingsProps { universal: boolean; budgetMinor: number; settlement: string; notify: boolean; onBack: () => void; onUniversal: (on: boolean) => void; onBudget: (minor: number) => void; onNotify: (on: boolean) => void }

/** Settings, opened from the sidebar. A universal budget applies to every question, and Home then shows a chip instead of the slider. */
export default function Settings({ universal, budgetMinor, settlement, notify, onBack, onUniversal, onBudget, onNotify }: SettingsProps) {
  // Escape goes back (an open popover swallows its own Escape first).
  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') onBack() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onBack])
  return <main className="ra-settings">
    <button type="button" className="ra-back" onClick={onBack}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4.5L6.5 10l5.5 5.5" /></svg>Back<kbd>Esc</kbd></button>
    <h1>Settings</h1>
    <section className="ra-set" aria-labelledby="ra-set-budget">
      <h2 id="ra-set-budget">Budget</h2>
      <label className="ra-set-row">
        <input type="checkbox" checked={universal} onChange={event => onUniversal(event.target.checked)} />
        <span><b>Universal budget per query</b><small>Every question uses this budget. Home hides the slider.</small></span>
      </label>
      <div className="ra-set-slider">
        <BudgetSlider value={budgetMinor} onChange={onBudget} disabled={!universal} label="Per query" stops />
        <InfoDot label={settlement} />
      </div>
    </section>
    <section className="ra-set" aria-labelledby="ra-set-notify">
      <h2 id="ra-set-notify">Notifications</h2>
      <label className="ra-set-row">
        <input type="checkbox" checked={notify} onChange={event => onNotify(event.target.checked)} />
        <span><b>Tell me when it’s done</b><small>A desktop notification when a run finishes in a background tab.</small></span>
      </label>
    </section>
  </main>
}
