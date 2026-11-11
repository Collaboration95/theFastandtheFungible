// Hosted judge demo: everything the UI derives from the server's `GET /api/demo/status`. Local and desktop never set it.
import { createContext, useContext } from 'react'
import { ApiError, type HostedDemoStatus } from './api'

export type Hosted = { status: HostedDemoStatus; connection?: 'offline' | 'unreachable' }
export const HostedContext = createContext<Hosted | undefined>(undefined)
export const useHosted = () => useContext(HostedContext)

/** The gateway owns this cap; an absent value permits only a free question. */
export const questionCap = (status: HostedDemoStatus) => status.questionCapMinor ?? 0
export const HOSTED_DAILY_QUESTIONS = 5
export const HOSTED_ENDS = '20 November, 00:00 SGT'

export type HomeState = 'ready' | 'busy' | 'allowance' | 'paused' | 'ended' | 'degraded' | 'offline' | 'unreachable'
/** The one state the Home screen shows. Allowance first: the gateway reports a used-up visitor as `degraded`. */
export function homeState(hosted: Hosted): HomeState {
  const { status, connection } = hosted
  if (status.state === 'ended') return 'ended'
  if (connection) return connection
  if (status.state === 'paused') return 'paused'
  if (status.remaining.questions === 0 || status.remaining.minor < questionCap(status)) return 'allowance'
  if (status.state === 'degraded') return 'degraded'
  if (status.state === 'busy' || !status.capabilities.ask) return 'busy'
  return 'ready'
}
export const canAsk = (state: HomeState) => state === 'ready' || state === 'busy'

/** The single environment indicator (hard gate 5). The server's labels decide fixture vs live and Testnet vs simulated. */
export function environment(status: HostedDemoStatus, connection?: Hosted['connection']) {
  const testnet = /testnet/i.test(status.labels.rail) && !/simulat/i.test(status.labels.rail)
  // Everything offline, or (11 Nov) live answers with the fixture decision model choosing what to buy.
  const fixture = /^fixture models|unavailable/i.test(status.labels.models)
  const ruleBuying = !fixture && /fixture purchase decisions/i.test(status.labels.models)
  const models = fixture ? 'fixture models' : ruleBuying ? 'live answers, rule-based buying' : 'live models'
  const place = testnet ? 'Shared XRPL Testnet demo' : 'Shared demo · simulated payments'
  // The phone chip is the same chip, shortened: the same two facts (which rail, no real value), never a second name.
  const kind = testnet ? 'Testnet demo' : 'Simulated'
  const state = status.state === 'ended' ? 'ended' : connection === 'offline' ? 'offline' : status.state === 'paused' ? 'paused' : undefined
  return {
    testnet, fixture, ruleBuying, state,
    full: `${place} · ${state ?? models} · no real value`,
    short: `${kind} · ${state ?? 'no real value'}`,
    tone: state ? 'off' : status.state === 'degraded' ? 'warn' : 'live',
  } as const
}

/** Who a visitor is waiting for, and for how long. Plain facts, no blame: a first-time visitor is told about another visitor, a returning one
 * about their own last question; the demo runs one question at a time and a run takes about 20 to 55 seconds. */
export function waitCopy(status: HostedDemoStatus): string {
  const { ahead = 0, own = false } = status.wait ?? {}
  if (own) return 'Your previous question is still being finished: its record is being written to the ledger. Yours starts right after, usually within a minute.'
  if (ahead <= 0) return 'Yours starts automatically in a moment.'
  return `${ahead === 1 ? 'Another visitor’s question is' : `${ahead} other visitors’ questions are`} ahead of yours. ${ahead === 1 ? 'That usually takes under a minute' : 'That usually takes a minute or two'}, and yours starts automatically.`
}
/** The waiting card on a queued run: how many questions are ahead of it. */
export const aheadText = (ahead: number) => ahead === 1 ? '1 question ahead of yours' : `${ahead} questions ahead of yours`

