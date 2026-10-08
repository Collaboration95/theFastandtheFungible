import type { CSSProperties } from 'react'

/** `runId` ties a toast to its run, so the app can offer a way back to it from another screen. */
export interface Toast { id: string; tone: '' | 'pen' | 'err' | 'warn' | 'info'; icon: string; title: string; body?: string; actions?: { label: string; onClick: () => void; primary?: boolean }[]; receipt?: boolean; runId?: string }

/** Results, not progress, in one compact row. Newest in front, older ones tuck behind, at most three. */
export default function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const shown = toasts.slice(-3)
  return <div className="ra-toasts" role="region" aria-label="Notifications" aria-live="polite">
    {shown.map((toast, index) => {
      const depth = shown.length - 1 - index
      return <div key={toast.id} className={`ra-toast${toast.tone ? ` t-${toast.tone}` : ''}${toast.receipt ? ' t-rcpt' : ''}`} style={{ '--k': depth, zIndex: 10 - depth } as CSSProperties} role={toast.tone === 'err' ? 'alert' : 'status'}>
        <span className="ra-t-ic" aria-hidden="true">{toast.icon}</span>
        <div className="ra-t-b"><b>{toast.title}</b>{toast.body && <p>{toast.body}</p>}</div>
        {toast.actions?.length && depth === 0 ? <div className="ra-t-acts">{toast.actions.map(action => <button key={action.label} type="button" className={`ra-btn${action.primary ? ' ra-btn-pen' : ''}`} onClick={action.onClick}>{action.label}</button>)}</div> : <span />}
        <button type="button" className="ra-t-x" onClick={() => onDismiss(toast.id)} aria-label={`Dismiss: ${toast.title}`}>×</button>
      </div>
    })}
  </div>
}
