// Offline continuation of uncharged provider-failed tasks. The original attempt is immutable.
import 'dotenv/config'
import {cpSync,existsSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {loadWriterCorpus} from '../publisher/corpus.js'
import {readRuns,auditRuns} from '../scripts/gate-audit.js'
import {assertRealCorpus,atomicJson,providerFailures,readObservations} from './r3-state.js'
import type {Observation} from '../tests/scenarios/harness.js'
import type {Article} from '../shared/contracts/writers.js'
import {validateWriterCorpus} from '../shared/contracts/writers.js'

const from=resolve(process.argv[2]),to=resolve(process.argv[3])
const checkOnly=process.argv.includes('--check')
if(process.env.R3_REQUIRE_PROVIDER_SUCCESS!=='1')throw Error('Strict provider success is required')
if(existsSync(to))throw Error('Target must be new; original attempt stays immutable')
const original=readFileSync(join(from,'results.json'))
const saved=JSON.parse(original.toString())
const modelCeilingUsd=Number(process.env.R3_MODEL_CAP_USD||saved.identity.modelCeilingUsd)
if(!Number.isFinite(modelCeilingUsd)||modelCeilingUsd<=0||modelCeilingUsd>saved.identity.modelCeilingUsd)throw Error('Continuation may only lower the original model ceiling')
if(saved.excludedAttempts?.length)throw Error('Use the existing continuation to resume again')
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const measured=JSON.parse(readFileSync('docs/evidence/models/r3-real-200/evaluated-fixtures.json','utf8')) as Article[]
const golden=JSON.parse(readFileSync('docs/evidence/models/r3-real-200/corpus-golden.json','utf8')) as {rewrites:{articleId:string;evaluatedSha256:string;shippingSha256:string}[]}
process.env.LEDGER_REPORT_DIR=join(from,'ledger-reports')
const corpus=await loadWriterCorpus(undefined,{allowMini:false});assertRealCorpus(corpus)
const statics={...corpus,articles:corpus.articles.filter(a=>a.publisherSlug!=='ledger-analytics')}
const normalize=(article:Article)=>validateWriterCorpus({...statics,articles:[article]}).articles[0]
for(const row of golden.rewrites){
 const shipping=JSON.parse(readFileSync(join('data/corpus/v2/articles/team-xrpl-explainers',`${row.articleId}.json`),'utf8')) as Article
 if(hash(measured.find(a=>a.articleId===row.articleId))!==row.evaluatedSha256||hash(shipping)!==row.shippingSha256||hash(normalize(shipping))!==hash(statics.articles.find(a=>a.articleId===row.articleId)))throw Error(`Unpinned fixture revision: ${row.articleId}`)
}
if(hash(validateWriterCorpus({...statics,articles:statics.articles.map(a=>{const old=measured.find(old=>old.articleId===a.articleId);return old?normalize(old):a})}))!==saved.identity.corpusSha256)throw Error('Other corpus bytes changed')
const historical=[...measured,...['r3-failed-oracle/original-destination-tag.json','r3-failed-crypto/original-crypto-condition.json','r3-failed-offer/original-offer-flags.json','r3-failed-currency/original-currency-code.json','r3-failed-channel/original-payment-channels.json','r3-failed-amm/original-amm.json','r3-failed-amm-deposit/original-amm-v2.json'].map(f=>normalize(JSON.parse(readFileSync(join('docs/evidence/models',f),'utf8')) as Article))]
if(!checkOnly)cpSync(from,to,{recursive:true})
const working=checkOnly?from:to
const excludedAttempts=[],accepted=[],providerAttempts:Record<string,number>={}
for(const arm of ['free','paid']){
 const runs=readRuns(join(working,`${arm}.db`))
 for(const run of runs)for(const ref of [...run.contents,...run.intents])if(measured.some(a=>a.articleId===ref.resourceId)&&!historical.some(a=>a.articleId===ref.resourceId&&a.version===ref.version))throw Error(`Missing original fixture version: ${ref.resourceId}@${ref.version}`)
 for(const result of saved.results.filter((r:{arm:string})=>r.arm===arm)){
  const run=runs.find(r=>r.runId===result.runId)
  if(!run)throw Error('Saved task missing from retained store')
  const reasons=providerFailures(run)
  if(reasons.length){
   if(run.spentMinor||run.receipts.length||run.intents.some(i=>['VERIFIED','REFUNDED'].includes(i.status)))throw Error('Charged provider failure requires same-run recovery; replay refused')
   excludedAttempts.push({result,reasons,requiresSameRunRecovery:false});providerAttempts[`${arm}:${result.id}`]=1
   delete saved.runIds[`${arm}:${result.id}`];delete saved.started[`${arm}:${result.id}`]
  }else accepted.push(result)
 }
 for(const run of runs.filter(r=>accepted.some(a=>a.runId===r.runId))){
  const overlays=historical.filter(a=>run.contents.some(c=>c.resourceId===a.articleId&&c.version===a.version)||run.intents.some(i=>i.resourceId===a.articleId&&i.version===a.version))
  if(new Set(overlays.map(a=>a.articleId)).size!==overlays.length)throw Error('Ambiguous historical version')
  if(overlays.some(a=>!run.grants.some(g=>g.resourceId===a.articleId&&g.version===a.version&&run.intents.some(i=>i.intentId===g.intentId&&i.status==='VERIFIED'))))throw Error('Historical fixture use has no verified grant')
  const auditCorpus={...corpus,articles:corpus.articles.map(a=>overlays.find(old=>old.articleId===a.articleId)??a)}
  const result=accepted.find(a=>a.runId===run.runId)
  const observationFile=join(working,result.observationFile??`${arm}-${result.id}-observations.jsonl`)
  const observations=checkOnly?readFileSync(observationFile,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line) as Observation):readObservations<Observation>(observationFile)
  if(auditRuns([run],auditCorpus,observations).total)throw Error(`Retained strict audit failed: ${arm}:${result.id}`)
 }
}
if(excludedAttempts.length!==7||accepted.length!==393)throw Error('Unexpected provider-failure set')
if(checkOnly){console.log(JSON.stringify({checkOnly:true,accepted:accepted.length,pending:excludedAttempts.length,strictAudits:'all passed',sourceUnchanged:true}));process.exit(0)}
const identity={modelCeilingUsd,requireProviderSuccess:true,...Object.fromEntries(Object.entries(saved.identity).filter(([k])=>k!=='modelCeilingUsd'))}
identity.corpusSha256=hash(statics);identity.sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
const recovery={reason:'Seven zero-spend provider-failed tasks excluded; 393 valid tasks and every cost hold retained. Only failed tasks receive explicit retry admission keys.',from,originalResultsSha256:createHash('sha256').update(original).digest('hex'),priorIdentity:saved.identity,identity,retained:accepted.length,excluded:excludedAttempts.map(a=>({id:a.result.id,arm:a.result.arm,runId:a.result.runId,reasons:a.reasons})),historicalVersions:historical.map(a=>({articleId:a.articleId,version:a.version,sha256:hash(a)}))}
atomicJson(join(to,'results.json'),{...saved,identity,results:accepted,providerAttempts,excludedAttempts,status:'pending-provider',recovery})
atomicJson(join(to,'summary.json'),{status:'pending-provider',accepted:accepted.length,target:400,pending:excludedAttempts.length,costs:saved.costs})
writeFileSync(join(to,'provider-recovery.json'),JSON.stringify(recovery,null,2)+'\n')
console.log(JSON.stringify({retained:accepted.length,pending:excludedAttempts.length,providerSuccessRequired:true}))
