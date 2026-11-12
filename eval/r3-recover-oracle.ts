// One explicit offline migration for the diagnosed paid-fixture collision.
// Never reruns model calls, edits scores, or mutates the failed attempt.
import 'dotenv/config'
import {cpSync,existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {loadWriterCorpus} from '../publisher/corpus.js'
import {validateWriterCorpus} from '../shared/contracts/writers.js'
import {readRuns,auditRuns} from '../scripts/gate-audit.js'
import {readObservations,atomicJson} from './r3-state.js'
import type {Observation} from '../tests/scenarios/harness.js'
const from=resolve(process.argv[2]),to=resolve(process.argv[3]),oldFile=process.argv[4]
if(existsSync(to))throw Error('Recovery target must be new; failed attempt stays immutable')
const saved=JSON.parse(readFileSync(join(from,'results.json'),'utf8'))
process.env.LEDGER_REPORT_DIR=join(from,'ledger-reports')
const corpus=await loadWriterCorpus(undefined,{allowMini:false})
const oldArticle=JSON.parse(readFileSync(oldFile,'utf8')),changed=oldArticle.articleId
if(!['c5-xrpl-destination-tag','c5-xrpl-crypto-condition-type','c5-offercreate-flags','c5-rlusd-currency-code','c5-xrpl-payment-channels','c5-xrpl-amm-create-deposit'].includes(changed))throw Error('Only diagnosed fixtures are supported')
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const statics={...corpus,articles:corpus.articles.filter(a=>a.publisherSlug!=='ledger-analytics')}
const oldCorpus=validateWriterCorpus({...statics,articles:statics.articles.map(a=>a.articleId===changed?oldArticle:a)})
if(hash(oldCorpus)!==saved.identity.corpusSha256)throw Error('Other corpus bytes changed')
const runs=['free','paid'].flatMap(arm=>readRuns(join(from,`${arm}.db`)))
const historicalVersionRuns=runs.filter(r=>r.intents.some(i=>i.resourceId===changed)||r.contents.some(c=>c.resourceId===changed))
if(historicalVersionRuns.some(r=>r.phase!=='DONE'||!r.grants.some(g=>g.resourceId===changed&&g.version===oldArticle.version&&r.intents.some(i=>i.intentId===g.intentId&&i.status==='VERIFIED'))))throw Error('Changed fixture has an unresolved/ungranted use')
const results=saved.results.map((result:{id:string;arm:string;runId:string;violations:{rule:string}[]})=>{
 if(result.violations.some(v=>v.rule!=='premium_leak'))throw Error('A non-oracle gate failure is terminal')
 const run=runs.find(r=>r.runId===result.runId)
 if(!run)throw Error('Saved run missing')
 const observations=readObservations<Observation>(join(from,`${result.arm}-${result.id}-observations.jsonl`))
 const auditCorpus=historicalVersionRuns.some(r=>r.runId===run.runId)?{...corpus,articles:corpus.articles.map(a=>a.articleId===changed?oldCorpus.articles.find(a=>a.articleId===changed)!:a)}:corpus
 const audit=auditRuns([run],auditCorpus,observations)
 if(audit.total)throw Error(`Recovery still fails audit: ${result.arm}:${result.id}`)
 return {...result,violations:audit.violations}
})
const identity={...saved.identity,corpusSha256:hash(statics),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()}
mkdirSync(to,{recursive:true});cpSync(from,to,{recursive:true})
const recovery={reason:'Unchanged strict oracle; Paid fixture public-answer phrase collision corrected with distinct wording and unique canary. Original failed attempt retained.',from,priorIdentity:saved.identity,identity,retainedPairs:results.length,historicalVersionRunIds:historicalVersionRuns.map(r=>r.runId),priorViolations:saved.results.filter((r:{violations:unknown[]})=>r.violations.length).map((r:{id:string;arm:string;runId:string;violations:unknown[]})=>({id:r.id,arm:r.arm,runId:r.runId,violations:r.violations})),assertions:['Only the diagnosed static fixture changed','Historical verified uses retain and audit their original article version; ungranted/unresolved uses are refused','Every retained run and its complete SSE observations passed the unchanged auditor','All scores, run IDs and task keys retained']}
atomicJson(join(to,'results.json'),{...saved,identity,results,recovery})
writeFileSync(join(to,'recovery.json'),JSON.stringify(recovery,null,2)+'\n')
console.log(JSON.stringify({retainedPairs:results.length,originalViolations:recovery.priorViolations.length,newViolations:0,identity}))
