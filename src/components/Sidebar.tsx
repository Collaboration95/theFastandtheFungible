/* eslint-disable react-refresh/only-export-components -- NAV_WIDTH bounds are shared with App's saved width. */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { PastRun } from '../api'

export const NAV_WIDTH = { min: 200, max: 420, initial: 260 }
const clamp = (width: number) => Math.round(Math.min(NAV_WIDTH.max, Math.max(NAV_WIDTH.min, width)))

export interface SidebarProps {
  runs: PastRun[]; activeId?: string; busy: boolean; open: boolean; width?: number; settingsOn?: boolean
  onResize?: (width: number) => void; onSettings?: () => void; onNew: () => void; onOpenRun: (runId: string) => void; onPin: (runId: string, pinned: boolean) => void; onDelete: (runId: string) => void
}
const over = (run: PastRun) => run.stopped || ['DONE', 'FAILED', 'STOPPED'].includes(run.phase)
const dotOf = (run: PastRun) => !over(run) ? 'work' : run.phase === 'DONE' ? 'done' : run.phase === 'FAILED' ? 'alert' : 'idle'
const today = (run: PastRun) => !run.at || new Date(run.at).toDateString() === new Date().toDateString()

/** The header button that shows or hides the sidebar: a panel icon, as in Claude's desktop app. */
export function NavToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return <button type="button" className="ra-nav-toggle" onClick={onToggle} aria-expanded={open} aria-label={open ? 'Hide sidebar' : 'Show sidebar'} title={open ? 'Hide sidebar' : 'Show sidebar'}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.75" y="3.75" width="14.5" height="12.5" rx="3" /><path d="M7.75 3.75v12.5" /></svg>
  </button>
}

/** The left sidebar: New question and past runs. A run's ⋯ menu pins it or removes it from the list (receipts stay in the ledger). Drag its edge to widen it. */
export default function Sidebar({ runs, activeId, busy, open, width = NAV_WIDTH.initial, settingsOn = false, onResize, onSettings, onNew, onOpenRun, onPin, onDelete }: SidebarProps) {
  const [menu, setMenu] = useState<{ id: string; confirm: boolean; x: number; y: number }>()
  const [drag, setDrag] = useState<number>()
  const start = useRef({ x: 0, width })
  useEffect(() => {
    if (!menu) return
    const close = (event: Event) => { if (!(event.target instanceof Element && event.target.closest('.ra-menu, .ra-nav-more'))) setMenu(undefined) }
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(undefined) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [menu])
  const shown = drag ?? width
  const groups: [string, PastRun[]][] = [['Pinned', runs.filter(run => run.pinned)], ['Today', runs.filter(run => !run.pinned && today(run))], ['Earlier', runs.filter(run => !run.pinned && !today(run))]]
  const row = (run: PastRun) => <li key={run.runId} className={`ra-nav-li${activeId === run.runId ? ' is-on' : ''}`}>
    <button type="button" className="ra-nav-run" onClick={() => onOpenRun(run.runId)} aria-current={activeId === run.runId ? 'page' : undefined} aria-label={`Run: ${run.question}`} title={run.question}>
      <i className={`ra-dot d-${dotOf(run)}`} aria-hidden="true" />{open && <span className="t">{run.question}</span>}
    </button>
    {open && <button type="button" className="ra-nav-more" aria-label={`Options for ${run.question}`} aria-haspopup="menu" aria-expanded={menu?.id === run.runId} onClick={event => { const box = event.currentTarget.getBoundingClientRect(); setMenu(menu?.id === run.runId ? undefined : { id: run.runId, confirm: false, x: box.right, y: box.bottom + 4 }) }}>⋯</button>}
    {menu?.id === run.runId && <div className="ra-menu" role="menu" style={{ left: Math.max(8, menu.x - 200), top: menu.y }}>
      {menu.confirm
        ? <><p>Delete this question?</p><button type="button" role="menuitem" className="ra-menu-danger" onClick={() => { setMenu(undefined); onDelete(run.runId) }}>Delete</button><button type="button" role="menuitem" onClick={() => setMenu(undefined)}>Cancel</button></>
        : <><button type="button" role="menuitem" onClick={() => { setMenu(undefined); onPin(run.runId, !run.pinned) }}>{run.pinned ? 'Unpin' : 'Pin'}</button>
          <button type="button" role="menuitem" className="ra-menu-danger" disabled={!over(run)} title={over(run) ? undefined : 'Finish or stop the run first.'} onClick={() => setMenu({ ...menu, confirm: true })}>Delete…</button></>}
    </div>}
  </li>
  return <nav className={`ra-nav${open ? '' : ' is-rail'}${drag === undefined ? '' : ' is-resizing'}`} aria-label="Questions" style={open ? { '--nav-w': `${shown}px` } as CSSProperties : undefined}>
    <button type="button" className="ra-newq" onClick={onNew} disabled={busy} title={busy ? 'Finish or stop the run first.' : undefined} aria-label="New question"><span aria-hidden="true">+</span>{open && <>New question<kbd>N</kbd></>}</button>
    <div className="ra-nav-list">{groups.filter(([, list]) => list.length).map(([name, list]) => <section key={name}>
      {open && <p className="ra-nav-sec">{name}</p>}<ul>{list.map(row)}</ul>
    </section>)}</div>
    {onSettings && <button type="button" className={`ra-nav-set${settingsOn ? ' is-on' : ''}`} onClick={onSettings} aria-current={settingsOn ? 'page' : undefined} aria-label="Settings" title={open ? undefined : 'Settings'}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>{open && 'Settings'}
    </button>}
    {open && onResize && <div className="ra-nav-resize" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" aria-valuemin={NAV_WIDTH.min} aria-valuemax={NAV_WIDTH.max} aria-valuenow={shown} tabIndex={0}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); start.current = { x: event.clientX, width: shown }; setDrag(shown) }}
      onPointerMove={event => { if (drag !== undefined) setDrag(clamp(start.current.width + event.clientX - start.current.x)) }}
      onPointerUp={() => { if (drag !== undefined) onResize(drag); setDrag(undefined) }}
      onPointerCancel={() => setDrag(undefined)}
      onDoubleClick={() => onResize(NAV_WIDTH.initial)}
      onKeyDown={event => { const step = event.key === 'ArrowRight' ? 16 : event.key === 'ArrowLeft' ? -16 : 0; if (step) { event.preventDefault(); onResize(clamp(shown + step)) } }} />}
  </nav>
}
