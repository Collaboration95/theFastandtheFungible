import { sameSource, sourceKey } from '../../shared/source-identity.js'
import { decisionLabel, type RunSnapshot } from '../../shared/contracts/index.js'
import { money } from '../format'

/** The readable decision table; full scores remain in Show work / Policy. */
export default function WhyThisArticle({ run }: { run: RunSnapshot; fold?: boolean; onWhy?: () => void }) {
  return <>{run.decisions.map(round => <section key={round.round} aria-label={`Decision round ${round.round}`}><p className="ra-note">Decided by {round.provider === 'fixture' ? 'Offline rules' : decisionLabel(round)}</p><table className="ra-why-table"><thead><tr><th>Article</th><th>Writer</th><th>Price</th><th>Decision</th></tr></thead><tbody>{round.rows.map(row => {
    const intent = run.intents.find(i => sameSource(i,row.candidate))
    const verdict = intent?.status === 'REFUNDED' ? 'Refunded' : intent?.status === 'VERIFIED' ? 'Bought' : row.wouldBuy && run.budgetMinor === 0 ? 'Would buy' : ({ BUY: 'Selected', SKIP_OVER_CAP: 'Too expensive', SKIP_OVER_BUDGET: 'Over budget', SKIP_LOW_TRUST: 'Writer blocked', SKIP_DUPLICATE: 'Duplicate', SKIP_REWRITE: 'Duplicate' } as Record<string,string>)[row.verdict] ?? 'Not relevant'
    return <tr key={sourceKey(row.candidate)}><td>{row.candidate.title}</td><td>{row.candidate.publisher}</td><td>{money(row.candidate.price.amountMinor)}</td><td>{verdict}</td></tr>
  })}</tbody></table></section>)}</>
}
