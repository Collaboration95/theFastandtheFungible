import { decisionLabel, type RunSnapshot } from '../../shared/contracts/index.js'
import { plainVerdict } from '../format'
import WriterChip from './WriterChip'

function Probability({ label, value }: { label: string; value: number }) {
  const percentage = Math.max(0, Math.min(100, value * 100))
  return <div className="ra-probability">
    <span>{label}: {(value * 100).toFixed(1)}%</span>
    <div className="ra-probability-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
      <span className="ra-probability-bar" style={{ width: `${percentage}%` }} />
    </div>
  </div>
}

export default function DecisionTable({ run }: { run: RunSnapshot }) {
  return <section className="ra-panel ra-decision-table" aria-label="Decision policy and all rounds">
    <h2>Decision table</h2>
    <p>Public previews → model probabilities → policy verdicts. Only code purchases.</p>
    <div className="ra-policy"><p>value = gap material × addresses gap × P(original) × (0.5 + 0.25 × credibility)</p><p>Buy the highest value/S$ that clears the threshold, source cap and remaining budget.</p><details><summary>Full policy formula</summary><pre>{`value(c) = gapMaterial × addressesGap(c) × P(original)(c) × (0.5 + 0.25 × credibility(c))
eligible(c) = value(c) ≥ BUY_THRESHOLD
              ∧ price(c) ≤ perSourceCap
              ∧ price(c) ≤ budget − spent − reserved
              ∧ c not bought already ∧ c.derivedFrom ∉ {read or bought sources}
buy = argmax over eligible of value(c) / price(c); none → STOP`}</pre>
    </details></div>
    {run.budgetMinor === 0 && <p>Free-only run: “would buy” is a counterfactual, with no BUY or spending authorized.</p>}
    {run.decisions.length === 0 && <p>Waiting for candidate scores. No purchase is initiated by this table.</p>}
    {run.decisions.map((round, index) => <details open={index === 0} key={round.round} aria-label={`Decision round ${round.round}`}>
      <summary>Round {round.round} · {decisionLabel(round)}</summary>
      <p>BUY_THRESHOLD: {round.threshold} · Gap: {round.gap}</p>
      {round.gapMaterialSource === 'requirement' ? <p>Gap material: 1 · requested fact</p> : <Probability label="Gap material" value={round.gapMaterial} />}
      <div className="ra-table-scroll" tabIndex={0} role="region" aria-label={`Candidate scores round ${round.round}`}><table>
        <caption>All candidates · round {round.round}</caption>
        <thead><tr><th scope="col">Candidate / price</th><th scope="col">Probabilities</th><th scope="col">Value / SGD</th><th scope="col">Verdict / reason</th></tr></thead>
        <tbody>{round.rows.map(row => <tr key={`${row.candidate.resourceId}:${row.candidate.version}`}>
          <th scope="row">{row.candidate.title}<br /><WriterChip candidate={row.candidate} reputation={row.reputation} /></th>
          <td><div className="ra-probability-grid"><Probability label="Addresses gap" value={row.judgment.addressesGap} />
            <Probability label="Original" value={row.judgment.originality.original} />
            <Probability label="Rewrite" value={row.judgment.originality.rewrite} />
            <Probability label="Overlap" value={row.judgment.originality.overlap} /></div></td>
          <td><strong>{row.value.toFixed(3)}</strong><br />{row.valuePerDollar.toFixed(3)} / S$<br />Credibility: {row.judgment.credibility.toFixed(2)} / 2</td>
          <td className={row.verdict === 'BUY' && run.budgetMinor > 0 ? 'ra-verdict-buy' : undefined}><strong>{run.budgetMinor === 0 && row.verdict === 'BUY' ? 'SKIP_OVER_BUDGET' : row.verdict}</strong>
            {row.wouldBuy && <p>Would buy{run.budgetMinor === 0 ? ' · with sufficient budget' : ''}</p>}
            <p>{row.reason}</p>{row.verdict === 'SKIP_LOW_TRUST' && <p>{plainVerdict(row, run).why}</p>}</td>
        </tr>)}</tbody>
      </table></div>
    </details>)}
  </section>
}
