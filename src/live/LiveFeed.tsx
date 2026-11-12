import { useEffect, useRef, useState } from 'react'
import type { PublicFeed, PublicPurchase } from '../../shared/public-feed'
import Numbers from '../components/hosted/SandboxNumbersPanel'
import { money, whenSGT } from '../../shared/presentation'
import './live.css'
const explorer = (hash: string | null, label: string) => hash ? <a href={`https://testnet.xrpl.org/transactions/${hash}`} target="_blank" rel="noreferrer">{label} ↗</a> : '—'
export default function LiveFeed() {
  const [rows,setRows] = useState<PublicPurchase[]>([]), [status,setStatus] = useState('Connecting…'), [booth,setBooth] = useState(false)
  const [tab,setTab] = useState<'live'|'recorded'>('live'), [recordedLabel,setRecordedLabel] = useState('Recorded purchases')
  const [arrivals,setArrivals] = useState<Set<string>>(new Set()), known = useRef<Set<string> | undefined>(undefined)
  useEffect(() => {
    known.current = undefined
    const update = (body: PublicFeed) => { setArrivals(new Set(body.rows.filter(r => known.current && !known.current.has(r.id)).map(r=>r.id))); known.current = new Set(body.rows.map(r=>r.id)); setRows(body.rows); setStatus(tab === 'live' ? 'Live updates connected' : 'Recorded evidence') }
    if (tab === 'recorded') {
      const controller = new AbortController()
      void fetch('/api/feed/recorded',{ credentials:'omit', signal:controller.signal }).then(async r => { if (!r.ok) throw Error(); const body = await r.json(); setRecordedLabel(body.label); update(body) }).catch(()=>{ if (!controller.signal.aborted) setStatus('Recorded purchases are not available yet.') })
      return () => controller.abort()
    }
    const stream = new EventSource('/api/feed')
    stream.addEventListener('snapshot',e=>update(JSON.parse((e as MessageEvent).data)))
    stream.onerror = () => setStatus('Connection interrupted. Retrying; last purchases remain visible.')
    return () => stream.close()
  },[tab])
  useEffect(() => { const sync=()=>{ if (!document.fullscreenElement) setBooth(false) }; document.addEventListener('fullscreenchange',sync); return ()=>document.removeEventListener('fullscreenchange',sync) },[])
  const changeTab = (next: 'live'|'recorded') => { setRows([]); setStatus('Connecting…'); setTab(next) }
  const toggleBooth = async () => { if (booth) { if (document.fullscreenElement) await document.exitFullscreen(); setBooth(false) } else { setBooth(true); try { await document.documentElement.requestFullscreen() } catch { /* large type remains useful without fullscreen support */ } } }
  return <main className={`ra-live${booth?' is-booth':''}`}>
    <header><a href="/">ResearchAgent</a><span className="ra-chip">XRPL Testnet</span><button aria-pressed={booth} onClick={()=>void toggleBooth()}>Booth mode</button></header>
    <h1>Expertise, paid and delivered.</h1><p>Escrows as they happen. Every released payment carries its recorded key and delivery check.</p>
    <Numbers compact />
    <nav aria-label="Purchase source"><button aria-pressed={tab==='live'} onClick={()=>changeTab('live')}>Live purchases</button><button aria-pressed={tab==='recorded'} onClick={()=>changeTab('recorded')}>{recordedLabel}</button></nav>
    <p role="status">{status}</p>
    {rows.length ? <div className="ra-live-table"><table><caption>{tab==='live'?'Latest 100 escrows':'Recorded Testnet purchases'}</caption><thead><tr>{['Time / topic','Article / writer','Price','Escrow','Key check','Delivery gate','Settlement'].map(s=><th key={s} scope="col">{s}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className={arrivals.has(row.id)?'ra-live-new':''}>
      <td><time dateTime={row.time}>{whenSGT(row.time)}</time><small>{row.topic}</small></td><td>{row.resourceTitle}<small>{row.writer}</small></td><td>{money(row.priceMinor)}</td>
      <td>{explorer(row.createHash,'Create')}<small>Ledger {row.createLedger ?? '—'} · {row.state}</small>{explorer(row.finishHash,'Finish')}</td><td>{row.keyCheck}</td><td>{row.gate}</td><td>{row.settlementSeconds===null?'—':`${row.settlementSeconds.toFixed(1)} s`}</td>
    </tr>)}</tbody></table></div> : <section className="ra-live-empty"><h2>Ready for the next purchase</h2><p>Validated escrows will appear here, followed by the key check and settlement. Public article titles only; questions stay private.</p></section>}
    <p className="ra-live-note">Checks reflect stored observations, without a fresh ledger query. Pending and unavailable checks do not count as verified.</p>
  </main>
}
