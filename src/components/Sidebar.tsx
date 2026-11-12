import Icon from './Icon'
import { dateSGT } from '../../shared/presentation'
import AgentSprite from './AgentSprite'
/* eslint-disable react-refresh/only-export-components -- NAV_WIDTH bounds are shared with App's saved width. */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { modifier } from '../shortcuts'
import type { PastRun } from '../api'

export const NAV_WIDTH = { min: 200, max: 420, initial: 240 }
const clamp = (width: number) => Math.round(Math.min(NAV_WIDTH.max, Math.max(NAV_WIDTH.min, width)))

export interface SidebarProps {
  onView?: (view: 'run' | 'writers') => void; runs: PastRun[]; activeId?: string; busy: boolean; open: boolean; width?: number; settingsOn?: boolean
  onResize?: (width: number) => void; onSettings?: () => void; /** Phone drawer: a tap on the scrim beside it closes it. */ onClose?: () => void; onNew: () => void; onOpenRun: (runId: string) => void; onPin: (runId: string, pinned: boolean) => void; onDelete: (runId: string) => void
  /** Hosted demo: the list is this visitor's own runs (24 h); Clear hides every finished one. Settings is not offered. */
  hosted?: { onClear: () => Promise<void> | void }
}
const over = (run: PastRun) => run.stopped || ['DONE', 'FAILED', 'STOPPED'].includes(run.phase)
const dotOf = (run: PastRun) => !over(run) ? 'work' : run.phase === 'DONE' ? 'done' : run.phase === 'FAILED' ? 'alert' : 'idle'
const today = (run: PastRun) => !run.at || dateSGT(run.at) === dateSGT(new Date().toISOString())

/** The header button that shows or hides the sidebar: a panel icon, as in Claude's desktop app. */
export function NavToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return <button type="button" className="ra-nav-toggle" onClick={onToggle} aria-expanded={open} aria-label={open ? 'Hide sidebar' : 'Show sidebar'} title={open ? 'Hide sidebar' : 'Show sidebar'}>
    <Icon name="panel" />
  </button>
}

/** The left sidebar: New question and past runs. A run's ⋯ menu pins it or removes it from the list (receipts stay in the ledger). Drag its edge to widen it. */
export default function Sidebar({ onView, runs, activeId, busy, open, width = NAV_WIDTH.initial, settingsOn = false, onResize, onSettings, onClose, onNew, onOpenRun, onPin, onDelete, hosted }: SidebarProps) {
  const [menu, setMenu] = useState<{ id: string; confirm: boolean; x: number; y: number }>()
  const [clearing, setClearing] = useState<'confirm' | 'busy'>()
  const finished = runs.filter(over).length
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
    {open && <button type="button" className="ra-nav-more" aria-label={`Options for ${run.question}`} aria-expanded={menu?.id === run.runId} onClick={event => { const box = event.currentTarget.getBoundingClientRect(); setMenu(menu?.id === run.runId ? undefined : { id: run.runId, confirm: false, x: box.right, y: box.bottom + 4 }) }}><Icon name="more" /></button>}
    {menu?.id === run.runId && <div className="ra-menu" role="group" aria-label="Question actions" style={{ left: Math.max(8, menu.x - 200), top: menu.y }}>
      {menu.confirm
        ? <><p>Delete this question?</p><button type="button" className="ra-menu-danger" onClick={() => { setMenu(undefined); onDelete(run.runId) }}>Delete</button><button type="button" onClick={() => setMenu(undefined)}>Cancel</button></>
        : <><button type="button" onClick={() => { setMenu(undefined); onPin(run.runId, !run.pinned) }}>{run.pinned ? 'Unpin' : 'Pin'}</button>
          <button type="button" className="ra-menu-danger" disabled={!over(run)} title={over(run) ? undefined : 'Finish or stop the run first.'} onClick={() => setMenu({ ...menu, confirm: true })}>Delete…</button></>}
    </div>}
  </li>
  return <>{open && onClose && <button type="button" className="ra-nav-scrim" aria-label="Close sidebar" tabIndex={-1} onClick={onClose} />}<nav className={`ra-nav${open ? '' : ' is-rail'}${drag === undefined ? '' : ' is-resizing'}`} aria-label="Questions" style={open ? { '--nav-w': `${shown}px` } as CSSProperties : undefined}>
    <button type="button" className="ra-newq" onClick={onNew} disabled={busy} title={busy ? 'Finish or stop the run first.' : undefined} aria-label="New question"><Icon name="plus" />{open && <>New question<kbd>{modifier}N</kbd></>}</button>
    {open && onView && <div className="ra-mobile-views"><button type="button" className="ra-link" onClick={() => onView('run')}>Run</button><button type="button" className="ra-link" onClick={() => onView('writers')}>Writers</button></div>}
    {open && <div className="ra-nav-list">{runs.length === 0 && open && <div className="ra-nav-empty">{hosted && <AgentSprite animation="idle" still />} <p>{hosted ? 'Your questions appear here. They’re private to this browser and kept for 24 hours.' : 'Ask a question to start your research.'}</p></div>}{groups.filter(([, list]) => list.length).map(([name, list]) => <section key={name}>
      {open && <p className="ra-nav-sec">{name}</p>}<ul>{list.map(row)}</ul>
    </section>)}</div>}
    {open && hosted && finished > 0 && <div className="ra-nav-clear">{clearing === undefined
      ? <button type="button" className="ra-link" onClick={() => setClearing('confirm')}>Clear my history</button>
      : <div role="group" aria-label="Clear my history"><p>Hide your {finished} finished question{finished === 1 ? '' : 's'}? Payment records stay until each payment is settled.</p>
        <button type="button" className="ra-btn ra-menu-danger" disabled={clearing === 'busy'} onClick={async () => { setClearing('busy'); try { await hosted.onClear() } finally { setClearing(undefined) } }}>Clear</button>
        <button type="button" className="ra-btn" disabled={clearing === 'busy'} onClick={() => setClearing(undefined)}>Cancel</button></div>}</div>}
    {open && onSettings && <button type="button" className={`ra-nav-set${settingsOn ? ' is-on' : ''}`} onClick={onSettings} aria-current={settingsOn ? 'page' : undefined} aria-label="Settings" title={open ? undefined : 'Settings'}>
      <Icon name="settings" />{open && 'Settings'}
    </button>}
    {open && onResize && <div className="ra-nav-resize" role="separator" aria-orientation="vertical" aria-label="Resize sidebar" aria-valuemin={NAV_WIDTH.min} aria-valuemax={NAV_WIDTH.max} aria-valuenow={shown} tabIndex={0}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); start.current = { x: event.clientX, width: shown }; setDrag(shown) }}
      onPointerMove={event => { if (drag !== undefined) setDrag(clamp(start.current.width + event.clientX - start.current.x)) }}
      onPointerUp={() => { if (drag !== undefined) onResize(drag); setDrag(undefined) }}
      onPointerCancel={() => setDrag(undefined)}
      onDoubleClick={() => onResize(NAV_WIDTH.initial)}
      onKeyDown={event => { const step = event.key === 'ArrowRight' ? 16 : event.key === 'ArrowLeft' ? -16 : 0; if (step) { event.preventDefault(); onResize(clamp(shown + step)) } }} />}
  </nav></>
}
