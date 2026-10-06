import { useEffect, useState } from 'react'
import type { PastRun } from '../api'
import { money } from '../format'

export interface SidebarProps {
  runs: PastRun[]; activeId?: string; busy: boolean; open: boolean
  onToggle: () => void; onNew: () => void; onOpenRun: (runId: string) => void; onPin: (runId: string, pinned: boolean) => void; onDelete: (runId: string) => void
}
const over = (run: PastRun) => run.stopped || ['DONE', 'FAILED', 'STOPPED'].includes(run.phase)
const dotOf = (run: PastRun) => !over(run) ? 'work' : run.phase === 'DONE' ? 'done' : run.phase === 'FAILED' ? 'alert' : 'idle'
const today = (run: PastRun) => !run.at || new Date(run.at).toDateString() === new Date().toDateString()

/** The left sidebar: New question and past runs. A run's ⋯ menu pins it or removes it from the list (receipts stay in the ledger). */
export default function Sidebar({ runs, activeId, busy, open, onToggle, onNew, onOpenRun, onPin, onDelete }: SidebarProps) {
  const [menu, setMenu] = useState<{ id: string; confirm: boolean; x: number; y: number }>()
  useEffect(() => {
    if (!menu) return
    const close = (event: Event) => { if (!(event.target instanceof Element && event.target.closest('.ra-menu, .ra-nav-more'))) setMenu(undefined) }
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(undefined) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [menu])
  const groups: [string, PastRun[]][] = [['Pinned', runs.filter(run => run.pinned)], ['Today', runs.filter(run => !run.pinned && today(run))], ['Earlier', runs.filter(run => !run.pinned && !today(run))]]
  const row = (run: PastRun) => <li key={run.runId} className={`ra-nav-li${activeId === run.runId ? ' is-on' : ''}`}>
    <button type="button" className="ra-nav-run" onClick={() => onOpenRun(run.runId)} aria-current={activeId === run.runId ? 'page' : undefined} aria-label={`Run: ${run.question}`} title={open ? undefined : run.question}>
      <i className={`ra-dot d-${dotOf(run)}`} aria-hidden="true" />{open && <><span className="t">{run.question}</span><span className="m">{money(run.spentMinor)}</span></>}
    </button>
    {open && <button type="button" className="ra-nav-more" aria-label={`Options for ${run.question}`} aria-haspopup="menu" aria-expanded={menu?.id === run.runId} onClick={event => { const box = event.currentTarget.getBoundingClientRect(); setMenu(menu?.id === run.runId ? undefined : { id: run.runId, confirm: false, x: box.right, y: box.bottom + 4 }) }}>⋯</button>}
    {menu?.id === run.runId && <div className="ra-menu" role="menu" style={{ left: Math.max(8, menu.x - 200), top: menu.y }}>
      {menu.confirm
        ? <><p>Remove from history? Its receipts stay in the ledger.</p><button type="button" role="menuitem" className="ra-menu-danger" onClick={() => { setMenu(undefined); onDelete(run.runId) }}>Delete</button><button type="button" role="menuitem" onClick={() => setMenu(undefined)}>Cancel</button></>
        : <><button type="button" role="menuitem" onClick={() => { setMenu(undefined); onPin(run.runId, !run.pinned) }}>{run.pinned ? 'Unpin' : 'Pin'}</button>
          <button type="button" role="menuitem" className="ra-menu-danger" disabled={!over(run)} title={over(run) ? undefined : 'Stop the run first'} onClick={() => setMenu({ ...menu, confirm: true })}>Delete…</button></>}
    </div>}
  </li>
  return <nav className={`ra-nav${open ? '' : ' is-rail'}`} aria-label="Questions">
    <button type="button" className="ra-newq" onClick={onNew} disabled={busy} title={busy ? 'Available when the run ends, or after Stop buying' : undefined} aria-label="New question"><span aria-hidden="true">+</span>{open && <>New question<kbd>N</kbd></>}</button>
    <div className="ra-nav-list">{groups.filter(([, list]) => list.length).map(([name, list]) => <section key={name}>
      {open && <p className="ra-nav-sec">{name}</p>}<ul>{list.map(row)}</ul>
    </section>)}</div>
    <div className="ra-nav-foot">
      {open && <p><b>Demo workspace</b><small>Sign-in comes later</small></p>}
      <button type="button" className="ra-nav-toggle" onClick={onToggle} aria-expanded={open} aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}>{open ? '«' : '»'}</button>
    </div>
  </nav>
}
