import { afterEach, expect, test, vi } from 'vitest'
vi.mock('../scripts/testnet-wallets.js', () => ({ provision: vi.fn(), isolatedEnv: vi.fn(() => ({ SETTLEMENT_RAIL: 'simulated', DEMO_WEB_PORT: undefined })) }))
import { provision } from '../scripts/testnet-wallets.js'
import { prepareMcpTestnet, testnetStateDir } from '../mcp/testnet.js'
const original = { ...process.env }
afterEach(() => { process.env = { ...original }; vi.restoreAllMocks() })
test('state uses absolute XDG paths and rejects relative XDG paths', () => {
 process.env.XDG_STATE_HOME = '/tmp/ra-state'; expect(testnetStateDir()).toBe('/tmp/ra-state/researchagent/testnet')
 process.env.XDG_STATE_HOME = 'relative'; expect(testnetStateDir()).toMatch(/\/\.local\/state\/researchagent\/testnet$/)
})
test('Testnet explicitly selects escrow and anchors without increasing caps', async () => {
 vi.spyOn(console, 'error').mockImplementation(() => {})
 vi.mocked(provision).mockResolvedValue({ buyer: 'private-not-output' })
 process.env.MCP_MAX_BUDGET_MINOR = '0'; process.env.MCP_DAILY_CAP_MINOR = '0'
 expect((await prepareMcpTestnet()).testnet).toBe(true)
 expect(process.env.ESCROW_MODE).toBe('key-reveal'); expect(process.env.ANCHOR_RAIL).toBe('xrpl-testnet')
 expect(process.env.MCP_MAX_BUDGET_MINOR).toBe('0'); expect(process.env.MCP_DAILY_CAP_MINOR).toBe('0')
})
test('faucet errors are labelled without leaking error text or seeds', async () => {
 const log = vi.spyOn(console, 'error').mockImplementation(() => {})
 vi.mocked(provision).mockRejectedValue(Error('secret-value'))
 const result = await prepareMcpTestnet()
 expect(result.testnet).toBe(false); expect(result.labels.join()).toContain('SIMULATED fallback · network_or_provisioning_error')
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
