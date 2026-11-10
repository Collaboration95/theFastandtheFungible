import { expect, it } from 'vitest'
import express from 'express'
import { Store } from '../server/store.js'
import { auditRouter } from '../server/api/audit.js'
import type { ApiContext } from '../server/api/context.js'
import { RECEIPT_COLUMNS } from '../server/audit.js'
import { resources } from './helpers/resource-scope.js'

it('audit exports retain their simulated label, formats and range validation on an empty wallet', async () => {
  const store = resources().own(new Store(':memory:'))
  const app = express()
  // Exercise the existing export router directly; admission/auth is tested separately.
  app.use(auditRouter({ store } as ApiContext))
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>(done => server.once('listening', done))
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  try {
    const csv = await fetch(base + '/api/audit/receipts.csv')
    expect(csv.status).toBe(200)
    expect(csv.headers.get('content-type')).toContain('text/csv')
    expect(csv.headers.get('content-disposition')).toContain('receipts-simulated.csv')
    expect(csv.headers.get('x-export-label')).toBe('SIMULATED - no real funds')
    expect((await csv.text()).trim()).toBe(RECEIPT_COLUMNS.join(','))
    const jsonl = await fetch(base + '/api/audit/receipts.jsonl')
    expect(jsonl.headers.get('content-type')).toContain('application/x-ndjson')
    expect(jsonl.headers.get('content-disposition')).toContain('receipts-simulated.jsonl')
    expect(await jsonl.text()).toBe('')
    const invalid = await fetch(base + '/api/audit/receipts.csv?from=not-a-date')
    expect(invalid.status).toBe(400)
    expect(await invalid.json()).toMatchObject({ error: expect.stringContaining('Invalid date') })
    const verified = await fetch(base + '/api/audit/verify')
    expect(verified.status).toBe(200)
    expect(await verified.json()).toMatchObject({ ok: true, failures: [] })
  } finally {
    server.closeAllConnections()
    await new Promise<void>(done => server.close(() => done()))
  }
})
