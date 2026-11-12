import {afterEach,expect,it,vi} from 'vitest'
import {CalibratedDecisionProvider,metadataFeatures,predictPolicy} from '../server/agents/calibrated-policy.js'
import {decide} from '../server/agents/decision.js'
import {exampleCandidate} from '../shared/contracts/examples.js'
import {decisionLabel} from '../shared/contracts/decision.js'
vi.mock('../server/embeddings/local.js',()=>({embedLocal:vi.fn(async (texts:string[])=>texts.map(()=>[1,0])),LOCAL_MODEL:'test',LOCAL_DIMS:2,localCacheFile:()=>'/missing'}))
afterEach(()=>vi.restoreAllMocks())
it('uses public metadata, prices and promise history deterministically',()=>{
 const c={...exampleCandidate,reputation:{T:.3,H:.4,C:.5,status:'active' as const}}
 const f=metadataFeatures('grid energisation',c,[],.7)
 expect(f.slice(2,6)).toEqual([c.price.amountMinor/100,.3,.4,.5])
 expect(predictPolicy(f,{intercept:0,weights:f.map(()=>0)})).toBe(.5)
 expect(decisionLabel({provider:'calibrated',model:'v1'})).toContain('Calibrated policy model')
})
it('policy rejects a maximum model score without budget and deducts reservations',async()=>{
 const provider=new CalibratedDecisionProvider()
 vi.spyOn(provider,'judgeCandidate').mockResolvedValue({addressesGap:1,originality:{original:1,rewrite:0,overlap:0},credibility:2})
 const candidate={...exampleCandidate,tier:'PAID' as const,price:{amountMinor:40,currency:'SGD' as const},title:'Grid energisation dates',preview:'Grid energisation dates',facets:['grid','energisation'],family:'new-grid'}
 const base={question:'Grid energisation dates',conclusion:'',gap:'Grid energisation dates',candidates:[candidate],readSources:[],budgetMinor:0,spentMinor:0,reservedMinor:0,perSourceCapMinor:100,round:1,provider}
 for(const input of [base,{...base,budgetMinor:100,spentMinor:40,reservedMinor:40}]){
  const r=await decide(input)
  expect(r.rows[0].value).toBe(1)
  expect(r.rows[0].verdict).toBe('SKIP_OVER_BUDGET')
  expect(r.selectedResourceId).toBeUndefined()
 }
 expect((await decide({...base,budgetMinor:100})).selectedResourceId).toBe(candidate.resourceId)
 expect((await decide({...base,budgetMinor:100,boughtResourceIds:[candidate.resourceId]})).selectedResourceId).toBeUndefined()
})
