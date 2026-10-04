import type { RunSnapshot } from '../../shared/contracts/index.js'

function Probability({ label, value }: { label: string; value: number }) {
  const percentage = Math.max(0, Math.min(100, value * 100))
  return <div className="ra-probability">
    <span>{label}: {(value * 100).toFixed(1)}%</span>
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
      <span style={{ width: `${percentage}%` }} />
    </div>
  </div>
}

export default function DecisionTable({ run }: { run: RunSnapshot }) {
  return <section className="ra-panel ra-decision-table" aria-label="Decision policy and all rounds">
    <h2>Decision table</h2>
    <p>Only policy code can purchase. Public previews and metadata inform these scores.</p>
    <pre>{`value(c) = gapMaterial × addressesGap(c) × P(original)(c) × (0.5 + 0.25 × credibility(c))
eligible(c) = value(c) ≥ BUY_THRESHOLD
              ∧ price(c) ≤ perSourceCap
              ∧ price(c) ≤ budget − spent − reserved
              ∧ c not bought already ∧ c.derivedFrom ∉ {read or bought sources}
buy = argmax over eligible of value(c) / price(c); none → STOP`}</pre>
    <p>BUY_THRESHOLD is per model. Value/$ uses the price in SGD.</p>
    {run.budgetMinor === 0 && <p>Free-only run: “would buy” is a counterfactual, with no BUY or spending authorized.</p>}
    {run.decisions.length === 0 && <p>Waiting for candidate scores. No purchase is initiated by this table.</p>}
    {run.decisions.map(round => <section key={round.round} aria-label={`Decision round ${round.round}`}>
      <h3>Round {round.round} · {round.provider === 'cloudflare' ? 'Cloudflare' : 'fixture'} · {round.model}</h3>
      <p>BUY_THRESHOLD: {round.threshold} · Gap: {round.gap}</p>
      <Probability label="Gap material" value={round.gapMaterial} />
      {round.fallbackReason && <p>Fixture substitution: {round.fallbackReason}</p>}
      <table>
        <caption>All candidates · round {round.round}</caption>
        <thead><tr><th scope="col">Candidate / price</th><th scope="col">Probabilities</th><th scope="col">Credibility</th><th scope="col">Value</th><th scope="col">Value/$</th><th scope="col">Verdict / reason</th></tr></thead>
        <tbody>{round.rows.map(row => <tr key={`${row.candidate.resourceId}:${row.candidate.version}`}>
          <th scope="row">{row.candidate.title}<br />{row.candidate.publisher}<br />S${(row.candidate.price.amountMinor / 100).toFixed(2)}</th>
          <td><Probability label="Addresses gap" value={row.judgment.addressesGap} />
            <Probability label="Original" value={row.judgment.originality.original} />
            <Probability label="Rewrite" value={row.judgment.originality.rewrite} />
            <Probability label="Overlap" value={row.judgment.originality.overlap} /></td>
          <td>{row.judgment.credibility.toFixed(2)} / 2</td>
          <td>{row.value.toFixed(4)}</td><td>{row.valuePerDollar.toFixed(4)}</td>
          <td><strong>{run.budgetMinor === 0 && row.verdict === 'BUY' ? 'SKIP_OVER_BUDGET' : row.verdict}</strong>
            {row.wouldBuy && <p>Would buy{run.budgetMinor === 0 ? ' · with sufficient budget' : ''}</p>}
            <p>{row.reason}</p></td>
        </tr>)}</tbody>
      </table>
    </section>)}
  </section>
}
