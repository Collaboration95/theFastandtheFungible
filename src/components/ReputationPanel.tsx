import { useState } from 'react'
import type { ReputationRecord, ReputationSummary, RunSnapshot } from '../../shared/contracts/index.js'
import { usePublisherCard, writerName } from './WriterChip'

type Row = { slug: string; name: string; writers: string[]; claimed?: number; articles: number; record?: ReputationRecord; score: ReputationSummary }
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
    return { slug, record, score, articles: mine.length, name: mine[0]?.publisher ?? slug, writers: [...new Set(mine.map(candidate => candidate.writerSlug).filter((value): value is string => !!value))], claimed: claimed.length ? Math.max(...claimed) : undefined }
  }).sort((a, b) => a.score.T - b.score.T)
}

const runCount = (row: Row) => row.articles || '—'

function PublisherRow({ row }: { row: Row }) {
  const card = usePublisherCard(row.slug)
  const [expanded, setExpanded] = useState(false)
  const { record, score } = row
  const writers = [...new Set([...row.writers, ...(card?.writers.map(writer => writer.slug) ?? [])])]
  return <tbody><tr>
    <th scope="row"><button type="button" className="ra-link" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{card?.name ?? row.name}</button></th>
    <td>{runCount(row)}</td><td>{score.T.toFixed(2)}</td><td>{record ? `${record.passes} / ${record.fails}` : '0 / 0'}</td><td className={score.status === 'delisted' ? 'ra-error-text' : undefined}>{score.status === 'active' ? 'Active' : score.status === 'delisted' ? 'Delisted' : 'Quarantined'}</td>
  </tr>{expanded && <tr><td colSpan={5}><p>Honesty {score.H.toFixed(2)} · Coverage {score.C.toFixed(2)} · Refunds {record?.refunds ?? 0} · Refusals {record?.refusals ?? 0}</p><p>Bylines: {writers.map(slug => writerName(slug, card)).join(', ') || 'Not listed'}</p><a href={import.meta.env.MODE === 'browser-demo' ? `${import.meta.env.BASE_URL}?writers=1` : `/w/${row.slug}`} target="_blank" rel="noreferrer">Visit writer’s site ↗</a></td></tr>}</tbody>
}

/** The trust matrix (D6), public: Beta honesty H × calibration C = trust T. "Writers" is a working name (X3). */
export default function ReputationPanel({ records, run, full, presenter = false, onReset }: { records: ReputationRecord[]; run?: RunSnapshot; full?: RunSnapshot; presenter?: boolean; onReset?: () => void }) {
  const list = rows(records, run, full)
  return <section className="ra-panel ra-rep" aria-label="Writers">
    <div className="ra-panel-h"><h2>Writers</h2>{presenter && onReset && <button type="button" className="ra-btn" onClick={onReset} title="Presenter only: wipe every reputation record">Reset reputation</button>}</div>
    <p className="ra-note">All writers and articles are fictional.</p>
    {list.length === 0 ? <p>No history yet.</p> : <div className="ra-table-scroll"><table>
      <thead><tr><th scope="col">Writer</th><th scope="col" title="Articles found in this run">Articles</th><th scope="col">Trust</th><th scope="col">Checked / failed</th><th scope="col">Status</th></tr></thead>
      {list.map(row => <PublisherRow key={row.slug} row={row} />)}
    </table></div>}
  </section>
}
