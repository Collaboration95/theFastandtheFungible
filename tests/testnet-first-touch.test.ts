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
