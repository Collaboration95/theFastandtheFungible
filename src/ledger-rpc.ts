/** A separate read-only client: the receipt verifier's command policy is unchanged. */
export const PUBLIC_LEDGER_ENDPOINTS = ['wss://s.altnet.rippletest.net:51233', 'wss://clio.altnet.rippletest.net:51233'] as const
export type Rpc = (request: Record<string, unknown>) => Promise<Record<string, unknown>>
const READS = new Set(['ledger', 'ledger_entry', 'account_info', 'account_objects', 'tx'])
export const FEES_INDEX = '4BC50C9B0D8515D3EAAE1E74B29A95804346C491EE1A95BF25E4AAB854A6A651'
/** One bounded socket per read; no signing, simulation or submission commands. */
export async function publicRead(request: Record<string, unknown>, endpoints: readonly string[] = PUBLIC_LEDGER_ENDPOINTS): Promise<Record<string, unknown>> {
  if (!READS.has(String(request.command))) throw new Error('Read-only command required')
  for (const endpoint of endpoints) {
    if (!(PUBLIC_LEDGER_ENDPOINTS as readonly string[]).includes(endpoint)) throw new Error('Public Testnet node required')
    try {
      return await new Promise((resolve, reject) => {
        const socket = new WebSocket(endpoint)
        const done = (error?: Error, result?: Record<string, unknown>) => {
          clearTimeout(timer); socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null; socket.close()
          if (error) reject(error); else resolve(result!)
        }
        const timer = setTimeout(() => done(new Error('Public ledger timed out')), 8000)
        socket.onopen = () => socket.send(JSON.stringify({ ...request, id: 'read-only' }))
        socket.onerror = socket.onclose = () => done(new Error('Public ledger unavailable'))
        socket.onmessage = event => {
          try {
            const body = JSON.parse(String(event.data))
            if (body.id !== 'read-only') return
            if (body.status !== 'success' || !body.result || body.result.error) throw new Error('Ledger result unavailable')
            done(undefined, body.result)
          } catch { done(new Error('Ledger result unavailable')) }
        }
      })
    } catch { /* The second allowed public node may have the requested history. */ }
  }
  throw new Error('Public ledger unavailable')
}
