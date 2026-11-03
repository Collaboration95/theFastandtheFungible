import { expect, it } from 'vitest'
import { interop } from '../scripts/interop/starter-kit.js'
it('interoperates both ways with real t54 middleware/client and a labelled synthetic ledger', async () => {
  const result = await interop()
  expect(result.label).toContain('SYNTHETIC')
  expect(result.sdkToStarterKit).toMatch(/^[A-F0-9]{64}$/)
  expect(result.starterKitToPublisher).toMatch(/^[A-F0-9]{64}$/)
}, 30_000)
