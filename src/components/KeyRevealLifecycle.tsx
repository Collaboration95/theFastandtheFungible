import { useEffect, useId, useState } from 'react'
import type { EscrowStatus } from '../../shared/contracts/escrow'
import Icon from './Icon'

function Tx({ hash }: { hash?: string }) {
  return hash && /^[a-f0-9]{64}$/i.test(hash) ? <a href={`https://testnet.xrpl.org/transactions/${hash}`} target="_blank" rel="noreferrer">tx <Icon name="external" size={16} /></a> : null
}
export default function KeyRevealLifecycle({ escrow: e }: { escrow: EscrowStatus }) {
  const [now, setNow] = useState(Date.now)
  const id = useId()
  const pending = !['RELEASED', 'CANCELLED'].includes(e.state)
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [pending])
  if (e.mode !== 'key-reveal') return null
  const remaining = Math.max(0, Math.ceil((e.cancelAfter + 946684800) - now / 1000))
  return <div className="ra-key-reveal" aria-labelledby={id}>
    <p id={id} className="ra-caption">{pending ? "Payment held until the writer releases the key" : e.state === 'CANCELLED' ? 'Funds returned' : 'Payment unlocked by the writer’s key'}</p>
    <ol>
      {e.createHash && <li>{e.state === 'PREPARED' ? 'Locking payment in escrow · awaiting confirmation' : 'Payment locked in escrow'} <Tx hash={e.createHash} /></li>}
      {e.finishHash && <li>Writer released the key <Tx hash={e.finishHash} /></li>}
      {e.keyVerified === true && <li>Key matches the escrow lock <Icon name="check" size={16} /></li>}
      {e.decryptVerified === true && <li>Article unlocked <Icon name="check" size={16} /></li>}
      {e.decryptVerified === false && <li>The article couldn’t be unlocked. It won’t be used.</li>}
      {pending && <li>{remaining > 0 ? `Auto-refund available in ${remaining} s if the writer doesn’t release the key` : 'Waiting for the ledger to return your funds'}<small>Funds return only after the ledger confirms cancellation.</small></li>}
      {e.state === 'CANCELLED' && <li>Writer didn’t release the key · funds returned <Tx hash={e.cancelHash} /></li>}
    </ol>
    <details><summary>Technical details</summary>
      <p>XRPL Testnet · key-reveal escrow · no real value</p>
      <p>CancelAfter: {e.cancelAfter}. EscrowFinish publishes the key{e.revealLedger ? ` in ledger ${e.revealLedger}` : ''}.</p>
      {e.keyVerified === true && <p>sha256(K) = Condition ✓</p>}
      {e.decryptVerified === true && <p>ciphertext decrypts ✓</p>}
    </details>
  </div>
}
