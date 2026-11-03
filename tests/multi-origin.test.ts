import { once } from 'node:events'
import { expect, it } from 'vitest'
import { verifyAnswer } from '../sdk/verify.js'
import { demoMultiOrigin } from '../scripts/demo-multi-origin.js'
it('publishes three origins and keeps collided paid sources separate through restart, grants, citations and receipts', async () => {
  const r = await demoMultiOrigin()
  expect(r.originsFound).toBe(3); expect(r.mcpOrigins).toBe(3); expect(r.receipts).toBe(2); expect(r.grants).toBe(2); expect(r.sameWallet).toBe(true)
  expect(r.citations).toHaveLength(2); expect(r.healthyOrigins).toBe(2); expect(r.deadMs).toBeLessThan(2500); expect(r.verification.ok).toBe(true); expect(r.gateAudit.total).toBe(0)
  for (const part of ['sources','grants','receipts','intents','proofs'] as const) {
    const copy=structuredClone(r.bundle); const item=copy[part].find(s=>s.source?.profileId === 'collision')!; item.source!.origin='http://127.0.0.1:2'
    expect((await verifyAnswer(copy)).ok).toBe(false)
  }
}, 20000)
it('bounds a hung origin, including queued searches, by one discovery deadline', async () => {
  const { createServer } = await import('node:http')
  const { PublisherClient } = await import('../server/publisher-client.js')
  const { retrieve } = await import('../server/agents/research.js')
  const hung = createServer(() => {})
  hung.listen(0,'127.0.0.1'); await once(hung,'listening')
  try {
    const start = performance.now()
    await retrieve(new PublisherClient({ baseUrls: [`http://127.0.0.1:${(hung.address() as {port:number}).port}`] }), 'q')
    const elapsed = performance.now()-start
    expect(elapsed).toBeGreaterThanOrEqual(1900); expect(elapsed).toBeLessThan(2500)
  } finally { hung.closeAllConnections(); await new Promise<void>(r => hung.close(() => r())) }
})
