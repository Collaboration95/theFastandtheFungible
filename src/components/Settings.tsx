import { useEffect, useState } from 'react'
import OwnerSettings from './OwnerSettings'
import BudgetPicker from './BudgetPicker'

export interface SettingsProps { universal: boolean; budgetMinor: number; settlement: string; notify: boolean; onBack: () => void; onUniversal: (on: boolean) => void; onBudget: (minor: number) => void; onNotify: (on: boolean) => void }

/** Settings, opened from the sidebar. A universal budget applies to every question, and Home then shows a chip instead of the slider. */
export default function Settings({ universal, budgetMinor, notify, onBack, onUniversal, onBudget, onNotify }: SettingsProps) {
  const [error, setError] = useState('')
  const audit = async (minor: number, on: boolean) => {
    const desktop = (window as unknown as { desktop?: { promptBudget(input: unknown): Promise<unknown> } }).desktop
    const body = { budgetMinor: minor, universal: on }
    try { if (desktop) await desktop.promptBudget(body); else { const headers = { 'X-Settings-UI': location.origin }; const session = await fetch('/api/settings', {headers}).then(r => r.json()); const response = await fetch('/api/settings/prompt-budget', {method:'POST',headers:{...headers,'Content-Type':'application/json','X-Settings-CSRF':session.csrf},body:JSON.stringify(body)}); if (!response.ok) throw Error() } onBudget(minor); onUniversal(on); setError('') } catch { setError('Could not audit the budget change. Retry when the local engine is ready.') }
  }
  // Escape goes back (an open popover swallows its own Escape first).
  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') onBack() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onBack])
  return <main className="ra-settings">
    <button type="button" className="ra-back" onClick={onBack}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12 4.5L6.5 10l5.5 5.5" /></svg>Back<kbd>Esc</kbd></button>
    <h1>Settings</h1>
    {error && <p role="alert">{error}</p>}
    <OwnerSettings>
    <section className="ra-set" aria-labelledby="ra-set-budget">
      <h2 id="ra-set-budget">Budget</h2>
      <label className="ra-set-row">
        <input type="checkbox" checked={universal} onChange={event => void audit(budgetMinor, event.target.checked)} />
        <span><b>Use the same budget for every question</b><small>Set the maximum each question may spend.</small></span>
      </label>
      <div className="ra-set-slider">
        <BudgetPicker value={budgetMinor} onChange={minor => void audit(minor, universal)} disabled={!universal} />

      </div>
    </section>
    <section className="ra-set" aria-labelledby="ra-set-notify">
      <h2 id="ra-set-notify">Notifications</h2>
      <label className="ra-set-row">
        <input type="checkbox" checked={notify} onChange={event => onNotify(event.target.checked)} />
        <span><b>Tell me when it’s done</b><small>A desktop notification when a run finishes in a background tab.</small></span>
      </label>
    </section>
    </OwnerSettings>
  </main>
}
