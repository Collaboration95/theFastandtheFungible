import { afterEach, expect, test, vi } from 'vitest'
vi.mock('../scripts/testnet-wallets.js', () => ({ provision: vi.fn(), isolatedEnv: vi.fn(() => ({ SETTLEMENT_RAIL: 'simulated', DEMO_WEB_PORT: undefined })) }))
import { provision, isolatedEnv } from '../scripts/testnet-wallets.js'
import { prepareMcpTestnet, testnetStateDir } from '../mcp/testnet.js'
const original = { ...process.env }
afterEach(() => { process.env = { ...original }; vi.restoreAllMocks() })
test('state uses absolute XDG paths and rejects relative XDG paths', () => {
 process.env.XDG_STATE_HOME = '/tmp/ra-state'; expect(testnetStateDir()).toBe('/tmp/ra-state/researchagent/testnet')
 process.env.XDG_STATE_HOME = 'relative'; expect(testnetStateDir()).toMatch(/\/\.local\/state\/researchagent\/testnet$/)
})
test('Testnet gives the engine key-reveal and anchors without touching the process environment or caps', async () => {
 vi.spyOn(console, 'error').mockImplementation(() => {})
 vi.mocked(provision).mockResolvedValue({ buyer: 'private-buyer', alphaleak: 'private-writer' })
 vi.mocked(isolatedEnv).mockReturnValue({ XRPL_PAYER_SEED: 'private-buyer', XRPL_PUBLISHER_ALPHALEAK_SEED: 'private-writer', SETTLEMENT_RAIL: 'xrpl-testnet', APP_DB: ':memory:', MCP_MAX_BUDGET_MINOR: '999' })
 process.env.MCP_MAX_BUDGET_MINOR = '0'; process.env.MCP_DAILY_CAP_MINOR = '0'
 const setup = await prepareMcpTestnet()
 expect(setup.testnet).toBe(true)
 expect(setup.env).toMatchObject({ ESCROW_MODE: 'key-reveal', ANCHOR_RAIL: 'xrpl-testnet', ESCROW_WRITERS: 'alphaleak', SETTLEMENT_RAIL: 'xrpl-testnet', XRPL_PAYER_SEED: 'private-buyer' })
 expect(setup.env.APP_DB).toBeUndefined(); expect(setup.env.MCP_MAX_BUDGET_MINOR).toBeUndefined()
 expect(process.env.XRPL_PAYER_SEED).toBeUndefined(); expect(process.env.ESCROW_MODE).toBeUndefined()
 expect(process.env.MCP_MAX_BUDGET_MINOR).toBe('0'); expect(process.env.MCP_DAILY_CAP_MINOR).toBe('0')
 expect(setup.labels).toContain('Testnet · no real value')
})
test.each([['faucet HTTP 429 · faucet unavailable', 'faucet_unavailable'], ['validation timeout', 'validation_timeout'], ['Private wallet cache unavailable', 'wallet_cache_unavailable'], ['fetch failed secret-value', 'network_unavailable']])('%s is labelled %s without leaking error text', async (message, reason) => {
 const log = vi.spyOn(console, 'error').mockImplementation(() => {})
 vi.mocked(provision).mockRejectedValue(Error(message))
 const result = await prepareMcpTestnet()
 expect(result.testnet).toBe(false); expect(result.env).toEqual({ RA_TESTNET_FALLBACK: reason }); expect(result.labels.join()).toContain(`SIMULATED fallback · ${reason} · no ledger transactions`)
 expect(JSON.stringify(log.mock.calls)).not.toContain('secret-value')
})
test('provisions wallets directly inside a private state root', async () => {
 const { mkdtemp, rm, stat } = await import('node:fs/promises')
 const { tmpdir } = await import('node:os')
 const { provision: realProvision } = await vi.importActual<typeof import('../scripts/testnet-wallets.js')>('../scripts/testnet-wallets.js')
 const root = await mkdtemp(`${tmpdir()}/ra-state-test-`)
 try {
  const ledger = { request: async (r: Record<string, unknown>) => ({ result: r.command === 'server_info' ? { info: { network_id: 1 } } : { account_data: { Balance: '50000000' } } }), close: async () => {} }
  await realProvision(`${root}/wallets.private.json`, fetch, ledger, root)
  expect((await stat(`${root}/wallets.private.json`)).mode & 0o777).toBe(0o600)
 } finally { await rm(root, { recursive: true, force: true }) }
})
test.each(['test-iou', undefined])('IOU asset selection %s reaches provisioning without process mutation', async asset => {
 vi.spyOn(console, 'error').mockImplementation(() => {})
 vi.mocked(provision).mockResolvedValue({ buyer: 'private-buyer', issuer: 'private-issuer', alphaleak: 'private-writer' })
 vi.mocked(isolatedEnv).mockReturnValue({ ESCROW_ASSET: 'test-iou', TESTNET_IOU_ISSUER: 'public-issuer', SETTLEMENT_RAIL: 'xrpl-testnet' })
 process.env.ESCROW_ASSET = 'test-iou'
 const setup = await prepareMcpTestnet(undefined, asset)
 expect(provision).toHaveBeenLastCalledWith(expect.stringContaining('wallets.private.json'), fetch, undefined, testnetStateDir(), 'test-iou')
 expect(setup.env).toMatchObject({ESCROW_ASSET:'test-iou',TESTNET_IOU_ISSUER:'public-issuer',ESCROW_WRITERS:'alphaleak',ESCROW_MODE:'key-reveal',ANCHOR_RAIL:'xrpl-testnet'})
 expect(setup.labels.join()).toContain('stand-in for RLUSD')
 expect(process.env.TESTNET_IOU_ISSUER).toBeUndefined()
})

