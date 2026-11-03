import { sameSource } from '../shared/source-identity.js'
import { XRPL_LABEL, type PurchaseIntent, type RunSnapshot, type TraceEvent } from '../shared/contracts/index.js'
import { candidateOf, money } from './format'
import { isTerminal, runEvents } from './stage'

export type AgentPhase = 'idle' | 'clarifying' | 'planning' | 'searching' | 'deciding' | 'buying' | 'verifying' | 'refunding' | 'writing' | 'done' | 'stopped' | 'failed' | 'recovering'
export type PaymentPhase = 'quoted' | 'approved by policy' | 'submitted' | 'validated' | 'delivered' | 'verified' | 'challenged' | 'refunded' | 'failed' | 'skipped'
const PAYMENT: Record<PurchaseIntent['status'], PaymentPhase> = { DECIDED: 'approved by policy', QUOTED: 'quoted', RESERVED: 'approved by policy', SUBMITTING: 'submitted', SETTLED: 'validated', DELIVERY_PENDING: 'delivered', VERIFIED: 'verified', CLAIM_FAILED: 'challenged', CHALLENGED: 'challenged', REFUNDED: 'refunded', CHALLENGE_REJECTED: 'challenged', CHALLENGE_REFUSED: 'challenged', DELIVERY_FAILED: 'failed', FAILED_NOT_SETTLED: 'failed', SKIPPED: 'skipped' }
const LEVEL: Record<PurchaseIntent['status'], number> = { DECIDED: 0, QUOTED: 1, RESERVED: 2, SUBMITTING: 2, SETTLED: 3, DELIVERY_PENDING: 4, VERIFIED: 5, DELIVERY_FAILED: 3, FAILED_NOT_SETTLED: 2, SKIPPED: 0, CLAIM_FAILED: 4, CHALLENGED: 4, REFUNDED: 4, CHALLENGE_REJECTED: 4, CHALLENGE_REFUSED: 4 }
export const railLabel = (label?: string) => label === XRPL_LABEL ? 'XRPL TESTNET' : 'SIMULATED'
export function purchaseState(run: RunSnapshot, intent: PurchaseIntent) {
  const receipt = run.receipts.find(item => item.intentId === intent.intentId)
  const phase = PAYMENT[intent.status]
  const quarantined = phase === 'challenged' || phase === 'refunded'
  const failed = intent.status === 'DELIVERY_FAILED', notSettled = intent.status === 'FAILED_NOT_SETTLED'
  const ok = phase === 'verified', level = LEVEL[intent.status], amount = money(intent.amountMinor)
  const line = ok ? `Paid ${amount} · delivered · verified` : quarantined ? `Paid ${amount} · delivered · ✗ claim failed` : failed ? `Paid ${amount} · delivery failed` : notSettled ? 'Not settled · nothing charged' : phase === 'skipped' ? 'Skipped · nothing charged' : level >= 4 ? `Paid ${amount} · delivered · checking` : level === 3 ? `Paid ${amount} · checking delivery` : level === 2 ? `Paying ${amount}` : `Quoted ${amount}`
  return { intent, receipt, phase, level, quarantined, failed, notSettled, ok, line,
    title: ok ? 'Bought' : quarantined ? 'Proof failed' : failed ? 'Paid, not delivered' : notSettled || phase === 'skipped' ? 'Not bought' : 'Buying',
    fill: ok || quarantined ? 100 : level >= 4 ? 75 : level >= 3 ? 50 : level >= 2 ? 25 : 0,
    rail: railLabel(run.labels.settlement), ledgerIndex: receipt?.xrpl?.ledgerIndex, txHash: receipt?.xrpl?.txHash,
    explorerUrl: receipt?.xrpl?.explorerUrl, pendingSince: run.events.find(event => event.type === 'PURCHASE' && event.data?.intentId === intent.intentId && event.data?.status === 'SUBMITTING')?.at,
  }
}
const SCOUT_POSE = { idle: 'idle', clarifying: 'clarifying', planning: 'clarifying', searching: 'searching', deciding: 'weighing', buying: 'paying', verifying: 'verifying', refunding: 'caught-a-lie', writing: 'verifying', done: 'done', stopped: 'stopped', failed: 'stopped', recovering: 'verifying' } as const
export function deriveRunState(run?: RunSnapshot, pending?: 'clarify' | 'plan') {
  const purchases = run?.intents.map(intent => purchaseState(run, intent)) ?? []
  const terminal = isTerminal(run)
  const last = run && runEvents(run).at(-1)
  const phase: AgentPhase = pending ? pending === 'clarify' ? 'clarifying' : 'planning' : !run ? 'idle'
    : terminal ? run.stopped || run.phase === 'STOPPED' ? 'stopped' : run.phase === 'FAILED' ? run.intents.some(i => i.status === 'VERIFIED' && (!run.checkpoint?.intentId || i.intentId === run.checkpoint.intentId)) && run.checkpoint?.nextAction === 'retry-delivery' ? 'recovering' : 'failed' : 'done'
    : last && ['CHALLENGE', 'REFUND'].includes(last.type) ? 'refunding'
    : run.phase === 'READ_PAID' || last?.type === 'PROOF' || purchases.some(item => item.phase === 'delivered') ? 'verifying'
    : run.phase === 'BUY' ? 'buying' : run.phase === 'DECIDE' ? 'deciding' : run.phase === 'ANSWER' ? 'writing' : 'searching'
  const inFlight = purchases.filter(item => ['submitted', 'validated', 'delivered'].includes(item.phase))
  const paidUnused = purchases.filter(item => item.receipt && !run?.answers.some(answer => answer.claims.some(claim => claim.citations.some(cite => sameSource(cite, item.intent)))))
  const stopMessage = inFlight.length ? 'No new purchases. A purchase already in flight may still settle.' : paidUnused.length ? 'No new purchases. An earlier payment completed; its source is not used in this answer.' : 'No new purchases will start. Earlier payments remain recorded.'
  const rows = run ? tapeRows(run) : []
  const now = rows.find(row => row.state === 'now' && !QUIET.has(row.kind)) ?? [...rows].reverse().find(row => row.state !== 'todo' && !QUIET.has(row.kind))
  return { phase, scoutPose: SCOUT_POSE[phase], terminal, purchases, payments: run?.receipts.filter(item => item.runId === run.runId) ?? [], rows, now, rail: railLabel(run?.labels.settlement), stopMessage,
    status: phase === 'stopped' ? stopMessage : phase === 'failed' ? run?.error ?? 'Research paused. Last verified answer kept.' : now?.meta ?? (phase === 'idle' ? 'Ready for a question' : phase === 'clarifying' ? 'Choose the research focus' : 'Review the search plan'),
    budgetBlocked: !!run?.decisions.some(round => round.rows.some(row => row.verdict === 'SKIP_OVER_BUDGET')) && !purchases.length,
  }
}

