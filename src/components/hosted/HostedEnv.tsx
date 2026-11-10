import { useRef, useState } from 'react'
import { useDismiss } from '../../useDismiss'
import { useClearOfAsk } from '../../useClearOfAsk'
import { environment, HOSTED_DAILY_QUESTIONS, HOSTED_ENDS, questionCap, minorText, type Hosted } from '../../hosted'

/** The hosted demo's single environment indicator (hard gate 5). Details open on demand; nothing opens by itself. */
export default function HostedEnv({ hosted }: { hosted: Hosted }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = () => { setOpen(false); trigger.current?.focus() }
  useDismiss(open, box, close)
  const top = useClearOfAsk(open, trigger)
  const { status } = hosted
  const env = environment(status, hosted.connection)
  const used = status.remaining.questions === 0 || status.remaining.minor < questionCap(status)
  const tone = env.tone === 'warn' && used ? 'live' : env.tone
  return <div className="ra-env ra-henv" ref={box}>
    <button ref={trigger} className={`ra-env-trigger is-${tone}`} aria-expanded={open} aria-controls="hosted-environment" aria-label={env.full} onClick={() => open ? close() : setOpen(true)}>
      <i aria-hidden="true" /><span className="ra-env-full">{env.full}</span><span className="ra-env-short">{env.short}</span>
    </button>
    {open && <section id="hosted-environment" className="ra-env-pop ra-henv-pop" style={{ position: 'fixed', top, bottom: 'auto', right: 16, left: 'auto', width: 'min(380px, calc(100vw - 32px))', maxHeight: `calc(100dvh - ${top + 12}px)`, overflow: 'auto' }} aria-label="About this demo">
      <h2>{env.testnet ? 'Shared XRPL Testnet demo' : 'Shared demo · simulated payments'}</h2>
      <p>Every visitor shares one sponsor wallet{env.testnet ? ' on the XRPL Testnet' : ''}. Test funds have no real value, and nothing here costs you money.</p>
      <dl>
        <div><dt>Payments</dt><dd>{env.testnet ? 'Paid over x402 on XRPL Testnet. Escrowed articles unlock when the writer publishes the key. Every transaction has a public link.' : 'Simulated: no ledger transactions. Receipts say so.'}</dd></div>
        <div><dt>Models</dt><dd>{env.fixture ? 'Fixture models: offline extracts and rules, labelled on each answer.' : 'Live models plan, judge what to buy and write. If one is unavailable, that answer says so.'}</dd></div>
        <div><dt>Writers</dt><dd>Team-authored XRPL notes and fictional demo writers, labelled on every source.</dd></div>
        <div><dt>Your limits</dt><dd>Up to {minorText(questionCap(status))} of test funds per question, {HOSTED_DAILY_QUESTIONS} questions a day, one at a time. Today: {status.remaining.questions} left.</dd></div>
        <div><dt>Privacy</dt><dd>Questions go to our model providers. Your questions and answers are private to this browser and kept for 24 hours. Don’t enter personal or confidential information.</dd></div>
        <div><dt>Ends</dt><dd>New questions close on {HOSTED_ENDS}. Payments already started still settle.</dd></div>
      </dl>
      <button type="button" className="ra-btn" onClick={close}>Close</button>
    </section>}
  </div>
}
