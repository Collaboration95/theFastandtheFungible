// Deterministic full-batch L2 logistic regression. Grouped question split; no labels
// or post-purchase content enter features. Threshold is fixed before the holdout.
import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {loadWorld,candidateOf} from './world.js'
import {metadataFeatures,POLICY_FEATURES,predictPolicy} from '../../server/agents/calibrated-policy.js'
import {embedLocal} from '../../server/embeddings/local.js'
import {cosine,keywordRelevance,searchIndex,buildIndex,loadEmbeddingCache} from '../../publisher/search.js'
import {FixtureDecisionProvider} from '../../server/agents/decision.js'
import {loadBank} from '../questions/bank.js'
import {binaryMetrics} from './metrics.js'
import type {DatasetRow} from './dataset.js'
const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
const files=['eval/decisions/datasets/luna-requested-2026-10-09.jsonl','eval/decisions/datasets/luna-fact-menu-sweep-2026-11-03.jsonl']
const rows=files.flatMap(file=>readFileSync(file,'utf8').trim().split('\n').map(line=>JSON.parse(line) as DatasetRow)).filter(r=>r.labels.buy!==null && r.factOpen)
const world=await loadWorld()
for(const p of world.corpus.publishers)world.indexes.set(p.slug,await buildIndex(world.corpus.articles.filter(a=>a.publisherSlug===p.slug),loadEmbeddingCache('data/models/corpus-vectors.json')))
const fixtureProvider=new FixtureDecisionProvider(), bank=loadBank()
const samples: {row:DatasetRow;x:number[];y:number;split:string;fixture:number}[]=[]
const queryCache=new Map<string,number[]>(), candidateCache=new Map<string,number[]>()
for(const row of rows){
 const article=world.articles.get(row.resourceId)
 if(!article)continue
 const index=world.indexes.get(article.publisherSlug)!
 if(!queryCache.has(row.gap))queryCache.set(row.gap,(await embedLocal([row.gap]))[0])
 const ranked=await searchIndex(index,row.gap,100,queryCache.get(row.gap))
 const candidate=candidateOf(world,article,ranked.ranked.find(h=>h.articleId===article.articleId)?.relevance??keywordRelevance(0))
 if(!queryCache.has(row.gap))queryCache.set(row.gap,(await embedLocal([row.gap]))[0])
 if(!candidateCache.has(row.resourceId))candidateCache.set(row.resourceId,(await embedLocal([`${candidate.title} ${candidate.preview} ${candidate.facets.join(' ')}`]))[0])
 const x=metadataFeatures(row.gap,candidate,[],cosine(queryCache.get(row.gap)!,candidateCache.get(row.resourceId)!))
 const bucket=parseInt(hash(`policy-v1:${row.questionId}`).slice(0,8),16)%5
 const f=await fixtureProvider.judgeCandidate({question:bank.questions.find(q=>q.id===row.questionId)?.question??row.gap,gap:row.gap,candidate,readSources:[]})
 samples.push({row,x,y:row.labels.buy as number,fixture:f.addressesGap*f.originality.original*(.5+.25*f.credibility),split:bucket===0?'test':bucket===1?'validation':'train'})
}
const train=samples.filter(s=>s.split==='train')
const variable=POLICY_FEATURES.map((_,j)=>train.some(s=>s.x[j]!==train[0].x[j]))
const model={intercept:0,weights:POLICY_FEATURES.map(()=>0)}
for(let step=0;step<4000;step++){
 let gi=0;const gw=POLICY_FEATURES.map(()=>0)
 for(const s of train){const d=predictPolicy(s.x,model)-s.y;gi+=d;s.x.forEach((v,j)=>{gw[j]+=d*v})}
 model.intercept-=0.1*gi/train.length
 model.weights=model.weights.map((v,j)=>variable[j]?v-0.1*(gw[j]/train.length+0.002*v):0)
}
const threshold=0.2
const payload={schema:'researchagent.policy/v1',version:1,features:POLICY_FEATURES,...model,threshold,fit:{constantFeaturesFixedToZero:POLICY_FEATURES.filter((_,j)=>!variable[j]),iterations:4000,learningRate:0.1,l2:0.002,split:'sha256(policy-v1:questionId) mod 5; test=0, validation=1, train=2..4',sources:files.map(file=>({file,sha256:hash(readFileSync(file,'utf8'))}))}}
writeFileSync('data/calibration/policy-v1.json',JSON.stringify({...payload,sha256:hash(JSON.stringify(payload))},null,2)+'\n')
const report=Object.fromEntries(['train','validation','test'].map(split=>{
 const ss=samples.filter(s=>s.split===split),y=ss.map(s=>s.y),luna=ss.map(s=>s.row.verdict==='BUY'?1:0)
 const p=ss.map(s=>predictPolicy(s.x,model))
 const fixture=ss.map(s=>s.fixture)
 const metrics=(scores:number[],target:number[])=>({...binaryMetrics(target,scores),precisionAtThreshold:scores.filter((p,i)=>p>=threshold&&target[i]===1).length/(scores.filter(p=>p>=threshold).length||1)})
 return [split,{n:ss.length,questions:[...new Set(ss.map(s=>s.row.questionId))],calibrated:metrics(p,y),fixture:metrics(fixture,y),luna:metrics(ss.map(s=>s.row.value),y),againstLunaLabels:metrics(p,luna)}]
}))
writeFileSync('docs/evidence/models/calibration.json',JSON.stringify({threshold,report,limitations:['Historical snapshots lack reputation and read-family context: fit uses documented neutral priors; these features need prospective validation.','Source-grounded buy labels are targets; Luna verdicts are separately reported pseudo labels.','Question groups are disjoint, article/topic families can overlap.','Threshold fixed at 0.2; validation and test are never used in fitting.']},null,2)+'\n')
console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([k,v])=>[k,{...v,questions:v.questions.length}]))))
