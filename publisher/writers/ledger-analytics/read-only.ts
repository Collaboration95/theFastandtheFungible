/** This client deliberately has no signing, submit, simulate, or arbitrary-origin API. */
export type Network = 'mainnet' | 'testnet'
export type RpcResult = Record<string, unknown>
export type ReadLedger = (command: string, params?: RpcResult) => Promise<RpcResult>
const endpoints = { mainnet:'https://s1.ripple.com:51234/', testnet:'https://s.altnet.rippletest.net:51234/' }
const commands = new Set(['ledger','account_lines','account_info','account_tx','amm_info','ledger_data'])
const tails: Record<Network,Promise<unknown>> = {mainnet:Promise.resolve(),testnet:Promise.resolve()}
export function publicLedger(network: Network, call: typeof fetch = fetch, signal?: AbortSignal): ReadLedger {
  return (command, params = {}) => {
    if (!commands.has(command) || 'tx_blob' in params || 'secret' in params || 'seed' in params) return Promise.reject(new Error('Only public ledger reads are permitted'))
    const request = tails[network].then(async () => {
      for (let attempt=0; attempt<3; attempt++) {
        signal?.throwIfAborted()
        const response = await call(endpoints[network], {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({method:command,params:[params]}), signal:AbortSignal.any([AbortSignal.timeout(20_000),...(signal?[signal]:[])])})
        if ((response.status===429 || response.status>=500) && attempt<2) { await new Promise(resolve=>setTimeout(resolve,500*(attempt+1))); continue }
        if (!response.ok) throw Error(`Public ledger read HTTP ${response.status}`)
        const json = await response.json() as {result:RpcResult}
        if (['tooBusy','slowDown','noNetwork','notSynced'].includes(String(json.result?.error)) && attempt<2) { await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1))); continue }
        if (!json.result || json.result.status === 'error' || json.result.error) throw Error(`Public ledger read rejected: ${String(json.result?.error ?? 'invalid response')}`)
        return json.result
      }
      throw Error('Public ledger read unavailable')
    })
    tails[network] = request.catch(()=>undefined); return request
  }
}
export type LedgerStamp = { network:Network; ledgerIndex:number; ledgerHash:string; computedAt:string; maxLedgerLag:number }
export async function validatedHeader(read: ReadLedger) {
  const result = await read('ledger',{ledger_index:'validated'})
  if (result.validated !== true || !Number.isSafeInteger(Number(result.ledger_index)) || !/^[A-F0-9]{64}$/.test(String(result.ledger_hash))) throw Error('Validated ledger header required')
  return {ledgerIndex:Number(result.ledger_index), ledgerHash:String(result.ledger_hash)}
}
