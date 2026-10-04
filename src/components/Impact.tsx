import { useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts/index.js'
import { getValidatedAnswer } from './Answer'
export default function Impact({ run }: { run: RunSnapshot }) {
  const [showChanges, setShowChanges] = useState(false)
  const answers = [...run.answers].sort((a, b) => a.version - b.version)
  const baseline = getValidatedAnswer(run, answers[0])
  const final = getValidatedAnswer(run, answers.at(-1))
  if (!run.impact || !baseline || !final || baseline.version === final.version || baseline.claims.length !== answers[0]?.claims.length || final.claims.length !== answers.at(-1)?.claims.length) return null
  const changes = run.impact.claimChanges.filter(change => (!change.fromClaimId || baseline.claims.some(claim => claim.id === change.fromClaimId)) && (!change.toClaimId || final.claims.some(claim => claim.id === change.toClaimId)))
  return <section className="ra-panel ra-impact" aria-label="What the evidence changed">
    <div className="ra-section-heading"><h2>What changed</h2><span className={`ra-badge ra-impact-${run.impact.classification.toLowerCase()}`}>{run.impact.classification}</span></div>
    <p>{run.impact.explanation}</p><button className="ra-text-button" type="button" aria-expanded={showChanges} onClick={() => setShowChanges(!showChanges)}>{showChanges ? 'Hide' : 'Show'} v1 → v{final.version} changes</button>
    {showChanges && <ul className="ra-change-list">{changes.map((change, index) => <li key={index}><span className="ra-badge">{change.change}</span>{change.fromClaimId && <p><strong>Before: </strong>{baseline.claims.find(claim => claim.id === change.fromClaimId)?.text}</p>}{change.toClaimId && <p><strong>After: </strong>{final.claims.find(claim => claim.id === change.toClaimId)?.text}</p>}</li>)}</ul>}
  </section>
}
