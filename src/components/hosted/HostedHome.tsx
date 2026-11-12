import { lazy, Suspense, useState, type RefObject, type ReactNode } from 'react'
import { allowanceText, builderLines, canAsk, explorerTx, hostedLinks, HOSTED_DAILY_QUESTIONS, HOSTED_ENDS, JUDGE_RUN, questionCap, minorText, proofLink, waitCopy, type HomeState, type Hosted } from '../../hosted'
import SandboxNumbers from './SandboxNumbers'
const VerifyInBrowser = lazy(() => import('./VerifyInBrowser'))
import { SharedPayer } from '../LedgerCheckEntry'
import './judges-corner.css'

const Out = ({ href, children }: { href: string; children: ReactNode }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}<span className="ra-sr"> (opens in a new tab)</span></a>

/* 20 px geometric icons on one 1.5 px stroke grid. */
const icons = {
  ask: <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.75" y="3.75" width="14.5" height="10" rx="2.5" /><path d="M6.5 13.75v3l3.5-3" /><path d="M6.5 8.75h7" /></svg>,
  pay: <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.25" /><path d="M7 10h6M10.5 7.5 13 10l-2.5 2.5" /></svg>,
  verify: <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.75 16.25 5v4.5c0 3.6-2.6 6.4-6.25 7.75C6.35 15.9 3.75 13.1 3.75 9.5V5L10 2.75z" /><path d="m7.25 9.75 2 2 3.5-3.75" /></svg>,
  key: <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="6.75" cy="10" r="3.5" /><path d="M10.25 10h6.5M14.25 10v2.75M16.75 10v1.75" /></svg>,
  refuse: <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.25" /><path d="m5 15 10-10" /></svg>,
  agent: <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.75" y="3.75" width="14.5" height="12.5" rx="2.5" /><path d="m6.5 8.5 2.5 2-2.5 2M11 12.5h3" /></svg>,
}

/** The first screen: what this is, in about ten seconds, then the visitor's own question. */
export function HostedIntro({ hosted, state }: { hosted: Hosted; state: HomeState }) {
  const testnet = /testnet/i.test(hosted.status.labels.rail) && !/simulat/i.test(hosted.status.labels.rail)
  return <>
    <h1 className="ra-hero ra-hhero">Research with a wallet.</h1>
    <p className="ra-hpromise">{testnet ? 'Paid on delivery. Proven on the ledger.' : 'Receipts you can check.'}</p>
    <p className="ra-home-description ra-hlede">Free sources first. Pay writers for missing evidence, within your budget.</p>
    <ol className="ra-hsteps" aria-label="How it works">
      <li>{icons.ask}<span><b>Ask with a budget</b><small>Up to {minorText(questionCap(hosted.status))} per question</small></span></li>
      <li>{icons.pay}<span><b>It buys only to fill a gap</b><small>One article at a time</small></span></li>
      <li>{icons.verify}<span><b>Verify every receipt</b><small>In your browser</small></span></li>
    </ol>
    <HostedState hosted={hosted} state={state} />
    {!canAsk(state) && <HostedJudgesCorner hosted={hosted} />}
  </>
}

/** Three ways to check our work that cost no question and need no admission, so they work whether the sandbox is ready, busy,
 * paused or closed: a recorded run re-checked in this browser, the key on the public ledger, and (when one is published) a refusal. */
export function HostedJudgesCorner({ hosted, detailsRef }: { hosted: Hosted; detailsRef?: RefObject<HTMLDetailsElement | null> }) {
  const proof = proofLink(hosted)
  const [opened, setOpened] = useState(false)
  return <details ref={detailsRef} className="ra-hwork" onToggle={event => setOpened(event.currentTarget.open)}>
    <summary>Check our work</summary>
    <section className="ra-hjc" aria-label="Check the recorded evidence">
    <p className="ra-hjc-label" aria-hidden="true">Check the recorded evidence</p>
    <p className="ra-note">Uses no question allowance.</p>
    <ul className={proof ? 'ra-hjc-list' : 'ra-hjc-list is-two'}>
      <li className="ra-hjc-verify">{icons.verify}{opened && <div><Suspense fallback={<p role="status">Loading recorded run checks…</p>}><VerifyInBrowser bundleUrl={JUDGE_RUN.bundleUrl} caption={JUDGE_RUN.caption} title="Verify a real run from this demo in your browser" /></Suspense><p className="ra-note">{JUDGE_RUN.summary}</p></div>}</li>
      <li>{icons.key}<div><h2>See the key on the ledger</h2><p>The key is in the transaction’s Fulfillment field.</p><Out href={explorerTx(JUDGE_RUN.keyTx)}>View key-release transaction</Out></div></li>
      {proof && <li>{icons.refuse}<div><h2>See it refuse to spend</h2><p>A question it declined to pay for, S$0.00 spent, anchored on the ledger.</p><Out href={proof}>Open the proof of refusal</Out></div></li>}
    </ul>
    {opened && <SharedPayer />}
    {opened && <SandboxNumbers />}
  </section>
    <HostedFooter hosted={hosted} />
  </details>
}

