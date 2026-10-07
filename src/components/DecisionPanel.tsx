import type { CSSProperties } from 'react'
import type { DecisionRound, RunSnapshot } from '../../shared/contracts/index.js'
import { money, plainVerdict } from '../format'
import WriterChip from './WriterChip'

const pct = (value: number) => `${Math.round(value * 100)}%`

/** What a decision model scored and what policy code did with it, in plain words.
    The full table with every probability and the engine's codes lives in Show work. */
export default function DecisionPanel({ run, fold = false, onWhy }: { run: RunSnapshot; fold?: boolean; onWhy?: () => void }) {
  if (!run.decisions.length) return <section className="ra-panel is-idle" aria-label="What's worth buying"><div className="ra-panel-h"><h2>What’s worth buying</h2></div>
    <p>A decision model will score the paywalled sources against the gap. Policy code buys only what clears the bar, inside your budget.</p></section>
  return <>{run.decisions.map((round, index) => index === 0 ? (fold ? <FoldedRound key={round.round} run={run} round={round} onWhy={onWhy} /> : <FullRound key={round.round} run={run} round={round} />) : <LaterRound key={round.round} run={run} round={round} />)}</>
}

function FullRound({ run, round }: { run: RunSnapshot; round: DecisionRound }) {
  const scale = Math.max(0.8, ...round.rows.map(row => row.value))
  const order = [...round.rows].sort((a, b) => Number(a.verdict === 'BUY') - Number(b.verdict === 'BUY'))
  return <section className="ra-panel ra-decide" aria-label={`Decision round ${round.round}`}>
    <div className="ra-panel-h"><h2>Round {round.round} · what’s worth buying</h2><span className="mono">{round.provider === 'cloudflare' ? 'Cloudflare' : 'fixture'} · {round.model}</span></div>
    <div className="ra-gapline"><span>Gap: {round.gap || 'none left open'}</span><em>{pct(round.gapMaterial)} material</em></div>
    {round.fallbackReason && <p className="ra-fallback">Fixture substitution: {round.fallbackReason}</p>}
    <div className="ra-axis" aria-hidden="true"><span style={{ left: 0 }}>0</span><span className="thr" style={{ left: pct(round.threshold / scale) }}>bar {round.threshold.toFixed(2)}</span><span style={{ right: 0 }}>value {scale.toFixed(1)}</span></div>
    <ul className="ra-rows">{round.rows.map((row, index) => {
      const verdict = plainVerdict(row, run)
      const buy = verdict.tone === 'buy' || verdict.tone === 'would'
      return <li key={`${row.candidate.resourceId}:${row.candidate.version}`} className={`ra-row ${buy ? 'is-buy' : 'is-dim'}`} style={{ '--i': index, '--w': pct(Math.min(1, row.value / scale)), '--s': order.indexOf(row) } as CSSProperties}>
        <span className="ra-row-n" title={row.candidate.title}>{row.candidate.publisher}</span><span className={`ra-price${row.candidate.price.amountMinor > run.perSourceCapMinor ? ' is-over' : ''}`}>{money(row.candidate.price.amountMinor)}</span>
        <span className="ra-bar" role="meter" aria-label={`${row.candidate.publisher} value`} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number(row.value.toFixed(3))}><i /><b className="ra-thr" style={{ left: pct(round.threshold / scale) }} /></span>
        <span className="ra-probs">covers {pct(row.judgment.addressesGap)} · original {pct(row.judgment.originality.original)} · cred {row.judgment.credibility.toFixed(1)} · value {row.value.toFixed(2)}</span>
        <span className="ra-why">{verdict.why}</span><span className={`ra-stamp s-${verdict.tone}`}>{verdict.stamp}</span>
        <WriterChip candidate={row.candidate} reputation={row.reputation} />
      </li>
    })}</ul>
    <p className="ra-formula">value = gap × covers gap × original × (0.5 + 0.25 × credibility) · buys the best value per S$ above the bar, at most {money(run.perSourceCapMinor)} per source</p>
  </section>
}

/** T4: once the purchase starts (or the run ends) the round tidies up to what was bought and skipped. */
function FoldedRound({ run, round, onWhy }: { run: RunSnapshot; round: DecisionRound; onWhy?: () => void }) {
  return <section className="ra-panel ra-decide is-fold" aria-label={`Decision round ${round.round}`}>
    <div className="ra-panel-h"><h2>Considered {round.rows.length} paywalled source{round.rows.length === 1 ? '' : 's'}</h2>{onWhy && <button type="button" className="ra-link" onClick={onWhy}>Why these?</button>}</div>
    {/* Gate 5: folded or not, the decision provider and any fixture substitution stay on screen. */}
    <p className="ra-fold-by mono">{round.provider === 'cloudflare' ? 'Cloudflare' : 'fixture'} · {round.model}</p>
    {round.fallbackReason && <p className="ra-fallback">Fixture substitution: {round.fallbackReason}</p>}
    <ul className="ra-mini">{round.rows.map(row => {
      const verdict = plainVerdict(row, run)
      return <li key={`${row.candidate.resourceId}:${row.candidate.version}`} className={verdict.tone === 'buy' || verdict.tone === 'would' ? 'is-buy' : ''}><span className="ra-row-n" title={row.candidate.title}>{row.candidate.publisher}</span><span className={`ra-price${row.candidate.price.amountMinor > run.perSourceCapMinor ? ' is-over' : ''}`}>{money(row.candidate.price.amountMinor)}</span><span className={`ra-stamp s-${verdict.tone}`}>{verdict.stamp}</span></li>
    })}</ul>
  </section>
}

function LaterRound({ run, round }: { run: RunSnapshot; round: DecisionRound }) {
  const left = run.budgetMinor - run.spentMinor - run.reservedMinor
  const buys = round.rows.filter(row => row.verdict === 'BUY')
  return <section className="ra-panel ra-decide is-later" aria-label={`Decision round ${round.round}`}>
    <div className="ra-panel-h"><h2>Round {round.round} · anything else?</h2><span className="mono">{round.provider === 'cloudflare' ? 'Cloudflare' : 'fixture'} · {round.model}</span></div>
    <div className="ra-gapline"><span>Gap: {round.gap || 'none left open'}</span><em>{pct(round.gapMaterial)} material</em></div>
    <ul className="ra-rows is-r2">{round.rows.map((row, index) => {
      const verdict = plainVerdict(row, run)
      return <li key={`${row.candidate.resourceId}:${row.candidate.version}`} className="ra-row" style={{ '--i': index, '--w': pct(row.value) } as CSSProperties}><span className="ra-row-n">{row.candidate.publisher}</span><span className="ra-bar"><i /></span><span className={`ra-stamp s-${verdict.tone}`}>{verdict.stamp}</span>{row.verdict === 'SKIP_LOW_TRUST' && <span className="ra-why">{verdict.why}</span>}<WriterChip candidate={row.candidate} reputation={row.reputation} /></li>
    })}</ul>
    <p className="ra-r2-msg">{buys.length ? `Buying ${buys.map(row => row.candidate.publisher).join(', ')}.` : `Nothing clears the bar, so the run stops. ${money(Math.max(0, left))} stays unspent.`}</p>
  </section>
}
