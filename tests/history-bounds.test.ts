import { expect, it, vi } from 'vitest'
import { Store } from '../server/store.js'
import { metrics } from '../server/metrics.js'
import { PurchaseManager } from '../server/purchases.js'
import { PublisherClient } from '../server/publisher-client.js'
it('SQL selectors match the previous mixed-history predicates, without hydration', () => {
  const s = new Store(':memory:')
  try {
    for (let n=0; n<32; n++) {
      const r = s.createRun('synthetic', 0)
      const id = `intent-${n}`
      s.updateRun(r.runId, { phase: n%4 === 0 ? 'FAILED' : n%4 === 1 ? 'DONE' : 'SEARCH', stopped: n%7 === 0,
        checkpoint: { intentId: id, ...(n%3 === 0 ? { answeredIntentId: id } : {}), ...(n%5 === 0 ? { recoveryIntentId: id } : {}) } })
      // Synthetic historical row; not a purchase or a claim of settlement.
      const db = (s as unknown as { db: import('node:sqlite').DatabaseSync }).db
      if(n%11 === 0) db.prepare('INSERT INTO hire_reserves VALUES (?,0,0)').run(r.runId)
      db.prepare('INSERT INTO intents VALUES (?,?,?)').run(id, r.runId, JSON.stringify({ intentId:id,runId:r.runId,profileId:'fixture',resourceId:'fixture',version:'1',amountMinor:0,status:n%2 ? 'SKIPPED':'VERIFIED' }))
    }
    const runs = s.listRuns()
    const runnable = runs.filter(r => !s.isHireRun(r.runId) && !['DONE','STOPPED','FAILED'].includes(r.phase)).map(r=>r.runId)
    const recoverable = runs.filter(r => { const id = r.checkpoint.intentId; return !s.isHireRun(r.runId) && !r.stopped && r.phase === 'FAILED' && id && !(r.checkpoint.answeredIntentId === id && r.checkpoint.recoveryIntentId !== id) && r.intents.some(i=>i.intentId === id && i.status === 'VERIFIED') }).map(r=>r.runId)
    vi.spyOn(s, 'listRuns').mockImplementation(()=>{throw new Error('full hydration forbidden')})
    expect(s.runnableRunIds()).toEqual(runnable)
    expect(s.recoverableRunIds()).toEqual(recoverable)
    expect(metrics(s,new PurchaseManager(s,new PublisherClient())).modelUsageByRun).toHaveLength(32)
  } finally { s.close() }
})

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApiApp } from '../server/routes.js'
it('startup, recovery, metrics and drain never call listRuns', async () => {
  const path=join(mkdtempSync(join(tmpdir(),'history-select-')),'app.db')
  const store=new Store(path)
  for(let n=0;n<40;n++) {const run=store.createRun('SYNTHETIC',0);store.updateRun(run.runId,{phase:'DONE'})}
  store.close()
  const guard=vi.spyOn(Store.prototype,'listRuns').mockImplementation(()=>{throw new Error('hydration forbidden')})
  try {
    const api=await createApiApp({dbPath:path,publisherUrl:'http://127.0.0.1:1'})
    try {await api.reconcileOnce();expect(metrics(api.store,api.purchases).modelUsageByRun).toHaveLength(40);await api.drain()}
    finally {await api.close()}
  } finally {guard.mockRestore()}
})
