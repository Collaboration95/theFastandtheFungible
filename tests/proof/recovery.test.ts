import { expect, it, vi } from 'vitest'
import { payPath, honestArticle } from '../fixtures/pay-path.js'
import { PurchaseManager } from '../../server/purchases.js'

it('recovers the signed search manifest after a crash immediately following reservation', async () => {
  const p = await payPath()
  try {
    const candidate = await p.candidate(honestArticle), run = p.store.createRun('SYNTHETIC reservation crash',200)
    const original = p.store.reserveIntent.bind(p.store)
    const crash = vi.spyOn(p.store,'reserveIntent').mockImplementationOnce(input => {
      original(input)
      throw Error('SYNTHETIC crash between reservation and manifest persistence')
    })
    const input = { runId: run.runId, candidate, intentId: 'crashed-reservation' }
    await expect(p.manager.purchase(input)).rejects.toThrow('SYNTHETIC crash')
    crash.mockRestore()
    expect(p.store.getIntent(input.intentId)?.status).toBe('RESERVED')
    expect(p.store.getManifest(input.intentId)).toBeUndefined()
    expect((await new PurchaseManager(p.store,p.client).purchase(input)).status).toBe('VERIFIED')
    expect(p.store.getRun(run.runId).receipts).toHaveLength(1)
  } finally { await p.close() }
})