/** A collapsed row under the examples for the developer who wants this in their own agent: three lines to copy, pinned to a published release. */
export function BuildersCorner({ hosted }: { hosted: Hosted }) {
  const lines = builderLines()
  const proof = proofLink(hosted)
  const rows = [
    { title: 'Add it to Claude Code', note: 'The spending caps are set in this command, not by the model.', text: lines.claude },
    { title: 'Run the whole money path once', note: 'No clone and no account. Measured cold run: 84.2 seconds; 2 of 4 cold runs exceeded 90 seconds (one Mac, 7 Nov). A successful run ends in RESULT PASS.', text: lines.try },
    { title: 'Verify a receipts.json', note: 'Export one from any answer here, then check it against the public ledger.', text: lines.verify },
  ]
  return <details className="ra-hbuild">
    <summary>{icons.agent}<span><b>Use it from your own agent</b><small>Claude Code, a terminal or your own code · {lines.tag}</small></span></summary>
    <ul>{rows.map(row => <li key={row.title}><b>{row.title}</b><small>{row.note}</small><CopyLine label={row.title} text={row.text} /></li>)}</ul>
    <p className="ra-hbuild-foot">Needs Node 22.13 or later.{proof && <> · <Out href={proof}>See a real proof of refusal</Out></>}</p>
  </details>
}

function CopyLine({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* The line above stays selectable. */ }
  }
  return <div className="ra-hcopy">
    <code>{text}</code>
    <button type="button" className="ra-btn" aria-label={`Copy: ${label}`} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
    <span className="ra-sr" role="status">{copied ? 'Copied to the clipboard' : ''}</span>
  </div>
}

/** One clear state when the shared demo can't take a new question. Ready and busy need no card. */
export function HostedState({ hosted, state }: { hosted: Hosted; state: HomeState }) {
  const links = hostedLinks(hosted)
  const walk = <Out href={links.replay}>Watch the recorded walkthrough</Out>
  const card = (tone: 'pause' | 'info' | 'warn', title: string, body: ReactNode, more?: ReactNode) =>
    <section className={`ra-hstate is-${tone}`} role="status" aria-labelledby="ra-hstate-title"><h2 id="ra-hstate-title">{title}</h2><p>{body}</p>{more && <p className="ra-hstate-links">{more}</p>}</section>
  switch (state) {
    case 'paused': return card('pause', 'Paused', 'The shared demo is paused. No new purchases will start. You can still view your receipts or watch the recorded walkthrough.', walk)
    case 'ended': return card('info', 'The live demo has ended', `New questions closed on ${HOSTED_ENDS}. You can still view your receipts for 24 hours, watch the recorded walkthrough or read the source code.`, <>{walk} · <Out href={links.repo}>Source code</Out></>)
    case 'allowance': return card('info', 'You’ve used today’s questions', hosted.status.remaining.questions === 0
      ? `Each visitor gets ${HOSTED_DAILY_QUESTIONS} questions a day on the shared demo; yours reset at 08:00 SGT. Your answers and receipts stay in the sidebar.`
      : `Your test-fund allowance for today is used up; it resets at 08:00 SGT. Your answers and receipts stay in the sidebar.`, walk)
    case 'degraded': return card('warn', 'New questions are on hold', 'A model provider or the payment network isn’t responding right now. This page checks again on its own; your receipts are still available.', walk)
    case 'offline': return card('warn', 'You’re offline', 'Your question and receipts come back when your connection does. Nothing you started is lost.')
    case 'unreachable': return card('warn', 'The demo server isn’t responding', 'This page retries on its own. Payments already started keep settling on the ledger.', walk)
    default: return null
  }
}

/** Under the composer: what this question may use, and what happens to it. */
export function HostedComposerNote({ hosted, state }: { hosted: Hosted; state: HomeState }) {
  return <p className="ra-hnote">
    {state === 'busy' ? <span className="ra-hbusy">The demo is finishing another question; yours starts as soon as it’s free.</span> : <span>{allowanceText(hosted.status)}</span>}
    <span>Questions go to our model providers and are kept for 24 hours. Don’t enter personal or confidential information.</span>
  </p>
}

/** Shown in place of the composer while a run holds the shared demo: another visitor's, or the visitor's own last answer still being anchored. Says which, and for how long. */
export function HostedWaiting({ hosted, onCancel }: { hosted: Hosted; onCancel: () => void }) {
  return <section className="ra-hwait" role="status" aria-label="Waiting for a turn">
    <span className="ra-spin" aria-hidden="true" />
    <div><h2>Waiting for a turn on the shared demo</h2><p>{waitCopy(hosted.status)} Nothing is reserved or spent until then.</p></div>
    <button type="button" className="ra-btn" onClick={onCancel}>Cancel</button>
  </section>
}

export function HostedFooter({ hosted }: { hosted: Hosted }) {
  const links = hostedLinks(hosted)
  return <>
    <BuildersCorner hosted={hosted} />
    <footer className="ra-hfoot" aria-label="About this project">
      <nav aria-label="Project links"><ul>
        <li><Out href={links.repo}>Source code</Out></li>
        <li><Out href={links.deck}>Pitch deck</Out></li>
        {links.video && <li><Out href={links.video}>Demo video</Out></li>}
        <li><Out href={links.progress}>Progress since SingHacks</Out></li>
        <li><Out href={links.keyReveal}>Recorded walkthrough: writer never reveals, money back</Out></li>
        <li><Out href={links.verify}>How to verify a receipt</Out></li>
      </ul></nav>
    </footer>
  </>
}
