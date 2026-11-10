import { execFileSync } from 'node:child_process'
import { expect, it } from 'vitest'

it('standalone example passes offline crypto, policy and pinned-SDK boundary tests', () => {
  const output = execFileSync(process.execPath, ['--test', '--test-reporter=tap', 'examples/x402-key-reveal-escrow/example.test.mjs'], {
    encoding: 'utf8', env: { ...process.env, XRPL_KEY_REVEAL_TESTNET: '0' },
  })
  expect(output).toMatch(/# fail 0/)
  expect(output).toMatch(/# skipped 1/)
})
it.skipIf(process.env.XRPL_KEY_REVEAL_TESTNET !== '1')('runs escrow delivery and cancellation on XRPL Testnet', () => {
  const output = execFileSync(process.execPath, ['examples/x402-key-reveal-escrow/example.mjs'], {
    encoding: 'utf8', timeout: 180000, env: { ...process.env, OFFSET: '1400' },
  })
  expect(output).toContain('RESULT PASS')
}, 185000)
