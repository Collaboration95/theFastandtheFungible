import type { ModeLabels } from '../../shared/contracts/index.js'

export default function Modes({ labels }: { labels?: ModeLabels }) {
  return <section className="ra-modes" aria-label="Provider and simulation labels">
    <ul>
      <li>Research: {labels?.research ?? 'fixture · extractive-fixture'}</li>
      <li>Decision: {labels?.decision ?? 'fixture · metadata-fixture'}</li>
      <li>Publisher: {labels?.publisher ?? 'local'}</li>
      <li>Synthetic corpus · fictional demo evidence</li>
      <li>{labels?.settlement ?? 'Settlement rail shown once a run starts · no real funds'}</li>
    </ul>
  </section>
}
