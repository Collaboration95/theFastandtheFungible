import type { ReactNode } from 'react'
import { ledgerKind } from '../ledger-check'

/** A current public fact is separate from historical purchase evidence. */
export default function LedgerPublicFact({ question, open, onOpen, render }: { question: string; open: boolean; onOpen: (open: boolean) => void; render: () => ReactNode }) {
  if (!ledgerKind(question) || (typeof window !== 'undefined' && Boolean((window as unknown as { desktop?: unknown }).desktop))) return null
  return <details className="ra-public-fact" open={open} onToggle={event => onOpen(event.currentTarget.open)}>
    <summary>Public ledger fact</summary>
    <p className="ra-note">Read-only · not part of the paid answer</p>
    {open && render()}
  </details>
}
