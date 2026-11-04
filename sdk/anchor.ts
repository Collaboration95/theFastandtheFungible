// Fixed Testnet endpoints, read-only tx, no backend or environment configuration.
import WebSocket from 'ws'
import { createHash } from 'node:crypto'
import type { LedgerAnchor } from '../shared/contracts/anchor.js'
export const ANCHOR_ENDPOINTS = ['wss://s.altnet.rippletest.net:51233', 'wss://clio.altnet.rippletest.net:51233']
let active = 0
const waiting: (() => void)[] = []
export async function anchorLookup(hash: string): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve))
  else active++
  try {
    for (const url of ANCHOR_ENDPOINTS) {
      try {
        const result = await new Promise<Record<string, any>>((resolve, reject) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const ws = new WebSocket(url, { maxPayload: 256 * 1024, handshakeTimeout: 5000 })
          const timer = setTimeout(() => { reject(Error('Ledger timeout')); ws.terminate() }, 5000)
          const finish = () => { clearTimeout(timer); ws.terminate() }
          ws.on('open', () => ws.send(JSON.stringify({ id: 'anchor', command: 'tx', transaction: hash, binary: false })))
          ws.on('message', data => { try { const r = JSON.parse(data.toString()); if (r.id !== 'anchor') return; finish(); if (r.error) reject(Error('Transaction unavailable')); else resolve(r.result) } catch { finish(); reject(Error('Invalid ledger response')) } })
          ws.on('error', () => { finish(); reject(Error('Ledger unavailable')) })
          ws.on('close', () => { finish(); reject(Error('Ledger closed')) })
        })
        return result
      } catch { /* bounded Clio fallback */ }
    }
    throw Error('Read-only Testnet lookup unavailable')
  } finally { const next = waiting.shift(); if (next) next(); else active-- }
}
export function checkAnchor(a: LedgerAnchor, runId: string, head: string, r: Record<string, any>): string | undefined { // eslint-disable-line @typescript-eslint/no-explicit-any
  const tx = r.tx_json ?? r
  if (a.head !== head || a.runIdHash !== createHash('sha256').update(runId).digest('hex')) return 'Anchor head or run ID hash mismatch'
  if (r.validated !== true || r.meta?.TransactionResult !== 'tesSUCCESS') return 'Anchor is not validated tesSUCCESS'
  if (tx.Account !== a.account || (tx.hash ?? r.hash)?.toUpperCase() !== a.txHash || r.ledger_index !== a.ledgerIndex || tx.Fee !== a.feeDrops) return 'Anchor account, hash, ledger or fee mismatch'
  if (tx.TransactionType !== 'AccountSet' && !(tx.TransactionType === 'Payment' && tx.Account === tx.Destination && tx.Amount === '1')) return 'Unexpected anchor transaction type'
  const type = Buffer.from('researchagent/anchor-v1').toString('hex').toUpperCase()
  const data = Buffer.from(`${head}:${a.runIdHash}`).toString('hex').toUpperCase()
  if (!Array.isArray(tx.Memos) || tx.Memos.length !== 1 || tx.Memos[0]?.Memo?.MemoType?.toUpperCase() !== type || tx.Memos[0]?.Memo?.MemoData?.toUpperCase() !== data) return 'Anchor memo head mismatch'
}
