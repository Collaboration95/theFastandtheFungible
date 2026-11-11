import { lazy, Suspense } from 'react'
const Content = lazy(() => import('./LedgerReceiptContent'))
type Props = { create: string; finish: string; read?: typeof import('../ledger-check').readLedgerReceipt }
/** The static replay retains its tx-only policy; hosted/local purchases read the historical reserve. */
export default function LedgerReceipt(props: Props) {
  if (import.meta.env.MODE === 'browser-demo') return null
  return <Suspense fallback={null}><Content {...props} /></Suspense>
}
