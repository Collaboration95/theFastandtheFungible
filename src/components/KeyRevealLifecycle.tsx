import { useEffect, useState } from 'react'
import type { EscrowStatus } from '../../shared/contracts/escrow'

function Tx({ hash }: { hash?: string }) {
  return hash && /^[a-f0-9]{64}$/i.test(hash) ? <a href={`https://testnet.xrpl.org/transactions/${hash}`} target="_blank" rel="noreferrer">tx ↗</a> : null
}
export default function KeyRevealLifecycle({ escrow: e }: { escrow: EscrowStatus }) {
  const [now, setNow] = useState(Date.now)
  const pending = !['RELEASED', 'CANCELLED'].includes(e.state)
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [pending])
  if (e.mode !== 'key-reveal') return null
  const remaining = Math.max(0, Math.ceil((e.cancelAfter + 946684800) - now / 1000))
  return <section aria-label="Key-reveal escrow" className="ra-key-reveal">
    <small>XRPL Testnet · key-reveal escrow · no real value</small>
    <ol>
      {e.createHash && <li>{e.state === 'PREPARED' ? 'Escrow submitted · awaiting validation' : 'Escrow created'} <Tx hash={e.createHash} /></li>}
      {e.finishHash && <li>Writer published key in ledger {e.revealLedger ?? 'awaiting verification'} <Tx hash={e.finishHash} /></li>}
      {e.keyVerified === true && <li>sha256(K) = Condition ✓</li>}
      {e.decryptVerified === true && <li>ciphertext decrypts ✓</li>}
      {e.decryptVerified === false && <li>Ciphertext verification failed · source quarantined</li>}
      {pending && <li>{remaining > 0 ? `CancelAfter in ${remaining} s` : 'CancelAfter reached · awaiting ledger cancellation'}<small> · Principal returns only after validated cancellation.</small></li>}
      {e.state === 'CANCELLED' && <li>writer didn't publish → cancelled, principal returned <Tx hash={e.cancelHash} /></li>}
    </ol>
  </section>
}