export type TapeState = 'done' | 'now' | 'fail' | 'skip' | 'todo'
export interface TapeRow { key: string; title: string; meta: string; state: TapeState; event?: TraceEvent; kind: string }

// Final-push events (D8, D4, D5, D6): the server's label is the meta line; it never carries premium text.
const NOTES: Record<string, string> = { CLARIFY: 'Clarify', PLAN: 'Plan', MANIFEST_DROPPED: 'Manifest dropped', PROOF: 'Proof check', CHALLENGE: 'Challenge', REFUND: 'Refund', REPUTATION: 'Reputation' }
const noteState = (event: TraceEvent): TapeState => event.type === 'MANIFEST_DROPPED' ? 'skip'
  : (event.type === 'PROOF' && event.data?.ok === false) || (event.type === 'CHALLENGE' && /REJECTED|REFUSED/.test(String(event.data?.status ?? ''))) || (event.type === 'REPUTATION' && event.data?.after && (event.data.after as { status?: string }).status !== 'active') ? 'fail' : 'done'

/** Trust and manifest bookkeeping never become the now-line; the segments still show them. */
const QUIET = new Set(['manifest_dropped', 'reputation'])
/** Proof, challenge, refund and trust updates, and a later round's repeat steps, sit in the bar as slim, unlabelled segments; the now line narrates them. */
export const SUBSTEPS = new Set(['manifest_dropped', 'proof', 'challenge', 'refund', 'reputation'])
/** One segment per step: repeats in a row (a challenge and its outcome, two trust updates) share a segment; a failure wins. */
export const segments = (rows: TapeRow[]) => rows.reduce<TapeRow[]>((list, row) => {
  const last = list.at(-1)
  if (last?.title === row.title) list[list.length - 1] = { ...row, state: last.state === 'fail' ? 'fail' : row.state }
  else list.push(row)
  return list
}, [])

