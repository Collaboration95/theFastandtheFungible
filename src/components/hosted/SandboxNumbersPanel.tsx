import { useEffect, useState } from 'react'
import type { SandboxStats } from '../../../server/hosted/stats'
import { money, whenSGT } from '../../../shared/presentation.js'

const fmt = (value: number | null, unit = '') => value === null ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}${unit}`
export default function Numbers({ compact = false }: { compact?: boolean }) {
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
  const all = stats.all ?? stats, external = stats.external
  const headline = external && external.questions > 0 ? external : all
  const metrics = [
    ['Questions',fmt(headline.questions)], ['Purchase runs',fmt(headline.purchaseRuns)], ['Purchases settled',fmt(headline.purchasesSettled)], ['Refunds',fmt(headline.refunds)],
    ['Anchored',`${headline.anchored}/${headline.questions}`], ['Start → Done · median',fmt(headline.timing.medianMs === null ? null : headline.timing.medianMs/1000,' s')],
    ['Start → Done · p90',fmt(headline.timing.p90Ms === null ? null : headline.timing.p90Ms/1000,' s')], ['Spend per purchase run · median',headline.medianSpendMinor === null ? '—' : money(headline.medianSpendMinor)],
    ['Model US$ per question · median',headline.medianModelUsd === null ? '—' : headline.medianModelUsd.toFixed(4)],
  ]
  const audits = [
    ['Paid reads before permission',stats.audit.readBeforeGrant], ['Purchases without a policy decision in the same round',stats.audit.buyWithoutPolicy],
    ['Runs over budget',stats.audit.overBudget], ['Repeated purchase identities',stats.audit.duplicateIntent], ['Receipts without a purchase identity',stats.audit.receiptWithoutIntent], ['Finished runs without an anchor',stats.audit.unanchored],
  ]
  if (compact) return <section className="ra-sandbox-panel" aria-label="Sandbox scoreboard">
    <p className="ra-sandbox-label">{external && external.questions > 0 ? 'External visitors since 11 Nov' : 'All runs since 11 Nov, including internal tests'}</p>
    <dl className="ra-sandbox-metrics">{metrics.slice(0,4).map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <details><summary>Recorded gate audit · all runs</summary><dl className="ra-sandbox-audit">{audits.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{stats.stoppedBeforeAnswer} stopped before an answer.</p></details>
    {error && <p role="status">Refresh unavailable. Showing the last recorded totals.</p>}
  </section>
  return <section className="ra-sandbox-panel" aria-label="Sandbox scoreboard">
    <h2>Sandbox scoreboard</h2>
    <p className="ra-sandbox-label">{external && external.questions > 0 ? 'XRPL Testnet · external visitors since 11 Nov' : stats.label}</p>
    {external && <p>{external.questions} confirmed external · {all.questions} all · {stats.unclassified} historical runs with unknown source</p>}
    <dl className="ra-sandbox-metrics">{metrics.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p>{fmt(stats.stoppedBeforeAnswer)} stopped before an answer (nothing to anchor)</p>
    <h3>Gate audit · all runs with a recorded violation</h3>
    <dl className="ra-sandbox-audit">{audits.map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p>{stats.audit.checked} runs with retained traces · {stats.audit.unavailable} unavailable. {stats.inProgress} in progress; {stats.anchorPending} awaiting an anchor.</p>
    <p>Started questions only. Timing includes waiting, from Start to the last Done ({headline.timing.samples} samples). Spend is gross, before refunds. Model cost is the metered estimate; unfinished calls retain their upper bound. Anchors are stored confirmations, not fresh ledger checks. This audit checks the recorded sequence, budget and purchase identities; it does not recheck citation text.</p>
    <p>{stats.excludedSimulated} simulated runs excluded. Updated {whenSGT(stats.updatedAt)} · refreshes every 60 s. No question text or visitor details are published.</p>
    {error && <p role="status">Refresh unavailable. Showing the last recorded totals.</p>}
  </section>
}
