import { afterEach, expect, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { fixture } from './byok-fixture.js'
afterEach(() => vi.unstubAllEnvs())
it('bounds 100 concurrent admissions before planning; retries bypass saturation', async () => {
  const f = await fixture(true)
  try {
    const responses = await Promise.all(Array.from({ length: 100 }, (_, i) => f.post('/runs', { question: `Question ${i}?`, budgetMinor: 0 }, `cap-${i}`)))
    expect(responses.filter(r => r.status === 201)).toHaveLength(4); expect(responses.filter(r => r.status === 503)).toHaveLength(96)
    const ids: string[] = []
    for (let i=0;i<100;i++) { const body = await responses[i].json(); if (responses[i].status===201) { ids.push(body.runId); const retry = await f.post('/runs', { question: `Question ${i}?`, budgetMinor: 0 }, `cap-${i}`); expect(retry.status).toBe(200); expect((await retry.json()).runId).toBe(body.runId) } else expect(body).toMatchObject({ code: 'overloaded', status: 503, retryable: true }) }
    expect(f.api.work.peak).toBe(4); expect(f.api.store.listPastRuns()).toHaveLength(4)
    await f.api.reconcileOnce() // signed-obligation reconciliation remains independent
    for (const id of ids) await f.post(`/runs/${id}/stop`, {})
    await f.api.drain(); expect(f.api.work.active).toBe(0)
    if (process.env.C1_EVIDENCE === '1') writeFileSync('docs/evidence/round2-c1/cap.json', JSON.stringify({ evidence: 'local synthetic; stalled planning', submitted: 100, admitted: 4, overloaded: 96, peak: f.api.work.peak, activeAfterDrain: f.api.work.active, idempotentRetries: 4, reconciliationWhileFull: true },null,2)+'\n')
  } finally { await f.close() }
}, 15000)
