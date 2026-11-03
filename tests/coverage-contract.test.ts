import { expect, it } from 'vitest'
// @ts-expect-error Node CLI helper
import { summarize, enforce } from '../scripts/check-coverage.mjs'
it('refuses a missing unexecuted product file', () => {
  expect(() => summarize({}, ['server/purchases.ts'])).toThrow('Missing product file')
})
it('refuses one lost branch even if the rounded percentage is unchanged', () => {
  const original = { payments: { branches: { covered: 90001, total: 100000 }, lines: { covered: 100, total: 100 } } }
  const dropped = structuredClone(original); dropped.payments.branches.covered--
  expect(() => enforce(dropped, original)).toThrow('regressed')
  expect(() => enforce(original, original)).not.toThrow()
})
it('enforces 85 percent independently of historical floors', () => {
  const low = { payments: { branches: { covered: 8477, total: 10000 }, lines: { covered: 100, total: 100 } } }
  expect(() => enforce(low, low)).toThrow('below 85%')
})
