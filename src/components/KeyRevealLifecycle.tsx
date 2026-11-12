import { useEffect, useId, useRef, useState } from 'react'
import type { EscrowStatus } from '../../shared/contracts/escrow'
import { shortHex, verifyKeyOnLedger, type KeyCheck } from '../verify/key-on-ledger'
import Icon from './Icon'
import { ENV } from '../../shared/presentation'
import LedgerReceipt from './LedgerReceipt'
import './key-check.css'

const EXPLORER = 'https://testnet.xrpl.org/transactions/'
const isHash = (hash?: string): hash is string => Boolean(hash && /^[a-f0-9]{64}$/i.test(hash))
function Tx({ hash }: { hash?: string }) {
  return isHash(hash) ? <a href={`${EXPLORER}${hash}`} target="_blank" rel="noreferrer">tx <Icon name="external" size={16} /></a> : null
}

/** A padlock on the 20-unit grid. Open, its shackle swings up once; closed, nothing moves. */
function KeyLock({ open }: { open?: boolean }) {
  return <svg className={`ra-key-lock${open ? ' is-open' : ''}`} width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 9h12v8H4Z" /><path className="ra-key-shackle" d="M6 9V6a4 4 0 0 1 8 0v3" />
  </svg>
}
const Hex = ({ label, hex }: { label: string; hex?: string }) => hex ? <div><dt>{label}</dt><dd><code>{shortHex(hex)}</code></dd></div> : null

const MISMATCH: Record<Extract<KeyCheck, { status: 'mismatch' }>['why'], string> = {
  key: 'The key the writer published does not hash to the lock on the escrow.',
  lock: 'The writer’s release names a different lock than the escrow was created with.',
  escrow: 'These two transactions are not the same escrow.',
  failed: 'One of the two transactions did not succeed on the ledger.',
}
/** What the browser found. A ✓ appears only for a match; every other state says what was (not) checked. */
export function KeyCheckResult({ check, escrow, replay }: { check: KeyCheck; escrow: Pick<EscrowStatus, 'createHash' | 'finishHash'>; replay?: boolean }) {
  const label = ENV.testnet
  const links = <p className="ra-note">{label}.{replay && <> Fictional writer.</>} <a href={`${EXPLORER}${escrow.finishHash}`} target="_blank" rel="noreferrer">EscrowFinish <Icon name="external" size={16} /></a> · <a href={`${EXPLORER}${escrow.createHash}`} target="_blank" rel="noreferrer">EscrowCreate <Icon name="external" size={16} /></a></p>
  if (check.status === 'match') return <div className="ra-key-check-out is-match">
    <p className="ra-key-check-head"><KeyLock open /> <b>sha256(key) = lock <Icon name="check" size={16} /></b></p>
    <p>Computed in this browser from XRPL Testnet{check.ledger ? ` ledger ${check.ledger}` : ''}{check.node ? `, read from ${check.node}` : ''}.</p>
    <dl className="ra-key-check-hex"><Hex label="Lock (Condition)" hex={check.lock} /><Hex label="Key (Fulfillment)" hex={check.key} /></dl>
    <p className="ra-note">The writer published the key on the public ledger, so anyone can repeat this. Full values are on the explorer.</p>
    {links}
  </div>
  if (check.status === 'mismatch') return <div className="ra-key-check-out is-mismatch">
    <p className="ra-key-check-head"><KeyLock /> <b>Doesn’t match: sha256(key) is not the lock</b></p>
    <p>{MISMATCH[check.why]}</p>
    <dl className="ra-key-check-hex"><Hex label="Lock (Condition)" hex={check.lock} /><Hex label="Key (Fulfillment)" hex={check.key} /></dl>
    {links}
  </div>
  if (check.status === 'pending') return <div className="ra-key-check-out is-pending">
    <p className="ra-key-check-head"><Icon name="clock" size={16} /> <b>{check.why === 'not-found' ? 'Not found on this node yet' : 'Not final on the ledger yet'}</b></p>
    <p>{check.why === 'not-found' ? 'Public Testnet nodes keep a limited history and can lag by a few seconds.' : 'The ledger has not finalised these transactions.'} Try again in a moment, or open the transactions on the explorer.</p>
    {links}
  </div>
  if (check.status === 'unreachable') return <div className="ra-key-check-out is-pending">
    <p className="ra-key-check-head"><Icon name="info" size={16} /> <b>Couldn’t reach a public XRPL node</b></p>
    <p>Nothing was checked. Your connection or the Testnet node may be down; try again in a moment.</p>
  </div>
  return <div className="ra-key-check-out is-pending">
    <p className="ra-key-check-head"><Icon name="info" size={16} /> <b>Couldn’t read this escrow on the ledger</b></p>
    <p>The transactions were found, but the lock or the key is not in the form this check expects, so nothing was claimed.</p>
    {links}
  </div>
}

