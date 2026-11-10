import { useEffect, useState } from 'react'
import { WriterVerification } from './WriterVerification'
import type { WriterVerification as Verification } from '../../shared/writer-verification'
import './writer-earnings.css'
/* eslint-disable react-refresh/only-export-components -- priceRange is a pure helper shared with its test. */
type Writer = { slug: string; publisherSlug: string; name: string; publisher?: string; authorship: string; verification?: Verification; articleCount: number; priceRange?: number[]; articles: { id: string; title: string; priceMinor: number; tier: string }[]; sales: { finishHash: string; refunded: boolean; refundHash?: string }[]; trust: { at: string; value: number }[] }
const price = (minor: number) => `S$${(minor / 100).toFixed(2)}`
/** One price when the range is a point, "Free" when that price is zero. */
export const priceRange = (prices: number[]) => {
  if (!prices.length) return 'No articles'
  const low = Math.min(...prices), high = Math.max(...prices)
  return high === 0 ? 'Free' : low === high ? price(low) : `${price(low)}–${price(high)}`
}
/** "Fictional writer", "Team-authored" or "Author-supplied", without the trailing "· unverified" the badge adds once. */
const kind = (authorship: string) => authorship.replace(/ · unverified$/, '')
const explorer = (hash: string) => `https://testnet.xrpl.org/transactions/${hash}`
export default function WriterEarnings() {
  const [data, setData] = useState<{ scope: string; writers: Writer[] }>()
  const [failed, setFailed] = useState(false)
  useEffect(() => { const controller = new AbortController(); void fetch('/api/writers/earnings', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json() }).then(setData).catch(() => { if (!controller.signal.aborted) setFailed(true) }); return () => controller.abort() }, [])
  return <div className="ra-writer-earnings">
    <p><a href="https://github.com/Collaboration95/theFastandtheFungible/blob/main/docs/publishing.md" target="_blank" rel="noreferrer">Publish your notes ↗</a></p>
    {!data ? <p role="status">{failed ? 'Writer catalogue unavailable. Try again later.' : 'Loading writers…'}</p> : <>
      <p className="ra-note">{data.scope} Only confirmed key-reveal sales appear here. Simulated payments are excluded.</p>
      <div className="ra-writer-grid">{data.writers.map(w => {
        const prices = w.priceRange ?? [], refunds = w.sales.filter(s => s.refunded).length
        const points = w.trust.map((p,i) => `${4 + i * 152 / Math.max(1,w.trust.length - 1)},${36 - Math.max(0, Math.min(1,p.value)) * 32}`).join(' ')
        return <article className="ra-writer-card" key={w.slug}>
          <h2><a href={`/w/${w.publisherSlug}`} target="_blank" rel="noreferrer">{w.publisher ?? w.name} ↗</a></h2>
          {w.publisher && w.publisher !== w.name && <p className="ra-note ra-writer-by">{`by ${w.name}`}</p>}
          {w.verification?.status === 'verified' ? <WriterVerification value={w.verification} /> : <small className="ra-badge" title={`${kind(w.authorship)}. Identity not checked.`}>{kind(w.authorship).replace(/ writer$/, '')} · unverified</small>}
          <dl><div><dt>Articles</dt><dd>{w.articleCount}</dd></div><div><dt>Price range</dt><dd>{priceRange(prices)}</dd></div>
          <div><dt>Confirmed sales</dt><dd>{w.sales.length}</dd></div><div><dt>Refunds</dt><dd>{refunds} · {w.sales.length ? `${(100 * refunds / w.sales.length).toFixed(0)}%` : 'rate unavailable'}</dd></div></dl>
          <details><summary>Articles and prices</summary>{w.articleCount > w.articles.length && <p>Showing {w.articles.length} of {w.articleCount} articles. Visit the writer’s site for all articles.</p>}<ul>{w.articles.map(a => <li key={a.id}><a href={`/w/${w.publisherSlug}/blog/${a.id}`} target="_blank" rel="noreferrer">{a.title}</a> · {a.tier === 'FREE' ? 'Free' : price(a.priceMinor)}</li>)}</ul></details>
          {w.sales.length > 0 && <details><summary>Sales on XRPL Testnet</summary><ol>{w.sales.map((s,i) => <li key={s.finishHash}><a href={explorer(s.finishHash)} target="_blank" rel="noreferrer">Sale {i + 1} · EscrowFinish ↗</a>{s.refunded && <span> · Refunded {s.refundHash && <a href={explorer(s.refundHash)} target="_blank" rel="noreferrer">receipt ↗</a>}</span>}</li>)}</ol></details>}
          <p className="ra-note">Trust over time {w.trust.length ? `· latest ${w.trust.at(-1)!.value.toFixed(2)}` : '· no observations in your history'}</p>
          {w.trust.length > 1 && <svg viewBox="0 0 160 40" width="160" height="40" role="img" aria-label={`Trust from ${w.trust[0].value.toFixed(2)} to ${w.trust.at(-1)!.value.toFixed(2)} across ${w.trust.length} observations`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
        </article>
      })}</div>
    </>}
  </div>
}
