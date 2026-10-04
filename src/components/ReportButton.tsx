import { useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts/index.js'
import { getValidatedAnswer } from './Answer'
export interface ReportButtonProps { run: RunSnapshot; onReport: () => void | Promise<void>; busy?: boolean }
export default function ReportButton({ run, onReport, busy = false }: ReportButtonProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const available = !!getValidatedAnswer(run, [...run.answers].sort((a, b) => a.version - b.version).at(-1))
  const working = busy || pending || run.reportStatus === 'GENERATING'
  return <div className="ra-report"><button className="ra-button" type="button" disabled={!available || working} onClick={async () => {
    if (!available || working) return
    setPending(true); setError('')
    try { await onReport() } catch { setError('The report could not be downloaded. Please try again.') } finally { setPending(false) }
  }}>{working ? 'Preparing report…' : 'Download report ↓'}</button>
    <p className="ra-muted">{!available ? 'Available after the first verified answer.' : run.reportStatus === 'HTML' ? 'HTML report available · use Print to save as PDF.' : 'Findings, exact citations, purchase impact and receipts.'}</p>
    {(error || run.reportStatus === 'FAILED') && <p className="ra-error" role="alert">{error || 'Report generation failed. You can retry.'}</p>}
  </div>
}
