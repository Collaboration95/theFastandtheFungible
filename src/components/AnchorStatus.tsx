import { useEffect, useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts/index.js'
import { getRun } from '../api'
/** Anchoring completes after DONE. Read the same run for at most 90 seconds. */
export default function AnchorStatus({ run }: { run: RunSnapshot }) {
  const [now] = useState(Date.now)
  const [result, setResult] = useState<{ runId: string; anchor?: RunSnapshot['ledgerAnchor']; expired?: boolean }>()
  const simulated = run.labels.settlement.includes('SIMULATED')
  const endedAt = Date.parse(run.events.at(-1)?.at ?? '')
  const terminal = ['DONE', 'STOPPED', 'FAILED'].includes(run.phase)
  useEffect(() => {
    if (simulated || run.ledgerAnchor || !terminal || !Number.isFinite(endedAt)) return
    const remaining = endedAt + 90_000 - Date.now()
    if (remaining <= 0) return
    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const deadline = setTimeout(() => {
      abort.abort(); clearTimeout(timer)
      setResult({ runId: run.runId, expired: true })
    }, remaining)
    const poll = async () => {
      try {
        const next = await getRun(run.runId, abort.signal)
        if (abort.signal.aborted) return
        if (next.runId === run.runId && next.ledgerAnchor) {
          setResult({ runId: run.runId, anchor: next.ledgerAnchor })
          clearTimeout(deadline)
          return
        }
      } catch { /* A transient GET failure can retry within the same deadline. */ }
      if (!abort.signal.aborted) timer = setTimeout(() => { void poll() }, 2000)
    }
    timer = setTimeout(() => { void poll() }, 2000)
    return () => { abort.abort(); clearTimeout(timer); clearTimeout(deadline) }
  }, [run.runId, run.ledgerAnchor, simulated, terminal, endedAt])
  const current = result?.runId === run.runId ? result : undefined
  const a = run.ledgerAnchor ?? current?.anchor
  const recent = Number.isFinite(endedAt) && now - endedAt < 90_000 && !current?.expired
  return <p className="ra-caption" aria-live="polite">{a ? <><a href={`https://testnet.xrpl.org/transactions/${a.txHash}`} target="_blank" rel="noopener noreferrer">Anchored on XRPL · ledger {a.ledgerIndex}</a> · anchor fee {a.feeDrops} drops (Testnet)</> : simulated ? 'not anchored (simulated)' : recent ? 'Anchoring…' : 'No anchor recorded for this Testnet run (anchoring was off or unavailable)'}</p>
}
