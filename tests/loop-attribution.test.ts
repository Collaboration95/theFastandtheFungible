import { once } from 'node:events'
import { describe, it, expect } from 'vitest'
import { Store } from '../server/store.js'
describe('metadata-only orchestration writes', () => {
  it('preserves validation, rollback and the hydrated update result', () => {
    const store = new Store(':memory:')
    try {
      const run = store.createRun('fixture', 200)
      store.updateRunState(run.runId, {phase:'SEARCH', checkpoint:{step:1}})
      expect(store.getRun(run.runId).checkpoint).toEqual({step:1})
      expect(() => store.updateRunState(run.runId, {spentMinor:100})).toThrow('Protected')
      store.updateRunState(run.runId, {stopped:true})
      expect(() => store.updateRunState(run.runId, {stopped:false})).toThrow('cannot resume')
      expect(store.updateRun(run.runId,{phase:'STOPPED'}).stopped).toBe(true)
      expect(store.getRun(run.runId).spentMinor).toBe(0)
    } finally {store.close()}
  })
})

it('pairs independent idle histograms on unique absolute boundaries and stops the child', async () => {
  const {spawn} = await import('node:child_process')
  const child=spawn(process.execPath,['scripts/soak-idle-control.mjs'],{stdio:['ignore','ignore','inherit','ipc']})
  const rows: {interval:number;start:number;end:number}[]=[]
  try {
    await new Promise<void>((done,fail)=>{
      child.once('error',fail)
      child.on('message', (message: {ready?:boolean;control?:boolean;interval:number;start:number;end:number})=>{
        if(message.ready)child.send({epoch:Date.now()})
        if(message.control){rows.push(message);if(rows.length===3)done()}
      })
    })
    expect(new Set(rows.map(r=>r.interval)).size).toBe(3)
    expect(rows.slice(1).every(r=>r.end-r.start>=900)).toBe(true)
    const closed=once(child,'exit');child.send({stop:true});await closed
    expect(child.exitCode).toBe(0)
  } finally {if(child.exitCode===null){const closed=once(child,'exit');child.kill();await closed}}
},10000)
