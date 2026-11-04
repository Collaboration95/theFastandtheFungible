import { it, expect, vi } from 'vitest'
import { mkdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { isolatedEnv, prepare, provision, FAUCET } from '../scripts/testnet-wallets.js'
import { testnetUrl, TESTNET_WSS } from '../shared/xrpl.js'
it('faucet failure selects a visible simulated settlement label without inherited credentials', async () => {
  const result = await prepare(async () => { throw Error('rate limited') })
  expect(result.fallback).toBe(true)
  expect(result.env.SETTLEMENT_RAIL).toBe('simulated')
  expect(result.env.XRPL_PAYER_SEED).toBeUndefined()
  expect(result.env.DOTENV_CONFIG_PATH).toBe('.testnet-no-env')
  expect(isolatedEnv().LLM_PROVIDER).toBe('fixture')
})
it('stores reusable seeds only in scratch with 0600; funding endpoints and network are Testnet only', async () => {
  const dir = resolve(`scratch/testnet-unit-${crypto.randomUUID()}`)
  await mkdir(dir, {recursive:true})
  const file = `${dir}/wallets.private.json`
  const requests: string[] = []
  const ledger = { request: async (r: Record<string, unknown>) => ({ result: r.command === 'server_info' ? {info:{network_id:1}} : {account_data:{Balance:'50000000'}} }), close:async()=>{} }
  const faucet = (async (url: string | URL | Request) => { requests.push(String(url)); return new Response('{}') }) as typeof fetch
  const log = vi.spyOn(console, 'log')
  const seeds = await provision(file, faucet, ledger)
  expect(log).not.toHaveBeenCalled()
  log.mockRestore()
  expect((await stat(file)).mode & 0o777).toBe(0o600)
  expect(JSON.parse(await readFile(file,'utf8'))).toEqual(seeds)
  const failingLedger = {...ledger,request:async (r: Record<string, unknown>) => ({result:r.command === 'server_info' ? {info:{network_id:1}} : {account_data:{Balance:'0'}}})}
  await expect(provision(file, (async()=>new Response('',{status:429})) as typeof fetch, failingLedger)).rejects.toThrow('faucet unavailable')
  expect(requests.every(r => r === FAUCET)).toBe(true)
  expect(testnetUrl(TESTNET_WSS)).toBe(TESTNET_WSS)
  expect(() => testnetUrl('wss://s1.ripple.com')).toThrow()
  await expect(provision('/tmp/forbidden-wallet.json',faucet,ledger)).rejects.toThrow('scratch')
  await expect(provision(file,faucet,{...ledger,request:async()=>({result:{info:{network_id:0}}})})).rejects.toThrow('network ID')
})
it('waits for a validated buyer and retries an account race once before funding', async () => {
  const { Wallet } = await import('xrpl')
  const buyer = Wallet.generate(), writer = Wallet.generate()
  const file = resolve(`scratch/testnet-unit-${crypto.randomUUID()}/wallets.private.json`)
  const { writeFile } = await import('node:fs/promises')
  await mkdir(resolve(file, '..'), { recursive: true })
  await writeFile(file, JSON.stringify({ buyer: buyer.seed, alphaleak: writer.seed }))
  let validations = 0, signatures = 0, submitted = 0
  const ledger = { close: async () => {}, request: async (r: Record<string, unknown>) => {
    if (r.command === 'server_info') return {result:{info:{network_id:1}}}
    if (r.command === 'account_info') {
      if (r.account === buyer.classicAddress && r.ledger_index === 'validated' && ++validations < 3) throw {data:{error:'actNotFound'}}
      if (r.account === buyer.classicAddress && r.ledger_index === 'current' && ++signatures === 1) throw {data:{error:'actNotFound'}}
      return {result:{account_data:{Balance:r.account === writer.classicAddress ? '0' : '100000000',Sequence:1}}}
    }
    if (r.command === 'ledger_current') return {result:{ledger_current_index:100}}
    if (r.command === 'fee') return {result:{drops:{open_ledger_fee:'12'}}}
    if (r.command === 'submit') { submitted++; expect(validations).toBeGreaterThanOrEqual(3); return {result:{engine_result:'tesSUCCESS'}} }
    return {result:{validated:true,meta:{TransactionResult:'tesSUCCESS'},ledger_index:101}}
  }}
  await provision(file, (async () => new Response('{}')) as typeof fetch, ledger)
  expect(submitted).toBe(1)
  expect(signatures).toBe(2)
})
it('classifies faucet failures without leaking response bodies', async () => {
  const result = await prepare(() => provision(`scratch/testnet-unit-${crypto.randomUUID()}/wallets.private.json`, (async () => new Response('private response', {status:429})) as typeof fetch, {close:async()=>{},request:async r=>({result:r.command==='server_info'?{info:{network_id:1}}:{account_data:{Balance:'0'}}})}))
  expect(result.reason).toContain('faucet HTTP 429')
  expect(JSON.stringify(result)).not.toContain('private response')
})
it('defaults funded local writers to key reveal with an explicit payment opt-out', () => {
  const env = isolatedEnv({ buyer:'synthetic', alphaleak:'synthetic' })
  expect(env.ESCROW_MODE).toBe('key-reveal')
  expect(env.ESCROW_WRITERS).toBe('alphaleak')
  vi.stubEnv('ESCROW_MODE','payment')
  try { expect(isolatedEnv({ buyer:'synthetic', alphaleak:'synthetic' }).ESCROW_WRITERS).toBe('') } finally { vi.unstubAllEnvs() }
})