// Fixture-only IOU provisioning exercises the extracted adapter without faucet or ledger access.
test('funding leaf keeps TEST-SGD issuer, trust-line and issuance order serial and reuses warm wallets', async () => {
 const { resources } = await import('./helpers/resource-scope.js')
 const { Client, Wallet } = await import('xrpl')
 const { TestnetProvisioner } = await import('../publisher/publishing/testnet-funding.js')
 const root = resources().tempDir('ra-provision-iou-')
 const file = `${root}/wallets.private.json`
 const submitted: string[] = []
 const progress = vi.spyOn(console, 'error').mockImplementation(() => {})
 let activeReads = 0, maxReads = 0
 let warm = false
 const connect = vi.spyOn(Client.prototype, 'connect').mockResolvedValue()
 vi.spyOn(Client.prototype, 'disconnect').mockResolvedValue()
 vi.spyOn(Client.prototype, 'request').mockImplementation((async (r: { command: string }) => {
   if (r.command === 'account_info') {
     if (!warm && submitted.length === 0) throw Error('fixture issuer not funded')
     return { result: { account_data: { Flags: warm ? 0x40000000 : 0 } } }
   }
   activeReads++; maxReads = Math.max(maxReads, activeReads)
   await Promise.resolve(); activeReads--
   return { result: { lines: warm ? [{ currency: 'SGT', limit: '1000000', balance: '10000' }] : [] } }
 }) as never)
 vi.spyOn(Client.prototype, 'autofill').mockImplementation((async (tx: { TransactionType: string }) => { submitted.push(tx.TransactionType); return { ...tx, Fee: '12' } }) as never)
 vi.spyOn(Wallet.prototype, 'sign').mockReturnValue({ tx_blob: 'fixture-only', hash: 'fixture-only' })
 vi.spyOn(Client.prototype, 'submitAndWait').mockResolvedValue({ result: { meta: { TransactionResult: 'tesSUCCESS' } } } as never)
 const ledger = { request: async (r: Record<string, unknown>) => ({ result: r.command === 'server_info' ? { info: { network_id: 1 } } : { account_data: { Balance: '50000000' } } }), close: async () => {} }
 const faucet = vi.fn()
 const provisioner = new TestnetProvisioner({ ledger, faucet, walletStore: { file, allowedRoot: root } })
 const cold = await provisioner.prepare({ asset: 'test-iou', writers: ['alphaleak'] })
 expect(submitted).toEqual(['Payment', 'AccountSet', 'TrustSet', 'TrustSet', 'Payment'])
 expect(cold.issuer).toBeTruthy()
 expect(maxReads).toBeGreaterThan(1)
 expect(progress.mock.calls.flat().join('\n')).toMatch(/issuer.*elapsed[\s\S]*trust lines.*elapsed[\s\S]*issuance.*elapsed/)
 warm = true; submitted.length = 0
 const reused = await provisioner.prepare({ asset: 'test-iou', writers: ['alphaleak'] })
 expect(reused).toEqual(cold)
 expect(submitted).toEqual([])
 expect(faucet).not.toHaveBeenCalled()
 expect(connect).toHaveBeenCalledTimes(2)
 vi.restoreAllMocks()
})

