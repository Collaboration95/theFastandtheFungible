import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'

type QuestionComposerProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  placeholder: string
  disabled?: boolean
}

/** Shared question entry seam. Submission remains owned by the screen. */
export function QuestionComposer({ value, onChange, onSubmit, placeholder, disabled = false }: QuestionComposerProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!disabled && value.trim()) onSubmit()
  }

  return <form className="composer" onSubmit={submit} noValidate>
    <label className="sr-only" htmlFor="research-question">Research question</label>
    <textarea
      id="research-question"
      className="resize-none"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault()
          submit(event)
        }
      }}
      placeholder={placeholder}
      rows={3}
      disabled={disabled}
      style={{ resize: 'none' }}
    />
    <div className="composer-footer">
      <span>Enter to continue · Shift + Enter for a new line</span>
      <button type="submit" className="send-button" disabled={disabled || !value.trim()} aria-label="Send research question">
        <span aria-hidden="true">↑</span>
      </button>
    </div>
  </form>
}

type StepHeaderProps = {
  kicker: string
  title: string
  description?: string
  summary?: ReactNode
  children?: ReactNode
}

/** Stable heading seam for evidence, plan, and review steps. */
export function StepHeader({ kicker, title, description, summary, children }: StepHeaderProps) {
  return <div className="step-copy evidence-heading">
    <div>
      <span className="kicker">{kicker}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {children}
    </div>
    {summary && <span className="step-summary mono">{summary}</span>}
  </div>
}

type SourceRowProps = {
  selected?: boolean
  children: ReactNode
}

/** Shared row frame keeps source authorization content separate from layout. */
export function SourceRow({ selected = false, children }: SourceRowProps) {
  return <article className={`source-row ${selected ? 'is-selected' : ''}`}>{children}</article>
}

type SourceProfileListProps = {
  children: ReactNode
}

/** Source list seam; filtering and actions remain screen-owned. */
export function SourceProfileList({ children }: SourceProfileListProps) {
  return <div className="source-list">{children}</div>
}

type BudgetSummaryProps = {
  spentLabel: string
  totalLabel: string
  remainingLabel: string
  percent: number
  note: ReactNode
}

/** Shared budget summary presentation. It never authorizes or performs payment. */
export function BudgetSummary({ spentLabel, totalLabel, remainingLabel, percent, note }: BudgetSummaryProps) {
  return <section className="side-card budget-card" aria-label="Research budget summary">
    <div className="side-card-heading"><span className="kicker">Research budget</span><span className="mono">{remainingLabel} left</span></div>
    <div className="budget-number"><strong>{spentLabel}</strong><span>{totalLabel}</span></div>
    <div className="budget-bar" role="progressbar" aria-label="Budget spent" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><i style={{ width: `${percent}%` }} /></div>
    <div className="budget-note">{note}</div>
  </section>
}

type ProgressItem = {
  number: string
  label: string
  detail: string
  state: string
  complete: boolean
}

/** Shared progress path seam used by the activity rail. */
export function ProgressPanel({ items }: { items: ProgressItem[] }) {
  return <ol className="activity-path">
    {items.map((item) => <li key={item.number} className={item.complete ? 'is-complete' : ''}>
      <span className="activity-marker" aria-hidden="true">{item.number}</span>
      <div><strong>{item.label}</strong><small>{item.detail}</small></div>
      <span className="activity-state">{item.state}</span>
    </li>)}
  </ol>
}

/** Shared activity rail frame; event and purchase content stay feature-owned. */
export function ActivityFeed({ children }: { children: ReactNode }) {
  return <aside className="workbench-activity" aria-label="Research activity">{children}</aside>
}

/** Native disclosure preserves keyboard and screen-reader behavior without custom state. */
export function Disclosure({ summary, children, open = false }: { summary: ReactNode; children: ReactNode; open?: boolean }) {
  return <details className="ui-disclosure" open={open}><summary>{summary}</summary><div className="ui-disclosure-content">{children}</div></details>
}

type DrawerProps = {
  kicker: string
  title: string
  onClose: () => void
  closeLabel: string
  children: ReactNode
  busy?: boolean
}

/** Focus-managed evidence drawer shell. Domain-specific evidence stays in App. */
export function EvidenceDrawer({ kicker, title, onClose, closeLabel, children, busy = false }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const previousRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    previousRef.current = document.activeElement as HTMLElement
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); onCloseRef.current() }
      if (event.key !== 'Tab') return
      const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousRef.current?.isConnected) previousRef.current.focus()
    }
  }, [busy])

  return <>
    <button className="drawer-backdrop" type="button" aria-label={closeLabel} onClick={() => { if (!busy) onClose() }} />
    <aside ref={drawerRef} className="evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-head"><div><span className="kicker">{kicker}</span><h2 id="drawer-title">{title}</h2></div><button ref={closeRef} type="button" className="icon-button light" onClick={onClose} disabled={busy} aria-label={closeLabel}><span aria-hidden="true">×</span></button></div>
      <div className="drawer-content">{children}</div>
    </aside>
  </>
}

/** Approval dialog seam; a separate name makes purchase approval explicit. */
export function ApprovalModal({ kicker, title, onCancel, busy, children }: { kicker: string; title: string; onCancel: () => void; busy: boolean; children: ReactNode }) {
  return <EvidenceDrawer kicker={kicker} title={title} onClose={onCancel} closeLabel="Cancel purchase confirmation" busy={busy}>{children}</EvidenceDrawer>
}
