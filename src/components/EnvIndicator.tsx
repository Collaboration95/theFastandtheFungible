import { useRef, useState } from 'react'
import type { ModeLabels } from '../../shared/contracts'
import { useDismiss } from '../useDismiss'
import { useClearOfAsk } from '../useClearOfAsk'
import { markEnvironmentSeen as markSeen } from '../environment'
import { ENV, environmentLabel, modelsLabel } from '../../shared/presentation'

const testnetOf = (labels?: ModeLabels) => labels?.settlement.startsWith('XRPL') ?? false

/** The four facts behind the environment label, shared by the header popover and the first-visit note on Home.
    Until the engine answers, payments read as simulated (never assumed real). */
export function EnvFacts({ labels }: { labels?: ModeLabels }) {
  const testnet = testnetOf(labels)
  return <dl><div><dt>Writers</dt><dd>{ENV.writers}. Local: author-labelled.</dd></div><div><dt>Payments</dt><dd>{testnet ? ENV.testnet : ENV.simulatedReceipt}</dd></div><div><dt>Search</dt><dd>{labels?.search?.startsWith('hybrid') ? 'Keyword + meaning' : 'Keyword search only'}</dd></div><div><dt>Models</dt><dd>{labels?.research.startsWith('fixture') ? 'Offline extracts' : labels?.research ?? 'Connecting…'}<br />{labels?.decision.startsWith('fixture') ? 'Offline rules' : labels?.decision ?? 'Connecting…'}</dd></div></dl>
}

/** First visit, empty Home only: the same disclosure as an inline note in the page flow, so it never covers Ask,
    the examples, a result or a payment. "Got it" retires it; the header indicator keeps the details on demand. */
export function EnvNote({ labels, onDone }: { labels?: ModeLabels; onDone: () => void }) {
  const testnet = testnetOf(labels)
  return <section id="environment-details" className="ra-env-note" aria-labelledby="environment-details-title">
    <div className="ra-env-note-head"><h2 id="environment-details-title">What’s real here</h2>
      <p>{!labels ? 'Checking this environment…' : testnet ? 'Test funds have no value. Built-in writers are fictional; local notes carry their own provenance.' : 'Built-in writers are fictional and payments are simulated. Local notes carry their own provenance. No real money moves.'}</p>
      <button type="button" className="ra-btn" onClick={() => { markSeen(); onDone() }}>Got it</button></div>
    {labels?.testnetFallback && <p role="status">Testnet setup unavailable ({labels.testnetFallback.replaceAll('_', ' ')}); running a simulated preview. Retry Testnet setup from the terminal. No ledger transactions are made.</p>}
    <EnvFacts labels={labels} />
  </section>
}

/** The one environment indicator in the header. Its details open on demand, below the Ask button. */
export default function EnvIndicator({ labels }: { labels?: ModeLabels; recording?: boolean }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const testnet = testnetOf(labels)
  const close = () => { setOpen(false); trigger.current?.focus(); markSeen() }
  useDismiss(open, box, close)
  const top = useClearOfAsk(open, trigger)
  return <div className="ra-env" ref={box}>
    <button ref={trigger} className="ra-env-trigger" aria-expanded={open} aria-controls={open ? 'environment-popover' : undefined} onClick={() => { if (open) close(); else setOpen(true) }}><i aria-hidden="true" style={{ background: testnet ? 'var(--ok)' : 'var(--warn)' }} /><span className="ra-env-full">{environmentLabel(labels?.settlement, modelsLabel(labels?.research, labels?.decision))}</span><span className="ra-env-short">{testnet ? ENV.testnetShort : ENV.simulatedShort}</span></button>
    {open && <section id="environment-popover" className="ra-env-pop" style={{ position: 'fixed', top, bottom: 'auto', right: 16, left: 'auto', width: 'min(360px, calc(100vw - 32px))', maxHeight: `calc(100dvh - ${top + 12}px)`, overflow: 'auto' }} aria-label="What’s real here">
      <h2>What’s real here</h2><p>{testnet ? 'Test funds have no value. Built-in writers are fictional; local notes carry their own provenance.' : 'Built-in writers are fictional and payments are simulated. Local notes carry their own provenance. No real money moves.'}</p>
      {labels?.testnetFallback && <p role="status">Testnet setup unavailable ({labels.testnetFallback.replaceAll('_', ' ')}); running a simulated preview. Retry Testnet setup from the terminal. No ledger transactions are made.</p>}
    <EnvFacts labels={labels} />
      <button className="ra-btn" onClick={close}>Got it</button>
    </section>}
  </div>
}
