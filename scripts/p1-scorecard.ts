import { writeFileSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { evaluateBank, forceFixtureResearch } from '../eval/decisions/offline.js'
forceFixtureResearch()
process.env.BUY_THRESHOLD=''
process.env.SEARCH_EMBEDDINGS='off'
process.env.DECISION_CALIBRATION=''
const ids=JSON.parse(readFileSync('eval/scorecard/receipt-split.json','utf8')).devIds
const output=[]
for(const threshold of [.10,.15,.20,.26,.281,.30]) {
 const flow=await evaluateBank({ids,threshold,flow:'requested',paidRelevance:false})
 assert.equal(flow.results.length,ids.length)
 assert(!flow.results.some(r=>r.error),'Fixture scorecard evaluation failed')
 const spent=flow.results.reduce((s,r)=>s+r.spentMinor,0),wasted=flow.results.reduce((s,r)=>s+r.wastedMinor,0)
 output.push({threshold,ids,spentMinor:spent,wastedMinor:wasted,wastedGrossPct:spent?100*wasted/spent:null,errors:flow.results.filter(r=>r.error),results:flow.results})
 console.log(threshold,spent,wasted,spent?100*wasted/spent:null)
 writeFileSync('docs/evidence/p1-threshold/fixture-scorecard-dev.json',JSON.stringify(output,null,2)+'\n')
}
