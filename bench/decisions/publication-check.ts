/** Local publication validation. Does not stage files, upload, or call providers. */
import fs from 'node:fs'
import path from 'node:path'
import {assertNoSecrets,OUT} from './transport.js'

const root=path.resolve('bench/decisions')
const walk=(directory:string):string[]=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(directory,e.name)):[path.join(directory,e.name)])
const required=['README.md','results-dev.csv','results-test.csv','tuning-log.csv','cost.json','latency.csv','preregistration.md','question-wordings.md']
for(const name of required){const file=path.join(OUT,name);if(!fs.existsSync(file)||fs.statSync(file).size===0)throw new Error(`Missing publication file: ${name}`)}
const summary=JSON.parse(fs.readFileSync(path.join(OUT,'summary.json'),'utf8')) as {completeness:Array<{arm:string;complete:boolean;blocked?:boolean}>;final:Record<string,{decisions?:unknown;isolatedOperational?:{evidenceComplete:boolean}}>}
if(summary.completeness.some(r=>!r.complete&&!r.blocked))throw new Error('Unfinished non-blocked evaluation cannot be published')
for(const[arm,result]of Object.entries(summary.final))if(arm!=='fixture'&&result.decisions&&!result.isolatedOperational?.evidenceComplete)throw new Error(`Unfinished isolated operational measurement: ${arm}`)
const rows=fs.readFileSync(path.join(OUT,'requests.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l) as {arm:string;usd:number})
const costs=JSON.parse(fs.readFileSync(path.join(OUT,'cost.json'),'utf8')) as Record<string,{calls:number;usd:number}>
for(const[arm,meter]of Object.entries(costs)){
 const calls=rows.filter(r=>r.arm===arm)
 if(calls.length!==meter.calls||Math.abs(calls.reduce((s,r)=>s+r.usd,0)-meter.usd)>1e-9)throw new Error(`Meter/attempt ledger mismatch: ${arm}`)
}
const manifest=path.join(OUT,'files-created.txt')
const files=[...new Set([...walk(root),manifest])].sort()
fs.writeFileSync(manifest,files.map(f=>path.relative(process.cwd(),f)).join('\n')+'\n')
assertNoSecrets(files)
console.log(JSON.stringify({publicationCheck:'passed',requiredFiles:required.length,files:files.length,manifest:'bench/decisions/out/files-created.txt',requestLedgerReconciles:true,secrets:'No configured credential values or unreviewed literal patterns found'}))
