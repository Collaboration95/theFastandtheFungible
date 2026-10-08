import type { CSSProperties } from 'react'
import { decisionLabel, type DecisionRound, type RunSnapshot } from '../../shared/contracts/index.js'
import { money, plainVerdict } from '../format'
import WriterChip from './WriterChip'

const pct = (value: number) => `${Math.round(value * 100)}%`

/** What a decision model scored and what policy code did with it, in plain words.
    The full table with every probability and the engine's codes lives in Show work. */
export default function DecisionPanel({ run, fold = false, onWhy }: { run: RunSnapshot; fold?: boolean; onWhy?: () => void }) {
  // Nothing until the first round is scored: the panel appears with the decision.
  if (!run.decisions.length) return null
  return <>{run.decisions.map((round, index) => index === 0 ? (fold ? <FoldedRound key={round.round} run={run} round={round} onWhy={onWhy} /> : <FullRound key={round.round} run={run} round={round} />) : <LaterRound key={round.round} run={run} round={round} />)}</>
}

function FullRound({ run, round }: { run: RunSnapshot; round: DecisionRound }) {
  const scale = Math.max(0.8, ...round.rows.map(row => row.value))
  const order = [...round.rows].sort((a, b) => Number(a.verdict === 'BUY') - Number(b.verdict === 'BUY'))
  return <section className="ra-panel ra-decide" aria-label={`Decision round ${round.round}`}>
    <div className="ra-panel-h"><h2>Worth buying</h2><span className="mono">{decisionLabel(round)}</span></div>
    <div className="ra-gapline"><span>Gap: {round.gap || 'none left open'}</span></div>
    <ul className="ra-rows">{round.rows.map((row, index) => {
      const verdict = plainVerdict(row, run)
      const buy = verdict.tone === 'buy' || verdict.tone === 'would'
      return <li key={`${row.candidate.resourceId}:${row.candidate.version}`} className={`ra-row ${buy ? 'is-buy' : 'is-dim'}`} style={{ '--i': index, '--w': pct(Math.min(1, row.value / scale)), '--s': order.indexOf(row) } as CSSProperties}>
        <span className="ra-row-n" title={row.candidate.title}>{row.candidate.publisher}</span><span className={`ra-price${row.candidate.price.amountMinor > run.perSourceCapMinor ? ' is-over' : ''}`}>{money(row.candidate.price.amountMinor)}</span>
        <span className="ra-bar" role="meter" aria-label={`${row.candidate.publisher} value`} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number(row.value.toFixed(3))}><i /><b className="ra-thr" style={{ left: pct(round.threshold / scale) }} /></span>
        <span className={`ra-stamp s-${verdict.tone}`} title={verdict.why}>{verdict.stamp}</span>
        <WriterChip candidate={row.candidate} reputation={row.reputation} variant="row" />
      </li>
    })}</ul>
  </section>
}

/** T4: once the purchase starts (or the run ends) the round tidies up to what was bought and skipped. */
function FoldedRound({ run, round, onWhy }: { run: RunSnapshot; round: DecisionRound; onWhy?: () => void }) {
  return <section className="ra-panel ra-decide is-fold" aria-label={`Decision round ${round.round}`}>
    <div className="ra-panel-h"><h2>Considered {round.rows.length} paywalled source{round.rows.length === 1 ? '' : 's'}</h2>{onWhy && <button type="button" className="ra-link" onClick={onWhy}>Why these?</button>}</div>
    {/* Gate 5: folded or not, the decision provider stays on screen. */}
    <p className="ra-fold-by mono">{decisionLabel(round)}</p>
    <ul className="ra-mini">{round.rows.map(row => {
      const verdict = plainVerdict(row, run)
      return <li key={`${row.candidate.resourceId}:${row.candidate.version}`} className={verdict.tone === 'buy' || verdict.tone === 'would' ? 'is-buy' : ''}><span className="ra-row-n" title={row.candidate.title}>{row.candidate.publisher}</span><span className={`ra-price${row.candidate.price.amountMinor > run.perSourceCapMinor ? ' is-over' : ''}`}>{money(row.candidate.price.amountMinor)}</span><span className={`ra-stamp s-${verdict.tone}`} title={verdict.why}>{verdict.stamp}</span></li>
    })}</ul>
  </section>
}

function LaterRound({ run, round }: { run: RunSnapshot; round: DecisionRound }) {
  const left = run.budgetMinor - run.spentMinor - run.reservedMinor
  const buys = round.rows.filter(row => row.verdict === 'BUY')
  return <section className="ra-panel ra-decide is-later" aria-label={`Decision round ${round.round}`}>
    <div className="ra-panel-h"><h2>Round {round.round}</h2><span className="mono">{decisionLabel(round)}</span></div>
    <div className="ra-gapline"><span>Gap: {round.gap || 'none left open'}</span></div>
    <ul className="ra-rows is-r2">{round.rows.map((row, index) => {
      const verdict = plainVerdict(row, run)
      return <li key={`${row.candidate.resourceId}:${row.candidate.version}`} className="ra-row" style={{ '--i': index, '--w': pct(row.value) } as CSSProperties}><span className="ra-row-n">{row.candidate.publisher}</span><span className="ra-bar"><i /></span><span className={`ra-stamp s-${verdict.tone}`} title={verdict.why}>{verdict.stamp}</span><WriterChip candidate={row.candidate} reputation={row.reputation} variant="row" /></li>
    })}</ul>
    <p className="ra-r2-msg">{buys.length ? `Buying ${buys.map(row => row.candidate.publisher).join(', ')}.` : `Nothing else worth buying. ${money(Math.max(0, left))} unspent.`}</p>
  </section>
}