test('RLUSD leaf keeps reserve, fee and validated-result checks distinct from TEST-SGD issuance', async () => {
 const { Client, Wallet } = await import('xrpl')
 const { TestnetProvisioner } = await import('../publisher/publishing/testnet-funding.js')
 const { RLUSD_CURRENCY } = await import('../shared/contracts/asset.js')
 const wallet = Wallet.generate(), issuer = Wallet.generate().classicAddress
 let warm = false, balance = '50000000', fee = '12', valid = true
 const client = new Client('wss://s.altnet.rippletest.net:51233')
 const request = vi.spyOn(client, 'request').mockImplementation((async (r: { command: string }) => {
  if (r.command === 'account_lines') return { result: { lines: warm ? [{ currency: RLUSD_CURRENCY, limit: '10' }] : [] } }
  if (r.command === 'account_info') return { result: { account_data: { Balance: balance, OwnerCount: 0 } } }
  return { result: { info: { validated_ledger: { reserve_base_xrp: 1, reserve_inc_xrp: 0.2 } } } }
 }) as never)
 const autofill = vi.spyOn(client, 'autofill').mockImplementation((async (tx: unknown) => ({ ...(tx as object), Fee: fee })) as never)
 const submit = vi.spyOn(client, 'submitAndWait').mockImplementation((async () => ({ result: { validated: valid, meta: { TransactionResult: 'tesSUCCESS' }, hash: 'fixture-hash' } })) as never)
 vi.spyOn(wallet, 'sign').mockReturnValue({ tx_blob: 'fixture-only', hash: 'fixture-only' })
 const ledger = { request: vi.fn(), close: vi.fn() }
 const provisioner = new TestnetProvisioner({ ledger, faucet: vi.fn(), walletStore: { file: '', allowedRoot: '', client, wallets: [wallet], issuer } })
 expect(await provisioner.prepare({ asset: 'rlusd' })).toEqual({ [wallet.classicAddress]: 'fixture-hash' })
 expect(autofill.mock.calls[0][0]).toMatchObject({ TransactionType: 'TrustSet', LimitAmount: { currency: RLUSD_CURRENCY, value: '10', issuer } })
 warm = true
 expect(await provisioner.prepare({ asset: 'rlusd' })).toEqual({ [wallet.classicAddress]: 'already configured' })
 expect(submit).toHaveBeenCalledTimes(1)
 warm = false; balance = '1'
 await expect(provisioner.prepare({ asset: 'rlusd' })).rejects.toThrow('Insufficient reserve')
 balance = '50000000'; fee = '2001'
 await expect(provisioner.prepare({ asset: 'rlusd' })).rejects.toThrow('fee exceeds ceiling')
 fee = '12'; valid = false
 await expect(provisioner.prepare({ asset: 'rlusd' })).rejects.toThrow('not validated')
 expect(request).toHaveBeenCalled()
 expect(ledger.request).not.toHaveBeenCalled()
 vi.restoreAllMocks()
})
