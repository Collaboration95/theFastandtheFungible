import { lazy, Suspense, useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts'
import { candidateOf } from '../format'
import { PaymentProof } from './PaymentRow'
import { successfulPayment } from '../payment-proof'

const VerifyInBrowser = lazy(() => import('./hosted/VerifyInBrowser'))
const LedgerCheck = lazy(() => import('./LedgerCheck'))

/** Opening a disclosure never runs verification or starts a purchase. Reads mount only on demand. */
export default function SpendingProof({ run }: { run: RunSnapshot }) {
  const [open, setOpen] = useState(false)
  const [factOpen, setFactOpen] = useState(false)
  const finished = ['DONE', 'STOPPED', 'FAILED'].includes(run.phase)
  const replay = import.meta.env.MODE === 'browser-demo'
  return <details className="ra-spending-proof" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Check it yourself</summary>
    {open && <div>
      {run.intents.filter(successfulPayment).map(intent => <section key={intent.intentId} aria-label="Payment proof" className="ra-payment-proof">
        <h3>Payment proof · {candidateOf(run, intent)?.title ?? intent.resourceId}</h3>
        <PaymentProof run={run} intent={intent} />
      </section>)}
      {!replay && finished && <details className="ra-run-proof"><summary>Verify this run</summary>
        <Suspense fallback={<p role="status">Loading run checks…</p>}><VerifyInBrowser run={run} /></Suspense>
      </details>}
      {!replay && finished && run.labels.settlement.startsWith('XRPL') && <PublicFact question={run.question} open={factOpen} onOpen={setFactOpen} />}
    </div>}
  </details>
}

// The small classifier lives with its lazy component; unrelated questions render no subsection.
const Fact = lazy(() => import('./LedgerPublicFact'))
function PublicFact({ question, open, onOpen }: { question: string; open: boolean; onOpen: (open: boolean) => void }) {
  return <Suspense fallback={null}><Fact question={question} open={open} onOpen={onOpen} render={() => <Suspense fallback={<p role="status">Loading public ledger read…</p>}><LedgerCheck question={question} /></Suspense>} /></Suspense>
}
