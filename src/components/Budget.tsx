import type { RunSnapshot } from '../../shared/contracts/index.js'

export default function Budget({ run }: { run: RunSnapshot }) {
  const remaining = run.budgetMinor - run.spentMinor - run.reservedMinor
  const money = (minor: number) => `S$${(minor / 100).toFixed(2)}`
  return <section className="ra-panel ra-budget" aria-label="Prompt budget">
    <h2>Prompt budget</h2>
    <dl>
      <dt>Authorized</dt><dd>{money(run.budgetMinor)}</dd>
      <dt>Spent</dt><dd>{money(run.spentMinor)}</dd>
      <dt>Reserved</dt><dd>{money(run.reservedMinor)}</dd>
      <dt>Remaining</dt><dd>{money(remaining)}</dd>
      <dt>Per-source cap</dt><dd>{money(run.perSourceCapMinor)}</dd>
    </dl>
    {run.budgetMinor > 0 && <meter min={0} max={run.budgetMinor} value={run.spentMinor + run.reservedMinor} aria-label="Spent plus reserved budget" />}
    {run.budgetMinor === 0 && <p>Free-only run · no purchases authorized.</p>}
    {remaining < 0 && <p role="alert">Budget invariant violated: spent plus reserved exceeds authorization.</p>}
    <p>SIMULATED SGD · no real funds</p>
  </section>
}
