import Icon from './Icon'
import { money as price } from '../../shared/presentation'
import { useEffect, useState } from 'react'
import { useHosted } from '../hosted'
import { WriterVerification } from './WriterVerification'
import type { WriterVerification as Verification } from '../../shared/writer-verification'
import './writer-earnings.css'
/* eslint-disable react-refresh/only-export-components -- priceRange, writerTitle and orderWriters are pure helpers shared with their tests. */
type Writer = { slug: string; publisherSlug: string; name: string; publisher?: string; authorship: string; synthetic?: boolean; verification?: Verification; articleCount: number; priceRange?: number[]; articles: { id: string; title: string; priceMinor: number; tier: string }[]; sales: { finishHash: string; refunded: boolean; refundHash?: string }[]; trust: { at: string; value: number }[]; demoSales?: number }
const price = (minor: number) => `S$${(minor / 100).toFixed(2)}`
/** One price when the range is a point, "Free" when that price is zero. */
export const priceRange = (prices: number[]) => {
  if (!prices.length) return 'No articles'
  const low = Math.min(...prices), high = Math.max(...prices)
  return high === 0 ? 'Free' : low === high ? price(low) : `${price(low)}–${price(high)}`
}
/** "Fictional writer", "Team-authored" or "Author-supplied", without the trailing "· unverified" the badge adds once. */
const kind = (authorship: string) => authorship.replace(/ · unverified$/, '')
/** The team writes under one name ("ResearchAgent builders"), as the payment rows already say; the profile's own wording
 * ("… · XRPL explainers (team-authored)") is carried by the badge and a short line instead of a second name (R8 H8-10). */