/** The run as steps. Built from the trace, so a second purchase round adds rows. */
export function tapeRows(run: RunSnapshot): TapeRow[] {
  const rows: TapeRow[] = []
  const terminal = isTerminal(run)
  const answers = [...run.answers].sort((a, b) => a.version - b.version)
  let answerN = 0, decideN = 0, buyN = 0
  for (const event of runEvents(run)) {
    const key = `${event.type}-${event.id}`
    const searched = event.type === 'SEARCH' ? rows.find(row => row.kind === 'search') : undefined
    const followed = event.type === 'FOLLOW_UP' ? rows.find(row => row.kind === 'follow_up') : undefined
    // The server's second SEARCH event carries the hit counts: it details the one Search step instead of adding another.
    if (searched) searched.meta = event.label
    // The focused free search (#210): its own row (a SEARCH event would overwrite the first search); the result details it.
    else if (followed) { followed.meta = event.label; if (event.data?.failed) followed.state = 'skip' }
    else if (event.type === 'FOLLOW_UP') rows.push({ key, kind: 'follow_up', event, title: 'Search again', state: 'now', meta: event.label })
    else if (event.type === 'SEARCH') rows.push({ key, kind: 'search', event, title: 'Search', state: 'now', meta: run.candidates.length ? `${run.candidates.length} sources found` : 'Searching…' })
    else if (event.type === 'READ_FREE') {
      const free = run.candidates.filter(item => item.tier === 'FREE').length
      rows.push({ key, kind: 'read', event, title: 'Read free sources', state: 'now', meta: `${free} free · ${run.candidates.length - free} paywalled` })
    } else if (event.type === 'ANSWER') {
      const answer = answers[answerN++]
      const gap = answer?.openGaps[0]?.tags?.[0]?.replace(/-/g, ' ')
      rows.push(answerN === 1
        ? { key, kind: 'answer', event, title: 'Write answer v1', state: 'now', meta: answer ? `${answer.claims.length} cited claims${gap ? ` · gap: ${gap}` : ''}` : 'Writing…' }
        : { key, kind: 'rewrite', event, title: 'Rewrite answer', state: 'now', meta: answer ? `v${answer.version}${run.impact ? ` · ${run.impact.classification.toLowerCase()}` : ''}` : 'Writing…' })
    } else if (event.type === 'DECIDE') {
      const round = run.decisions[decideN++]
      const buys = round?.rows.filter(row => row.verdict === 'BUY').length ?? 0
      const would = round?.rows.filter(row => row.wouldBuy).length ?? 0
      const meta = !round ? 'Scoring paywalled sources…' : run.budgetMinor === 0 && would ? `Would buy ${would} · S$0 budget` : buys ? `${buys} of ${round.rows.length} worth buying` : 'Nothing worth buying'
      rows.push({ key, kind: 'decide', event, title: decideN === 1 ? 'Choose what to buy' : 'Check again', state: 'now', meta })
    } else if (event.type === 'BUY') {
      const intent = run.intents[buyN++]
      const source = intent && candidateOf(run, intent)
      const amount = intent ? money(intent.amountMinor) : ''
      const meta = !intent ? 'Starting a purchase…'
        : intent.status === 'VERIFIED' ? `${source?.publisher ?? intent.resourceId} · ${amount} · proof ✓`
          : intent.status === 'REFUNDED' ? `${source?.publisher ?? intent.resourceId} · ${amount} · proof ✗ · refunded`
            : ['CLAIM_FAILED', 'CHALLENGED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'].includes(intent.status) ? `${source?.publisher ?? intent.resourceId} · ${amount} · proof ✗ · quarantined`
          : intent.status === 'DELIVERY_FAILED' ? 'Paid · delivery failed'
            : intent.status === 'FAILED_NOT_SETTLED' ? 'Not settled · nothing charged'
              : intent.status === 'SETTLED' || intent.status === 'DELIVERY_PENDING' ? `Settled ${amount} · checking delivery…`
                : intent.status === 'RESERVED' || intent.status === 'SUBMITTING' ? `Paying ${amount}` : `Quoted ${amount}`
      rows.push({ key, kind: 'buy', event, title: 'Buy', state: intent?.status === 'VERIFIED' ? 'done' : intent && ['DELIVERY_FAILED', 'FAILED_NOT_SETTLED', 'CLAIM_FAILED', 'CHALLENGED', 'REFUNDED', 'CHALLENGE_REJECTED', 'CHALLENGE_REFUSED'].includes(intent.status) ? 'fail' : 'now', meta })
    } else if (NOTES[event.type]) rows.push({ key, kind: event.type.toLowerCase(), event, title: NOTES[event.type], state: noteState(event), meta: event.label })
    else if (event.type === 'DONE') rows.push({ key, kind: 'done', event, title: 'Done', state: 'done', meta: `${money(run.spentMinor)} of ${money(run.budgetMinor)} spent` })
    else if (event.type === 'STOPPED') rows.push({ key, kind: 'done', event, title: 'Stopped by you', state: 'skip', meta: 'No new purchases. Earlier payments remain recorded.' })
    else if (event.type === 'FAILED') rows.push({ key, kind: 'done', event, title: 'Paused', state: 'fail', meta: run.intents.some(item => item.status === 'DELIVERY_FAILED') ? 'Retry the delivery to continue' : 'Last good answer kept' })
  }
  // Everything before the last row has finished, unless it failed or stays open.
  rows.forEach((row, index) => { if (row.state === 'now' && (index < rows.length - 1 || terminal)) row.state = row.kind === 'buy' ? row.state : 'done' })
  if (!terminal) {
    const has = (kind: string) => rows.some(row => row.kind === kind)
    const todo: [string, string][] = [['search', 'Search'], ['read', 'Read free sources'], ['answer', 'Write answer v1'], ['decide', 'Choose what to buy']]
    if (run.budgetMinor > 0) todo.push(['buy', 'Buy'], ['rewrite', 'Rewrite answer'])
    todo.push(['done', 'Done'])
    for (const [kind, title] of todo) if (!has(kind)) rows.push({ key: `todo-${kind}`, kind, title, meta: '', state: 'todo' })
  }
  return rows
}

