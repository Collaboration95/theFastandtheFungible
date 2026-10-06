import { useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts/index.js'
import { getValidatedAnswer } from './Answer'
export interface ReportButtonProps { run: RunSnapshot; onReport: () => void | Promise<void>; busy?: boolean }
/** Download report. While the PDF is written the button becomes a progress pill; the page stays usable. */
export default function ReportButton({ run, onReport, busy = false }: ReportButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const available = !!getValidatedAnswer(run, [...run.answers].sort((a, b) => a.version - b.version).at(-1))
  const writing = pending || run.reportStatus === 'GENERATING'
  if (writing) return <span className="ra-progress" role="status"><span className="ra-spin" aria-hidden="true" />Writing report · findings, changes, receipts<i aria-hidden="true" /></span>
  return <>
    <button className="ra-btn ra-btn-pen" type="button" disabled={!available || busy} title={busy ? 'The report unlocks when the run ends' : undefined} onClick={async () => {
      if (!available || busy) return
      setPending(true); setError('')
      try { await onReport() } catch { setError('The report could not be downloaded. Please try again.') } finally { setPending(false) }
    }}>Download report ↓</button>
    {(error || run.reportStatus === 'FAILED') && <span className="ra-err" role="alert">{error || 'Report generation failed. You can retry.'}</span>}
  </>
}
