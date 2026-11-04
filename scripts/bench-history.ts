import { Store } from '../server/store.js'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir, platform, arch, cpus } from 'node:os'
import { join, dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import { execFileSync } from 'node:child_process'
import { createApiApp } from '../server/routes.js'
const arg = (name: string, fallback: string) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name)+1] : fallback
const runs=Number(arg('--runs','3000')), events=Number(arg('--events-per-run','60'))
const output=arg('--output','scratch/history-3000.json')
const scratch=mkdtempSync(join(tmpdir(),'ra-history-'))
const path=join(scratch,'history.db')
try {
let store=new Store(path)
const prototype=store.createRun('SYNTHETIC retained history',0)
store.close()
const db=new DatabaseSync(path)
db.prepare('DELETE FROM runs WHERE id=?').run(prototype.runId)
db.exec('DROP INDEX events_run_id; DROP INDEX intents_run_id; BEGIN')
const addRun=db.prepare('INSERT INTO runs VALUES (?,?)'), addEvent=db.prepare('INSERT INTO events(run_id,json) VALUES (?,?)')
for(let n=0;n<runs;n++){
 const id=`history-${n}`
 addRun.run(id,JSON.stringify({...prototype,runId:id,phase:'DONE',events:[]}))
 for(let e=0;e<events;e++) addEvent.run(id,JSON.stringify({id:n*events+e,runId:id,at:'2026-11-01T00:00:00.000Z',type:'PROGRESS',label:'SYNTHETIC retained event'}))
}
db.exec('COMMIT')
const plan=()=>db.prepare('EXPLAIN QUERY PLAN SELECT json FROM events WHERE run_id=? ORDER BY id').all('history-0')
const beforePlan=plan()
// Open through Store without migration, then time the original full hydration.
db.exec('CREATE INDEX events_run_id ON events(run_id,id); CREATE INDEX intents_run_id ON intents(run_id)')
store=new Store(path)
db.exec('DROP INDEX events_run_id; DROP INDEX intents_run_id')
const migrationOnly=process.argv.includes('--migration-only')
let start=performance.now();if(!migrationOnly) store.listRuns();const before=migrationOnly ? null : performance.now()-start
start=performance.now();db.exec('CREATE INDEX events_run_id ON events(run_id,id); CREATE INDEX intents_run_id ON intents(run_id)');const migration=performance.now()-start
start=performance.now();if(!migrationOnly) store.listRuns();const after=migrationOnly ? null : performance.now()-start
const afterPlan=plan();store.close();db.close()
Object.assign(process.env,{LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SETTLEMENT_RAIL:'simulated',SEARCH_EMBEDDINGS:'off',LANGFUSE_ENABLED:'0'})
const api=await createApiApp({dbPath:path,publisherUrl:'http://127.0.0.1:1'})
const samples=[]
for(let n=0;n<5;n++){start=performance.now();api.store.runnableRunIds();api.store.recoverableRunIds();await api.reconcileOnce();samples.push(performance.now()-start)}
await api.close()
const result={mode:'local synthetic; no providers or ledger',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),host:{platform:platform(),arch:arch(),cpu:cpus()[0].model,node:process.version,sqlite:process.versions.sqlite},runs,eventsPerRun:events,eventRows:runs*events,fullHydrationMs:{before,after},indexMigrationMs:migration,selectionAndNoopReconcileMs:samples,under500ms:samples.every(v=>v<500),beforePlan,afterPlan}
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result))

} finally {
 if(process.env.KEEP_CONSUMER_SCRATCH === '1') console.log('History scratch retained: '+scratch)
 else rmSync(scratch,{recursive:true,force:true})
}
