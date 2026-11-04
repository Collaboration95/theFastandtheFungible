import { useState } from 'react'
import type { RunSnapshot } from '../../shared/contracts/index.js'
/** A Testnet run anchors its audit head a few seconds after it ends; an old run without an anchor says why instead of claiming one is coming. */
export default function AnchorStatus({ run }: { run: RunSnapshot }) {
  const a = run.ledgerAnchor
  const [now] = useState(Date.now)
  const recent = now - Date.parse(run.events.at(-1)?.at ?? '') < 90_000
  return <p className="ra-caption">{a ? <><a href={`https://testnet.xrpl.org/transactions/${a.txHash}`} target="_blank" rel="noopener noreferrer">Anchored on XRPL · ledger {a.ledgerIndex}</a> · anchor fee {a.feeDrops} drops (Testnet)</> : run.labels.settlement.includes('SIMULATED') ? 'not anchored (simulated)' : recent ? 'Anchoring…' : 'No anchor recorded for this Testnet run (anchoring was off or unavailable)'}</p>
}
