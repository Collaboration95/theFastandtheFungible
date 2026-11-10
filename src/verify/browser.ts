// "Verify on XRPL in your browser": the same TypeScript verifier as `researchagent verify --ledger`, run client-side.
// The receipts come from this run's export; every hash, signature and ledger read is checked here, against a public
// XRPL Testnet node, so the result does not depend on trusting our server. Loaded lazily (its own chunk).
import './install'
import { verifyAnswer, type VerificationCheck, type VerificationResult } from '../../sdk/verify'
import type { Ledger } from '../../shared/xrpl'
import { prepareDecryption } from './shims/node-crypto'

export const LEDGER_ENDPOINTS = ['wss://s.altnet.rippletest.net:51233', 'wss://clio.altnet.rippletest.net:51233'] as const
type Pending = { resolve: (value: { result: Record<string, unknown> }) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }

/** Read-only `tx` lookups over one WebSocket, falling back to the second public node. Nothing is signed or submitted. */
export function browserLedger(endpoints: readonly string[] = LEDGER_ENDPOINTS, Socket: typeof WebSocket = WebSocket, timeoutMs = 8000) {
  let socket: WebSocket | undefined, opening: Promise<WebSocket> | undefined, index = 0, sequence = 0, used = ''
  const pending = new Map<number, Pending>()
  const fail = (error: Error) => { for (const [id, item] of pending) { clearTimeout(item.timer); item.reject(error); pending.delete(id) } }
  const open = (): Promise<WebSocket> => opening ??= (async () => {
    for (; index < endpoints.length; index++) {
      const url = endpoints[index]
      if (!/^wss:\/\/[a-z0-9.-]+\.rippletest\.net(?::\d+)?\/?$/.test(url)) continue // Testnet only, never Mainnet
      try {
        const ws = await new Promise<WebSocket>((resolve, reject) => {
          const candidate = new Socket(url), timer = setTimeout(() => { candidate.close(); reject(new Error('timeout')) }, timeoutMs)
          candidate.addEventListener('open', () => { clearTimeout(timer); resolve(candidate) }, { once: true })
          candidate.addEventListener('error', () => { clearTimeout(timer); reject(new Error('unavailable')) }, { once: true })
        })
        ws.addEventListener('message', event => {
          let body: { id?: number; result?: Record<string, unknown>; error?: string; status?: string }
          try { body = JSON.parse(String(event.data)) } catch { return }
          const item = typeof body.id === 'number' ? pending.get(body.id) : undefined
          if (!item) return
          pending.delete(body.id!); clearTimeout(item.timer)
          if (body.error || body.status === 'error') item.reject(Object.assign(new Error(body.error ?? 'Ledger error'), { data: { error: body.error } }))
          else item.resolve({ result: body.result ?? {} })
        })
        ws.addEventListener('close', () => { socket = undefined; opening = undefined; fail(new Error('Ledger connection closed')) })
        used = new URL(url).hostname
        return socket = ws
      } catch { /* try the next public node */ }
    }
    opening = undefined
    throw new Error('Read-only Testnet lookup unavailable')
  })()
  const ledger: Ledger & { close(): void; endpoint(): string } = {
    async request(request) {
      if (request.command !== 'tx') throw new Error('Only read-only transaction lookups are allowed')
      const ws = socket ?? await open()
      const id = ++sequence
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Ledger timeout')) }, timeoutMs)
        pending.set(id, { resolve, reject, timer })
        ws.send(JSON.stringify({ ...request, id }))
      })
    },
    close() { fail(new Error('closed')); socket?.close(); socket = undefined },
    endpoint: () => used,
  }
  return ledger
}