export const minorText = (minor: number) => `S$${(minor / 100).toFixed(2)}`
export function allowanceText(status: HostedDemoStatus) {
  const { questions } = status.remaining
  return questions === 0 ? 'No questions left today' : `${questions} of ${HOSTED_DAILY_QUESTIONS} questions left today`
}

/** What a refused hosted request means for the visitor. Codes only; never a server body. */
export type Refusal = { kind: 'wait' | 'state' | 'retry-new-key' | 'message'; text: string }
export function refusal(error: unknown): Refusal {
  if (!(error instanceof ApiError)) return typeof navigator !== 'undefined' && navigator.onLine === false
    ? { kind: 'message', text: 'You’re offline. Your question is still here; ask again when you’re back online.' }
    : { kind: 'message', text: 'The demo server didn’t answer. Your question is still here; try again in a moment.' }
  switch (error.code) {
    case 'busy': case 'queue_full': return { kind: 'wait', text: 'The shared demo is finishing another question.' }
    case 'session_busy': return { kind: 'message', text: 'One question at a time. Your previous question is still running; ask again when it finishes.' }
    case 'allowance_exhausted': return { kind: 'state', text: 'You’ve used today’s questions on the shared demo.' }
    case 'paused': case 'spending_paused': case 'ended': case 'demo_unavailable': return { kind: 'state', text: '' }
    case 'start_rate': return { kind: 'message', text: 'Several questions started from your network in the last minute. Try again in a minute.' }
    case 'model_daily_cap': return { kind: 'message', text: 'The demo has reached today’s model allowance. New questions open again after 08:00 SGT.' }
    case 'model_lifetime_cap': return { kind: 'message', text: 'The demo’s model allowance for this event is used up. You can still view your receipts or watch the recorded walkthrough.' }
    case 'queue_expired': return { kind: 'message', text: 'Your question waited 90 seconds without a free turn, so it was released. Nothing was charged. Ask again.' }
    case 'private_input': return { kind: 'message', text: 'That looks like an email address, a key or a token. Remove personal or secret details and ask again.' }
    case 'idempotency_conflict': return { kind: 'retry-new-key', text: 'This question changed after it was planned. Ask it again.' }
    case 'scope_in_progress': return { kind: 'message', text: 'Still planning this question. Try again in a few seconds.' }
    case 'invalid_budget': return { kind: 'message', text: 'Choose a budget within the current per-question limit.' }
    case 'session_limit': return { kind: 'message', text: 'The demo is at visitor capacity. Try again in a few minutes.' }
    case 'csrf_denied': case 'origin_denied': return { kind: 'message', text: 'Your demo session expired. Reload the page to start a new one; your receipts stay with the old session for 24 hours.' }
  }
  if (error.status === 413) return { kind: 'message', text: 'That question is too long. Keep it under 2,000 characters.' }
  if (error.status === 400) return { kind: 'message', text: 'Type a question first. Up to 2,000 characters.' }
  if (error.status === 429) return { kind: 'wait', text: 'The shared demo is busy.' }
  if (error.status >= 500) return { kind: 'message', text: 'The research service hit a problem and nothing was charged. Try again in a moment.' }
  return { kind: 'message', text: 'That request didn’t go through. Nothing was charged. Try again.' }
}

const PAGES = 'https://collaboration95.github.io/theFastandtheFungible'
/** Public links, from the server where it has them. An unconfigured link (the video until it exists) is not shown. */
export function hostedLinks(hosted: Hosted) {
  const { links } = hosted.status
  const replay = links.replay || `${PAGES}/demo/`
  return {
    repo: links.repo, replay,
    keyReveal: `${replay}${replay.includes('?') ? '&' : '?'}scenario=UC-key-reveal`,
    deck: links.deck || 'https://github.com/Collaboration95/theFastandtheFungible/blob/main/docs/submission/ResearchAgent-SFF-deck.pdf',
    video: links.video,
    progress: links.progress || `${PAGES}/progress/`,
    // The README's "Verify it yourself": recorded Testnet transactions, the one-line verifier and the ledger check. receipt-spec.md is the wire-format spec, not a how-to.
    verify: `${links.repo}#verify-it-yourself`,
  }
}
