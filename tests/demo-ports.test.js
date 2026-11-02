import { expect, it } from 'vitest'
import { allocateDemoPorts } from '../scripts/demo-ports.mjs'

it('allocates distinct ephemeral ports outside the reserved demo ports', async () => {
  const ports = Object.values(await allocateDemoPorts())
  expect(new Set(ports).size).toBe(3)
  for (const port of ports) {
    expect(port).toBeGreaterThan(0)
    expect([5100, 8788, 8790]).not.toContain(port)
  }
})