type LifecycleProps = {
  escrow: EscrowStatus
  /** Only XRPL Testnet runs have public transactions to check. */
  testnet?: boolean
  /** The recorded replay: the writer is fictional. */
  replay?: boolean
  checkOnly?: boolean
  verify?: typeof verifyKeyOnLedger
}
export default function KeyRevealLifecycle(props: LifecycleProps) {
  // A proof belongs to these hashes only. A changed payment remounts the check, including any in-flight lookup.
  return <Lifecycle key={`${props.testnet}:${props.escrow.createHash}:${props.escrow.finishHash}`} {...props} />
}
function Lifecycle({ escrow: e, checkOnly = false, testnet = false, replay = import.meta.env.MODE === 'browser-demo', verify = verifyKeyOnLedger }: LifecycleProps) {
  const [now, setNow] = useState(Date.now)
  const [check, setCheck] = useState<KeyCheck | 'checking'>()
  const id = useId(), alive = useRef(true)
  const pending = !['RELEASED', 'CANCELLED'].includes(e.state)
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [pending])
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  if (e.mode !== 'key-reveal') return null
  const remaining = Math.max(0, Math.ceil((e.cancelAfter + 946684800) - now / 1000))
  const checkable = testnet && e.state !== 'CANCELLED' && isHash(e.createHash) && isHash(e.finishHash)
  const settled = typeof check === 'object' && (check.status === 'match' || check.status === 'mismatch')
  const run = async () => {
    if (!isHash(e.createHash) || !isHash(e.finishHash)) return
    setCheck('checking')
    const result = await verify({ create: e.createHash, finish: e.finishHash }).catch((): KeyCheck => ({ status: 'unreachable' }))
    if (alive.current) setCheck(result)
  }
  return <div className="ra-key-reveal" aria-labelledby={checkOnly ? undefined : id}>
    {!checkOnly && <><p id={id} className="ra-caption">{pending ? "Payment held until the writer releases the key" : e.state === 'CANCELLED' ? 'Funds returned' : 'Payment unlocked by the writer’s key'}</p>
    <ol>
      {e.createHash && <li>{e.state === 'PREPARED' ? 'Locking payment in escrow · awaiting confirmation' : 'Payment locked in escrow'} <Tx hash={e.createHash} /></li>}
      {e.finishHash && <li>Writer released the key <Tx hash={e.finishHash} /></li>}
      {e.keyVerified === true && <li>Recorded check: key matches the escrow lock <Icon name="check" size={16} /></li>}
      {e.decryptVerified === true && <li>Article unlocked <Icon name="check" size={16} /></li>}
      {e.decryptVerified === false && <li>The article couldn’t be unlocked. It won’t be used.</li>}
      {pending && <li>{remaining > 0 ? `Auto-refund available in ${remaining} s if the writer doesn’t release the key` : 'Waiting for the ledger to return your funds'}<small>Funds return only after the ledger confirms cancellation.</small></li>}
      {e.state === 'CANCELLED' && <li>Writer didn’t release the key · funds returned <Tx hash={e.cancelHash} /></li>}
    </ol></>}
    {checkable && <div className="ra-key-check">
      {!settled && <button type="button" className="ra-btn ra-key-check-btn" onClick={() => void run()} disabled={check === 'checking'} aria-describedby={check ? undefined : `${id}-note`}>
        <KeyLock />{check === 'checking' ? 'Checking the ledger…' : check ? 'Check again' : 'Check the key yourself'}
      </button>}
      {!check && <small id={`${id}-note`} className="ra-key-check-hint">Browser key check has not run. Recompute the lock from the public ledger.</small>}
      <div role="status" aria-live="polite">{typeof check === 'object' && <KeyCheckResult check={check} escrow={e} replay={replay} />}</div>
    </div>}
    {!checkOnly && checkable && e.state === 'RELEASED' && <LedgerReceipt create={e.createHash!} finish={e.finishHash!} />}
    {!checkOnly && <details><summary>Technical details</summary>
      <p>{ENV.testnet}</p><p>Key-reveal escrow</p>
      <p>CancelAfter: {e.cancelAfter}. EscrowFinish publishes the key{e.revealLedger ? ` in ledger ${e.revealLedger}` : ''}.</p>
      {e.keyVerified === true && <p>sha256(K) = Condition <Icon name="check" size={16} /></p>}
      {e.decryptVerified === true && <p>ciphertext decrypts <Icon name="check" size={16} /></p>}
    </details>}
  </div>
}
