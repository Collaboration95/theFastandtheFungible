import Icon from './Icon'
import { useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts/index.js'
import { getValidatedAnswer } from './Answer'
import { saveReceipts } from '../download'
import { useHosted } from '../hosted'
export interface ReportButtonProps { run: RunSnapshot; onReport: () => void | Promise<void>; busy?: boolean; onCompare?: () => void }
/** Download report. While the PDF is written the button becomes a progress pill; the page stays usable. */
export default function ReportButton({ run, onReport, busy = false, onCompare }: ReportButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  // Hosted: no PDF generation, and a run link opens only in this visitor's browser, so neither is offered.
  const hosted = !!useHosted()
  const available = !!getValidatedAnswer(run, [...run.answers].sort((a, b) => a.version - b.version).at(-1))
  const writing = pending || run.reportStatus === 'GENERATING'
  if (writing) return <span className="ra-progress" role="status"><span className="ra-spin" aria-hidden="true" />Preparing report…</span>
  if ((!available && run.phase !== 'DONE') || busy) return null
  return <details className="ra-export"><summary>Export <Icon name="down" size={16} /></summary><div role="group" aria-label="Export actions">
    {import.meta.env.MODE !== 'browser-demo' && !hosted && <button className="ra-btn ra-btn-pen" type="button" disabled={!available || busy} title={busy ? 'The report unlocks when the run ends' : undefined} onClick={async () => {
      if (!available || busy) return
      setPending(true); setError('')
      try { await onReport() } catch { setError('Couldn’t download the report. Try again.') } finally { setPending(false) }
    }}>Export report</button>}
    <button type="button" className="ra-btn" onClick={() => { setError(''); saveReceipts(run.runId).catch(() => setError('Couldn’t download receipts.json. Try again.')) }}>Download receipts.json</button>
    <small>Check these receipts yourself: <code>researchagent verify receipts.json --ledger</code></small>
    {run.answers.length > 1 && <button type="button" className="ra-btn" onClick={onCompare}>See what changed after the purchase</button>}
    {!hosted && <button type="button" className="ra-btn" onClick={async () => { setCopied(false); setError(''); try { await navigator.clipboard.writeText(window.location.href); setCopied(true) } catch { setError('Couldn’t copy the link. Try again.') } }}>{copied ? 'Link copied' : 'Copy link'}</button>}
    {copied && <span role="status">Link copied</span>}
    {(error || run.reportStatus === 'FAILED') && <span className="ra-err" role="alert">{error || 'Couldn’t create the report. Try again.'}</span>}
  </div></details>
}
