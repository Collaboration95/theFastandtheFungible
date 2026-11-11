import { useEffect, useState } from 'react'
import { lazy, Suspense } from 'react'
import Icon from './Icon'
const OwnerSettings = lazy(() => import('./OwnerSettings'))
import BudgetPicker from './BudgetPicker'

export interface SettingsProps { universal: boolean; budgetMinor: number; settlement: string; notify: boolean; onBack: () => void; onUniversal: (on: boolean) => void; onBudget: (minor: number) => void; onNotify: (on: boolean) => void }

/** Settings, opened from the sidebar. A universal budget applies to every question, and Home then shows a chip instead of the slider. */
export default function Settings({ universal, budgetMinor, notify, onBack, onUniversal, onBudget, onNotify }: SettingsProps) {
  const replay = import.meta.env.MODE === 'browser-demo'
  const [error, setError] = useState('')
  const audit = async (minor: number, on: boolean) => {
    const desktop = (window as unknown as { desktop?: { promptBudget(input: unknown): Promise<unknown> } }).desktop
    const body = { budgetMinor: minor, universal: on }
    try { if (desktop) await desktop.promptBudget(body); else { const headers = { 'X-Settings-UI': location.origin }; const session = await fetch('/api/settings', {headers}).then(r => r.json()); const response = await fetch('/api/settings/prompt-budget', {method:'POST',headers:{...headers,'Content-Type':'application/json','X-Settings-CSRF':session.csrf},body:JSON.stringify(body)}); if (!response.ok) throw Error() } onBudget(minor); onUniversal(on); setError('') } catch { setError('Couldn’t save the default budget. Check the server connection and try again.') }
  }
  // Escape goes back (an open popover swallows its own Escape first).
  useEffect(() => {
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)) onBack() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onBack])
  return <main id="main" tabIndex={-1} className="ra-settings">
    <button type="button" className="ra-back" onClick={onBack}><Icon name="left" />Back<kbd>Esc</kbd></button>
    <h1>Settings</h1>
    {error && <p role="alert">{error}</p>}
    {replay ? <section className="ra-set" aria-label="Replay preferences"><h2>About this replay</h2><p>This is a recorded run. No new questions are sent and no money moves.</p><p>Use the scenario links to switch recordings and Pause to stop playback. Your device’s reduced-motion preference is respected.</p><p>Owner settings are available in the local or desktop app.</p></section> : <Suspense fallback={<p role="status">Loading settings…</p>}><OwnerSettings notifications={<section className="ra-set" aria-labelledby="ra-set-notify">
      <h2 id="ra-set-notify">Notifications</h2>
      <label className="ra-set-row">
        <input type="checkbox" checked={notify} onChange={event => onNotify(event.target.checked)} />
        <span><b>Tell me when it’s done</b><small>A desktop notification when a run finishes in a background tab.</small></span>
      </label>
    </section>}>
    <section className="ra-set" aria-labelledby="ra-set-budget">
      <h3 id="ra-set-budget">Default budget</h3>
      <label className="ra-set-row">
        <input type="checkbox" checked={universal} onChange={event => void audit(budgetMinor, event.target.checked)} />
        <span><b>Use the same budget for every question</b><small>Set the maximum each question may spend.</small></span>
      </label>
      <div className="ra-set-slider">
        <BudgetPicker value={budgetMinor} onChange={minor => void audit(minor, universal)} disabled={!universal} />

      </div>
    </section>

    </OwnerSettings></Suspense>}
  </main>
}
