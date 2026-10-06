import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ReputationRecord, ReputationSummary, RunSnapshot } from '../../shared/contracts/index.js'
import { usePublisherCard, writerName } from './WriterChip'

type Row = { slug: string; name: string; writers: string[]; claimed?: number; record?: ReputationRecord; score: ReputationSummary }
const NEWCOMER: ReputationSummary = { H: 0.8, C: 1, T: 0.8, status: 'active' }
const summaryOf = (value: unknown) => value as ReputationSummary | undefined

/** Publishers (sellers of record, D21) with their writers nested, from the engine's records and this run.
    During a stage-paced replay a publisher shows its score from before the run until its REPUTATION event is revealed. */
function rows(records: ReputationRecord[], run?: RunSnapshot, full?: RunSnapshot): Row[] {
  const slugs = new Set(records.map(record => record.publisherSlug))
  for (const candidate of run?.candidates ?? []) if (candidate.publisherSlug && candidate.tier === 'PAID') slugs.add(candidate.publisherSlug)
  const changes = (source?: RunSnapshot, slug?: string) => (source?.events ?? []).filter(event => event.type === 'REPUTATION' && event.data?.publisherSlug === slug && event.data?.after)
  return [...slugs].map(slug => {
    const record = records.find(item => item.publisherSlug === slug)
    const mine = (run?.candidates ?? []).filter(candidate => candidate.publisherSlug === slug)
    const shown = changes(run, slug), all = changes(full ?? run, slug)
    const score = summaryOf(shown.at(-1)?.data?.after) ?? summaryOf(all[0]?.data?.before) ?? record ?? NEWCOMER
    const claimed = mine.map(candidate => candidate.manifest?.relevance ?? candidate.relevance).filter((value): value is number => value !== undefined)
    return { slug, record, score, name: mine[0]?.publisher ?? slug, writers: [...new Set(mine.map(candidate => candidate.writerSlug).filter((value): value is string => !!value))], claimed: claimed.length ? Math.max(...claimed) : undefined }
  }).sort((a, b) => a.score.T - b.score.T)
}

function PublisherRow({ row }: { row: Row }) {
  const card = usePublisherCard(row.slug)
  const before = useRef(row.score.T)
  const [drop, setDrop] = useState(false)
  useEffect(() => {
    if (row.score.T < before.current) setDrop(true)
    before.current = row.score.T
  }, [row.score.T])
  const { record, score } = row
  const writers = [...new Set([...row.writers, ...(card?.writers.map(writer => writer.slug) ?? [])])].filter(slug => slug !== row.slug)
  const brier = record?.n ? record.brierSum / record.n : undefined
  return <tbody className={drop ? 'is-drop' : undefined}>
    <tr className={`is-${score.status}`}>
      <th scope="row"><a href={`/w/${row.slug}`} target="_blank" rel="noreferrer">{card?.name ?? row.name} ↗</a> <span className="ra-chip is-sim">SYNTHETIC</span></th>
      <td>{record ? `${record.passes} / ${record.fails}` : '0 / 0'}</td>
      <td>{record ? `${record.refunds} / ${record.refusals}` : '0 / 0'}</td>
      <td>{row.claimed === undefined ? '—' : `claimed ${row.claimed.toFixed(2)}`}{brier === undefined ? '' : ` · Brier ${brier.toFixed(2)} (n ${record!.n})`}</td>
      <td>H {score.H.toFixed(2)}</td><td>C {score.C.toFixed(2)}</td>
      <td><span className="ra-trust-bar" role="meter" aria-label={`Trust ${score.T.toFixed(2)}`} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number(score.T.toFixed(2))} style={{ '--t': `${score.T * 100}%` } as CSSProperties}><i /></span> T {score.T.toFixed(2)}</td>
      <td><span className={`ra-trust is-${score.status}`}>{score.status}</span></td>
    </tr>
    {writers.map(slug => <tr key={slug} className="ra-rep-writer"><td colSpan={8}>↳ {writerName(slug, card)}</td></tr>)}
  </tbody>
}

/** The trust matrix (D6), public: Beta honesty H × calibration C = trust T. "Writers" is a working name (X3). */
export default function ReputationPanel({ records, run, full, presenter = false, onReset }: { records: ReputationRecord[]; run?: RunSnapshot; full?: RunSnapshot; presenter?: boolean; onReset?: () => void }) {
  const list = rows(records, run, full)
  return <section className="ra-panel ra-rep" aria-label="Writers">
    <div className="ra-panel-h"><h2>Writers</h2>{presenter && onReset && <button type="button" className="ra-btn" onClick={onReset} title="Presenter only: wipe every reputation record">Reset reputation</button>}</div>
    <p className="ra-muted">Trust T = honesty H × calibration C. Under H 0.50 a publisher is quarantined: never bought or cited. Trust can only lower value; it never raises the budget.</p>
    {list.length === 0 ? <p>No publisher history yet. Newcomers start at H 0.80.</p> : <div className="ra-table-scroll"><table>
      <thead><tr><th scope="col">Publisher · writers</th><th scope="col">Proofs ✓/✗</th><th scope="col">Challenges refunded/refused</th><th scope="col">Relevance claimed vs observed</th><th scope="col">H</th><th scope="col">C</th><th scope="col">T</th><th scope="col">Status</th></tr></thead>
      {list.map(row => <PublisherRow key={row.slug} row={row} />)}
    </table></div>}
  </section>
}
