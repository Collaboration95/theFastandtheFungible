import type { RunSnapshot } from '../../shared/contracts/index.js'
export default function AnchorStatus({ run }: { run: RunSnapshot }) {
  const a = run.ledgerAnchor
  return <p className="ra-caption">{a ? <><a href={`https://testnet.xrpl.org/transactions/${a.txHash}`} target="_blank" rel="noopener noreferrer">Anchored on XRPL · ledger {a.ledgerIndex}</a> · anchor fee {a.feeDrops} drops (Testnet)</> : run.labels.settlement.includes('SIMULATED') ? 'not anchored (simulated)' : 'Not anchored'}</p>
}
