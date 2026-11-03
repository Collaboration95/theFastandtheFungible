import { useEffect, useState } from 'react'
import type { PurchaseIntent, RunSnapshot } from '../../shared/contracts'
import { candidateOf } from '../format'

/** Promise names come from the public manifest; only recorded proof results earn a check. */
export default function Verification({ run, intent }: { run: RunSnapshot; intent: PurchaseIntent }) {
  const proof = run.events.filter(e => e.type === 'PROOF' && e.data?.intentId === intent.intentId).at(-1)
  const failed = intent.status === 'REFUNDED' || ['CLAIM_FAILED', 'CHALLENGED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'].includes(intent.status)
  const checked = !!proof || intent.status === 'VERIFIED' || failed
  const [open, setOpen] = useState(checked)
  useEffect(() => { if (!checked) return; const show = setTimeout(() => setOpen(true), 0); const hide = failed ? undefined : setTimeout(() => setOpen(false), 4000); return () => { clearTimeout(show); clearTimeout(hide) } }, [checked, failed])
  if (!checked) return null
  const claims = candidateOf(run, intent)?.manifest?.claims ?? []
  const failures = proof?.data?.failedClaimIds as string[] | undefined
  return <details className="ra-verification" open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>Checked against the writer's promises</summary><ul>{claims.map(claim => {
    const unverified = failed && (!proof || (proof.data?.ok === false && !failures?.length))
    const bad = unverified || failures?.includes(claim.id)
    const name = claim.covers ? [claim.covers.entity, claim.covers.measure, claim.covers.period, claim.covers.comparison].filter(Boolean).join(' ') : claim.id.replace(/-/g, ' ')
    return <li key={claim.id} className={bad ? 'is-bad' : ''}><span>{bad ? '✕' : '✓'} {name}</span><small>{bad ? unverified ? 'Could not verify this promise.' : 'Not found. The article did not contain this.' : 'Found in the checked passage'}</small></li>
  })}</ul>{!claims.length && <p>{failed ? 'A promise was broken. This article is not used.' : 'Article integrity verified.'}</p>}</details>
}
