import type { ReactNode } from 'react'
import { allowanceText, hostedLinks, HOSTED_DAILY_QUESTIONS, HOSTED_ENDS, HOSTED_QUESTION_MINOR, minorText, type HomeState, type Hosted } from '../../hosted'

const Out = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}<span className="ra-sr"> (opens in a new tab)</span></a>

/* 20 px geometric icons on one 1.5 px stroke grid. */
const icons = {
  ask: <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.75" y="3.75" width="14.5" height="10" rx="2.5" /><path d="M6.5 13.75v3l3.5-3" /><path d="M6.5 8.75h7" /></svg>,
  pay: <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.25" /><path d="M7 10h6M10.5 7.5 13 10l-2.5 2.5" /></svg>,
  verify: <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.75 16.25 5v4.5c0 3.6-2.6 6.4-6.25 7.75C6.35 15.9 3.75 13.1 3.75 9.5V5L10 2.75z" /><path d="m7.25 9.75 2 2 3.5-3.75" /></svg>,
}

/** The first screen: what this is, in about ten seconds, then the visitor's own question. */
export function HostedIntro({ hosted, state }: { hosted: Hosted; state: HomeState }) {
  const testnet = /testnet/i.test(hosted.status.labels.rail) && !/simulat/i.test(hosted.status.labels.rail)
  return <>
    <h1 className="ra-hero ra-hhero">Research with a wallet.</h1>
    <p className="ra-home-description ra-hlede">Ask a question and set a budget. The agent answers from free sources first, then pays writers for missing evidence over x402 {testnet ? 'on XRPL Testnet' : 'with simulated payments'}, never beyond your budget. Every payment comes with a receipt you can verify.</p>
    <ol className="ra-hsteps" aria-label="How it works">
      <li>{icons.ask}<span><b>Ask with a budget</b><small>Up to {minorText(HOSTED_QUESTION_MINOR)} in test funds</small></span></li>
      <li>{icons.pay}<span><b>It buys only what helps</b><small>One article at a time, only to fill a gap</small></span></li>
      <li>{icons.verify}<span><b>Verify every receipt</b><small>{testnet ? 'On XRPL Testnet, in your browser' : 'Signatures and hashes, in your browser'}</small></span></li>
    </ol>
    <HostedState hosted={hosted} state={state} />
  </>
}

/** One clear state when the shared demo can't take a new question. Ready and busy need no card. */
export function HostedState({ hosted, state }: { hosted: Hosted; state: HomeState }) {
  const links = hostedLinks(hosted)
  const walk = <Out href={links.replay}>Watch the recorded walkthrough</Out>
  const card = (tone: 'pause' | 'info' | 'warn', title: string, body: ReactNode, more?: ReactNode) =>
    <section className={`ra-hstate is-${tone}`} role="status" aria-labelledby="ra-hstate-title"><h2 id="ra-hstate-title">{title}</h2><p>{body}</p>{more && <p className="ra-hstate-links">{more}</p>}</section>
  switch (state) {
    case 'paused': return card('pause', 'Paused', 'The shared Testnet demo is paused. No new purchases will start. You can still view your receipts or watch the recorded walkthrough.', walk)
    case 'ended': return card('info', 'The live demo has ended', `New questions closed on ${HOSTED_ENDS}. You can still view your receipts for 24 hours, watch the recorded walkthrough or read the source code.`, <>{walk} · <Out href={links.repo}>Source code</Out></>)
    case 'allowance': return card('info', 'You’ve used today’s questions', hosted.status.remaining.questions === 0
      ? `Each visitor gets ${HOSTED_DAILY_QUESTIONS} questions a day on the shared demo; yours reset at 08:00 SGT. Your answers and receipts stay in the sidebar.`
      : `Your test-fund allowance for today is used up; it resets at 08:00 SGT. Your answers and receipts stay in the sidebar.`, walk)
    case 'degraded': return card('warn', 'New questions are on hold', 'A model provider or the XRPL Testnet isn’t responding right now. This page checks again on its own; your receipts are still available.', walk)
    case 'offline': return card('warn', 'You’re offline', 'Your question and receipts come back when your connection does. Nothing you started is lost.')
    case 'unreachable': return card('warn', 'The demo server isn’t responding', 'This page retries on its own. Payments already started keep settling on the ledger.', walk)
    default: return null
  }
}

/** Under the composer: what this question may use, and what happens to it. */
export function HostedComposerNote({ hosted, state }: { hosted: Hosted; state: HomeState }) {
  return <p className="ra-hnote">
    {state === 'busy' ? <span className="ra-hbusy">Another visitor’s question is running; yours starts as soon as it’s free.</span> : <span>{allowanceText(hosted.status)} · test funds only</span>}
    <span>Questions go to our model providers and are kept for 24 hours. Don’t enter personal or confidential information.</span>
  </p>
}

/** Shown in place of the composer while another visitor's run holds the shared demo. */
export function HostedWaiting({ onCancel }: { onCancel: () => void }) {
  return <section className="ra-hwait" role="status" aria-label="Waiting for a turn">
    <span className="ra-spin" aria-hidden="true" />
    <div><h2>Waiting for a turn on the shared demo</h2><p>Another visitor’s question is running. Yours starts automatically when it’s free; nothing is reserved or spent until then.</p></div>
    <button type="button" className="ra-btn" onClick={onCancel}>Cancel</button>
  </section>
}

export function HostedFooter({ hosted }: { hosted: Hosted }) {
  const links = hostedLinks(hosted)
  return <footer className="ra-hfoot" aria-label="About this project">
    <nav aria-label="Project links"><ul>
      <li><Out href={links.repo}>Source code</Out></li>
      <li><Out href={links.deck}>Pitch deck</Out></li>
      {links.video && <li><Out href={links.video}>Demo video</Out></li>}
      <li><Out href={links.progress}>Progress since SingHacks</Out></li>
      <li><Out href={links.keyReveal}>Recorded walkthrough: key reveal and refund</Out></li>
      <li><Out href={links.verify}>How to verify a receipt</Out></li>
    </ul></nav>
  </footer>
}
