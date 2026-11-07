import { it, expect, vi } from 'vitest'
vi.mock('../mcp/testnet.js', () => ({
 prepareMcpTestnet: async () => ({ testnet: false, env: {}, labels: ['SIMULATED fallback · faucet_unavailable · no ledger transactions', 'Fixture models and fictional writers'] }),
 testnetStateDir: () => scratch,
}))
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runTry } from '../mcp/try.js'
const scratch = mkdtempSync(join(tmpdir(), 'try-fallback-test-'))
it('requires explicit Testnet authorization', async () => {
 await expect(runTry([])).rejects.toThrow('try --testnet')
})
it('runs and verifies labelled simulated receipts when the faucet is unavailable', async () => {
 const log = vi.spyOn(console, 'log').mockImplementation(() => {})
 try {
  await runTry(['--testnet'])
  const output = log.mock.calls.flat().join('\n')
  expect(output).toContain('SIMULATED fallback · faucet_unavailable')
  expect(output).toContain('SIMULATED · no explorer links or ledger transactions')
  expect(output).not.toContain('https://testnet.xrpl.org/transactions/')
  expect(output.trim()).toMatch(/RESULT PASS$/)
  expect(output.match(/RESULT PASS/g)).toHaveLength(1)
  expect(output).toMatch(/net S\$[\d.]+ · gross S\$[\d.]+/)
  const run = output.match(/VERIFY ([^\n]+)/)?.[1]
  expect(run).toBeTruthy()
  log.mockClear()
  await runTry(['--testnet'])
  expect(log.mock.calls.flat().join('\n').match(/VERIFY ([^\n]+)/)?.[1]).toBe(run)
 } finally { log.mockRestore(); rmSync(scratch, { recursive: true, force: true }) }
}, 15000)
