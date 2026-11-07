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
 expect(result.testnet).toBe(false); expect(result.env).toEqual({}); expect(result.labels.join()).toContain(`SIMULATED fallback · ${reason} · no ledger transactions`)
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
