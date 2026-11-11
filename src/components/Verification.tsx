import Icon from './Icon'
import { useEffect, useState } from 'react'
import type { PurchaseIntent, RunSnapshot } from '../../shared/contracts'
import { promiseLabel } from '../../shared/promise-label'
import { candidateOf } from '../format'

/** Promise names come from the public manifest; only recorded proof results earn a check. */
export default function Verification({ run, intent }: { run: RunSnapshot; intent: PurchaseIntent }) {
  const proof = run.events.filter(e => e.type === 'PROOF' && e.data?.intentId === intent.intentId).at(-1)
  const failed = intent.status === 'REFUNDED' || ['CLAIM_FAILED', 'CHALLENGED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'].includes(intent.status)
  const checked = !!proof || intent.status === 'VERIFIED' || failed
  const [open, setOpen] = useState(checked)
  useEffect(() => { if (!checked) return; const show = setTimeout(() => setOpen(true), 0);  return () => { clearTimeout(show) } }, [checked, failed])
  if (!checked) return null
  const claims = candidateOf(run, intent)?.manifest?.claims ?? []
  const failures = proof?.data?.failedClaimIds as string[] | undefined
  const nameOf = (claim: typeof claims[number]) => promiseLabel(claim)
  const names = [...new Set(claims.map(nameOf))]
  return <details className="ra-verification" open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>Checked against the writer’s promises</summary><ul>{names.slice(0, 5).map(name => {
    const group = claims.filter(c => nameOf(c) === name)
    const claim = group[0]
    const unverified = failed && (!proof || (proof.data?.ok === false && !failures?.length))
    const bad = unverified || group.some(c => failures?.includes(c.id))
    return <li key={claim.id} className={bad ? 'is-bad' : ''}><span><Icon name={bad ? 'close' : 'check'} size={16} /> {name}</span><small>{bad ? unverified ? 'Could not verify this promise.' : 'Not found. The article did not contain this.' : 'Found in the checked passage'}</small></li>
  })}{names.length > 5 && <li>and {names.length - 5} more</li>}</ul>{!claims.length && <p>{failed ? 'A promise was broken. This article is not used.' : 'Article integrity verified.'}</p>}</details>
}