type KeyRevealProof = { key?: unknown; quote?: { ciphertext?: unknown; terms?: { keyReveal?: { iv?: unknown; tag?: unknown } } } }
/** WebCrypto does the AES-GCM step of each published key before the (synchronous) verifier runs. */
async function prepare(bundle: unknown) {
  const raw = bundle && typeof bundle === 'object' && 'verification' in bundle ? (bundle as { verification: unknown }).verification : bundle
  const proofs = (raw as { proofs?: { keyReveal?: KeyRevealProof }[] } | undefined)?.proofs ?? []
  await Promise.all(proofs.map(({ keyReveal: r }) => {
    const c = r?.quote?.terms?.keyReveal
    return typeof r?.key === 'string' && typeof r.quote?.ciphertext === 'string' && typeof c?.iv === 'string' && typeof c.tag === 'string'
      ? prepareDecryption(r.key, c.iv, c.tag, r.quote.ciphertext) : undefined
  }))
}

export type CheckGroup = { id: string; title: string; status: 'PASS' | 'FAIL' | 'SKIP'; passed: number; total: number; checks: VerificationCheck[] }
const GROUPS: [string, string, (check: string) => boolean][] = [
  ['ledger', 'Transactions found on XRPL Testnet', c => c.startsWith('testnet')],
  ['anchor', 'Answer anchored on XRPL Testnet', c => c === 'audit anchor' || c === 'anchor binding'],
  ['receipts', 'Receipts match quotes, amounts and writers', c => /^(receipt |grant |receipt coverage|origin reservation)/.test(c)],
  ['refunds', 'Refunds match the audit log', c => c.startsWith('refund ') || c.startsWith('key-reveal-proof')],
  ['keys', 'Published keys decrypt the paid articles', c => c.startsWith('key reveal ')],
  ['signatures', 'Writer signatures', c => c.startsWith('manifest ')],
  ['passages', 'Delivered passages match the signed hashes', c => c.startsWith('passages ')],
  ['citations', 'Citations quote real delivered passages', c => c.startsWith('citation')],
  ['audit', 'Audit log hash chain', c => /^(audit chain|audit seq|identities|source binding|contributions|contribution dispatch|legacy dispatch|bundle|version|report)/.test(c)],
  // Not checkable offline: who a writer is needs an online credential lookup. Shown, never counted as passed.
  ['identity', 'Writer identity (needs an online credential check)', c => c === 'writer credentials' || c === 'historical origin'],
]
/** Plain-English groups for the run page; SKIPs (e.g. writer identity, needs an online credential check) stay visible. */
export function groupChecks(checks: VerificationCheck[]): CheckGroup[] {
  const seen = new Set<VerificationCheck>()
  const groups = GROUPS.map(([id, title, match]) => {
    const own = checks.filter(check => !seen.has(check) && match(check.check))
    own.forEach(check => seen.add(check))
    return { id, title, own }
  })
  groups.push({ id: 'other', title: 'Other checks', own: checks.filter(check => !seen.has(check)) })
  return groups.filter(group => group.own.length).map(({ id, title, own }) => ({
    id, title, checks: own, total: own.length, passed: own.filter(check => check.status === 'PASS').length,
    status: own.some(check => check.status === 'FAIL') ? 'FAIL' : own.every(check => check.status === 'SKIP') ? 'SKIP' : 'PASS',
  }))
}

export type BrowserVerification = VerificationResult & { groups: CheckGroup[]; endpoint: string; testnet: boolean; at: string }
export async function verifyInBrowser(bundle: unknown, ledger = browserLedger()): Promise<BrowserVerification> {
  await prepare(bundle)
  const label = String((bundle as { label?: unknown })?.label ?? (bundle as { verification?: { label?: unknown } })?.verification?.label ?? '')
  const testnet = !label.includes('SIMULATED')
  try {
    const result = await verifyAnswer(bundle, { onlineLedger: true, ledger, anchorLookup: async hash => (await ledger.request({ command: 'tx', transaction: hash, binary: false })).result })
    return { ...result, groups: groupChecks(result.checks), endpoint: ledger.endpoint(), testnet, at: new Date().toISOString() }
  } finally { ledger.close() }
}
