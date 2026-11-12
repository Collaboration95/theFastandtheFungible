import { useEffect, useState } from 'react'
import { Client, Wallet, type DelegateSet } from 'xrpl'
import { sign } from 'ripple-keypairs'
import { walletRequest } from '../api'

const key = 'researchagent.Testnet.wallet.v1'
const endpoint = 'wss://s.altnet.rippletest.net:51233'
type Status = { enabled: boolean; agent?: string; address?: string }
/** This entire component and xrpl.js are loaded only when own-wallet mode is enabled. */
export default function DelegatedWallet({ onReady }: { onReady: (ready: boolean) => void }) {
  const [status, setStatus] = useState<Status>(), [address, setAddress] = useState(''), [seed, setSeed] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { void walletRequest<Status>('/api/wallet/delegation').then(async s => {
    let local = ''
    try { const saved = JSON.parse(localStorage.getItem(key) ?? '{}'); if (saved.network === 'Testnet') local = Wallet.fromSeed(saved.seed).address } catch { /* no usable local key */ }
    if (s.address && s.address !== local) { await walletRequest('/api/wallet/delegation/disconnect', {}); s = { ...s, address: undefined } }
    setAddress(local); setStatus(s)
  }).catch(() => setError('Wallet status is unavailable.')) }, [])
  useEffect(() => { onReady(Boolean(status?.address)) }, [status?.address, onReady])
  const act = async (revoke = false) => {
    setBusy(true); setError(''); const client = new Client(endpoint)
    try {
      if (!status?.agent) throw Error()
      let wallet: Wallet
      if (revoke || address) { const saved = JSON.parse(localStorage.getItem(key) ?? '{}'); if (saved.network !== 'Testnet') throw Error(); wallet = Wallet.fromSeed(saved.seed) }
      else { wallet = seed.trim() ? Wallet.fromSeed(seed.trim()) : Wallet.generate(); localStorage.setItem(key, JSON.stringify({ network: 'Testnet', seed: wallet.seed })); setSeed(''); setAddress(wallet.address) }
      await client.connect()
      if ((await client.request({ command: 'server_info' })).result.info.network_id !== 1) throw Error()
      if (!revoke) { try { await client.request({ command: 'account_info', account: wallet.address, ledger_index: 'validated' }) } catch (e) { if ((e as { data?: { error?: string } }).data?.error !== 'actNotFound') throw e; await client.fundWallet(wallet) } }
      const tx = await client.autofill<DelegateSet>({ TransactionType: 'DelegateSet', Account: wallet.address, Authorize: status.agent, Permissions: revoke ? [] : [{ Permission: { PermissionValue: 'EscrowCreate' } }] })
      if (Number(tx.Fee) > 2000) throw Error()
      const result = (await client.submitAndWait(wallet.sign(tx).tx_blob)).result
      if (typeof result.meta !== 'object' || result.meta.TransactionResult !== 'tesSUCCESS') throw Error()
      if (revoke) { await walletRequest('/api/wallet/delegation/disconnect', {}); setStatus({ ...status, address: undefined }) }
      else {
        const { message } = await walletRequest<{ message: string }>('/api/wallet/delegation/challenge', {})
        await walletRequest('/api/wallet/delegation/connect', { address: wallet.address, publicKey: wallet.publicKey, signature: sign(message, wallet.privateKey) })
        setStatus({ ...status, address: wallet.address })
      }
    } catch { setError(revoke ? 'Revocation was not confirmed. Check the ledger before retrying.' : 'Wallet connection was not confirmed. Your saved key remains in this browser.') }
    finally { await client.disconnect().catch(() => {}); setBusy(false) }
  }
  return <section aria-label="Your wallet" className="ra-banner">
    <strong>Your wallet</strong>
    <p>The key stays in this browser. The agent can create escrows within your question budget. You can revoke access at any time.</p>
    {address ? <p style={{ overflowWrap: 'anywhere' }}>{address} · {status?.address ? 'Connected' : 'Access not connected'}</p> : <label>Import a Testnet seed (optional)<input type="password" autoComplete="off" value={seed} onChange={e => setSeed(e.target.value)} /></label>}
    {!status?.address && <button className="ra-btn" disabled={busy || !status} onClick={() => void act()}>{busy ? 'Working…' : status?.address ? 'Reconnect' : address ? 'Connect saved wallet' : 'Create or import wallet'}</button>}
    {address && <button className="ra-btn" disabled={busy || !status} onClick={() => void act(true)}>Revoke</button>}
    {error && <p role="alert">{error}</p>}
  </section>
}