export const writerTitle = (name: string) => name.replace(/^(ResearchAgent builders)(?: · [^(]*)?(?: \(team-authored\))?$/, '$1')
const teamLine = (name: string, slug: string) => /^ResearchAgent builders/.test(name) ? /· ([^(]+?)(?: \(team-authored\))?$/.exec(name)?.[1] ?? (slug === 'team-builder-notes' ? 'Build notes' : undefined) : undefined
const isFictional = (w: { authorship: string; publisherSlug?: string }) => /^fictional/i.test(w.authorship)
const isTeam = (w: { authorship: string; publisherSlug?: string }) => /^team/i.test(w.authorship)
/** Writers who have sold something first, then the team's, then the rest; and, on the hosted demo, the fictional writers with no
 * sales folded away (nine of them used to open the page, R8 H8-10). */
export function orderWriters<T extends { authorship: string; sales: unknown[]; publisher?: string; name: string }>(writers: T[], hosted: boolean): { shown: T[]; demo: T[] } {
  // A stable sort: writers that tie keep the catalogue's own order.
  const ordered = [...writers].sort((a, b) => b.sales.length - a.sales.length || Number(isTeam(b)) - Number(isTeam(a)))
  const demo = hosted ? ordered.filter(w => isFictional(w) && !w.sales.length) : []
  return { shown: ordered.filter(w => !demo.includes(w)), demo }
}
const explorer = (hash: string) => `https://testnet.xrpl.org/transactions/${hash}`
/** "1 sale", "12 sales", "None yet". */
export const salesCount = (n: number) => n ? `${n} ${n === 1 ? 'sale' : 'sales'}` : 'None yet'
export default function WriterEarnings() {
  const [data, setData] = useState<{ scope: string; writers: Writer[] }>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const load = () => void fetch('/api/writers/earnings', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json() }).then((next: { scope: string; writers: Writer[] }) => {
      if (controller.signal.aborted) return
      setData(next)
      if (next.writers.some(w => w.verification?.status === 'check_pending')) timer = setTimeout(load, 5000)
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [])
  const hosted = !!useHosted()
  const { shown, demo } = orderWriters(data?.writers ?? [], hosted)
  const card = (w: Writer) => {
    const prices = w.priceRange ?? [], refunds = w.sales.filter(s => s.refunded).length
    const points = w.trust.map((p,i) => `${4 + i * 152 / Math.max(1,w.trust.length - 1)},${36 - Math.max(0, Math.min(1,p.value)) * 32}`).join(' ')
    const title = writerTitle(w.publisher ?? w.name), team = teamLine(w.publisher ?? w.name, w.slug)
    return <article className="ra-writer-card" key={w.slug}>
      <h2><a href={`/w/${w.publisherSlug}`} target="_blank" rel="noreferrer">{title} <Icon name="external" size={16} /></a></h2>
      {team ? <p className="ra-note ra-writer-by">{team}</p> : w.publisher && w.publisher !== w.name && <p className="ra-note ra-writer-by">{`by ${w.name}`}</p>}
      {isFictional(w) || !w.verification || w.verification.status === 'unverified' ? <small className="ra-badge">{kind(w.authorship).replace(/ writer$/, '')} · unverified</small> : <><small className="ra-badge">{kind(w.authorship)}</small> <WriterVerification value={w.verification} /></>}
      {isTeam(w) && w.synthetic && <p className="ra-note">Synthetic demo content</p>}
      {isTeam(w) && !(w.demoSales ?? w.sales.length) && <p className="ra-note">No sales yet</p>}
      <dl><div><dt>Articles</dt><dd>{w.articleCount}</dd></div><div><dt>Price range</dt><dd>{priceRange(prices)}</dd></div>
      {w.demoSales !== undefined && <div><dt>Sales on this demo</dt><dd>{salesCount(w.demoSales)}</dd></div>}
      <div><dt>Your purchases</dt><dd>{salesCount(w.sales.length)}</dd></div>
      {w.sales.length > 0 && <div><dt>Refunds</dt><dd>{refunds} · {(100 * refunds / w.sales.length).toFixed(0)}%</dd></div>}</dl>
      <details><summary>Articles and prices</summary>{w.articleCount > w.articles.length && <p>Showing {w.articles.length} of {w.articleCount} articles. Visit the writer’s site for all articles.</p>}<ul>{w.articles.map(a => <li key={a.id}><a href={`/w/${w.publisherSlug}/blog/${a.id}`} target="_blank" rel="noreferrer">{a.title}</a> · {a.tier === 'FREE' ? 'Free' : price(a.priceMinor)}</li>)}</ul></details>
      {w.sales.length > 0 && <details><summary>Sales on XRPL Testnet</summary><ol>{w.sales.map((s,i) => <li key={s.finishHash}><a href={explorer(s.finishHash)} target="_blank" rel="noreferrer">Sale {i + 1} · EscrowFinish <Icon name="external" size={16} /></a>{s.refunded && <span> · Refunded {s.refundHash && <a href={explorer(s.refundHash)} target="_blank" rel="noreferrer">receipt <Icon name="external" size={16} /></a>}</span>}</li>)}</ol></details>}
      {w.trust.length > 0 && <p className="ra-note">Trust over time · latest {w.trust.at(-1)!.value.toFixed(2)}</p>}
      {w.trust.length > 1 && <svg viewBox="0 0 160 40" width="160" height="40" role="img" aria-label={`Trust from ${w.trust[0].value.toFixed(2)} to ${w.trust.at(-1)!.value.toFixed(2)} across ${w.trust.length} observations`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
    </article>
  }
  return <div className="ra-writer-earnings">
    <p><a href="https://github.com/Collaboration95/theFastandtheFungible/blob/main/docs/publishing.md" target="_blank" rel="noreferrer">Publish your notes <Icon name="external" size={16} /></a></p>
    {!data ? <p role="status">{failed ? 'Writer catalogue unavailable. Try again later.' : 'Loading writers…'}</p> : <>
      <p className="ra-note">{data.scope} Only confirmed key-reveal sales appear here. Simulated payments are excluded.</p>
      {/* H9-15: a new visitor has bought nothing yet; say what will appear instead of a row of zeros on every card. */}
      {!data.writers.some(w => w.sales.length) && <p className="ra-writer-empty" role="note">No purchases in your history yet. When a question buys an article, the sale appears on its writer’s card with a link to the XRPL Testnet transaction.</p>}
      <div className="ra-writer-grid">{shown.map(card)}</div>
      {demo.length > 0 && <details className="ra-writer-demo"><summary>Fictional demo writers ({demo.length})</summary><p className="ra-note">Made-up writers that fill out the demo catalogue. None has a confirmed sale on this demo.</p><div className="ra-writer-grid">{demo.map(card)}</div></details>}
    </>}
  </div>
}
