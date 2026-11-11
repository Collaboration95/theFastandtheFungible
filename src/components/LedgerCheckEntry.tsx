import { lazy, Suspense } from 'react'
const Check = lazy(() => import('./LedgerCheck'))
const Payer = lazy(() => import('./LedgerCheck').then(module => ({ default: module.SharedPayer })))
const isDesktop = () => typeof window !== 'undefined' && Boolean((window as unknown as { desktop?: unknown }).desktop)
/** Keep the public-read code out of the initial app bundle and the desktop shell. */
export default function LedgerCheck(props: { question: string }) {
  return isDesktop() ? null : <Suspense fallback={null}><Check {...props} /></Suspense>
}
export function SharedPayer(props: { read?: typeof import('../ledger-check').readPayer }) {
  return isDesktop() ? null : <Suspense fallback={null}><Payer {...props} /></Suspense>
}
