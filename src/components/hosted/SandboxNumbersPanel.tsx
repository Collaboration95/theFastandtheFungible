import { useEffect, useState } from 'react'
import type { SandboxStats } from '../../../server/hosted/stats'
import { money } from '../../../shared/presentation.js'

const fmt = (value: number | null, unit = '') => value === null ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit}`
export default function Numbers() {
  const [stats,setStats] = useState<SandboxStats>(), [error,setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const refresh = () => { void fetch('/api/demo/stats', { credentials: 'omit', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('unavailable')
      setStats(await response.json() as SandboxStats); setError(false)
    }).catch(() => { if (!controller.signal.aborted) setError(true) }) }
    refresh(); const timer = setInterval(refresh,60000)
    return () => { controller.abort(); clearInterval(timer) }
  },[])
  if (!stats) return <p role="status">{error ? 'Sandbox numbers are unavailable. Please reopen this panel to try again.' : 'Loading sandbox numbers…'}</p>
  const metrics = [
    ['Questions',fmt(stats.questions)], ['Purchase runs',fmt(stats.purchaseRuns)], ['Purchases settled',fmt(stats.purchasesSettled)], ['Refunds',fmt(stats.refunds)],
    ['Anchored',`${stats.anchored}/${stats.questions}`], ['Start → Done · median',fmt(stats.timing.medianMs === null ? null : stats.timing.medianMs/1000,' s')],
    ['Start → Done · p90',fmt(stats.timing.p90Ms === null ? null : stats.timing.p90Ms/1000,' s')], ['Spend per purchase run · median',stats.medianSpendMinor === null ? '—' : money(stats.medianSpendMinor)],
    ['Model US$ per question · median',stats.medianModelUsd === null ? '—' : `US$${stats.medianModelUsd.toFixed(4)}`],
  ]
  const audits = [
    ['Paid reads before permission',stats.audit.readBeforeGrant], ['Purchases without a policy decision in the same round',stats.audit.buyWithoutPolicy],
    ['Runs over budget',stats.audit.overBudget], ['Repeated purchase identities',stats.audit.duplicateIntent], ['Receipts without a purchase identity',stats.audit.receiptWithoutIntent], ['Finished runs without an anchor',stats.audit.unanchored],
  ]
  return <section className="ra-sandbox-panel" aria-label="Sandbox scoreboard">
    <h2>Sandbox scoreboard</h2>
    <p className="ra-sandbox-label">{stats.label}</p>
    <dl className="ra-sandbox-metrics">{metrics.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h3>Gate audit · runs with a recorded violation</h3>
    <dl className="ra-sandbox-audit">{audits.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p>{stats.audit.checked} runs with retained traces · {stats.audit.unavailable} unavailable. {stats.inProgress} in progress; {stats.anchorPending} awaiting an anchor.</p>
    <p>Started questions only. Timing includes waiting, from Start to the last Done ({stats.timing.samples} samples). Spend is gross, before refunds. Model cost is the metered estimate; unfinished calls retain their upper bound. Anchors are stored confirmations, not fresh ledger checks. This audit checks the recorded sequence, budget and purchase identities; it does not recheck citation text.</p>
    <p>{stats.excludedSimulated} simulated runs excluded. Updated {new Date(stats.updatedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT · refreshes every 60 s. No question text or visitor details are published.</p>
    {error && <p role="status">Refresh unavailable. Showing the last recorded totals.</p>}
  </section>
}
