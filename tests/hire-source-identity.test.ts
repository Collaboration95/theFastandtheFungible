import { expect, it } from 'vitest'
import { royaltyPlan } from '../server/hire/policy.js'
import { sourceKey } from '../shared/source-identity.js'
import { exampleContent, exampleRun, exampleAnswer } from '../shared/contracts/examples.js'
const a = { ...exampleContent, source: {schemaVersion:1 as const,origin:'http://127.0.0.1:1234',sellerKey:'key-A',profileId:exampleContent.profileId,resourceId:exampleContent.resourceId,version:exampleContent.version} }
const b = { ...a, source: {...a.source,origin:'http://127.0.0.1:1235',sellerKey:'key-B'} }
const run = {...exampleRun, contents:[b,a], answers:[{...exampleAnswer,claims:[{id:'b',text:b.spans[0].text,stance:'SUPPORTS' as const,citations:[{resourceId:b.resourceId,version:b.version,source:b.source,spanId:b.spans[0].id}]}]}]}
it('routes a collided citation royalty to its exact source rather than the first local ID or slug',()=>{
  const payments=royaltyPlan(run,{[sourceKey(a)]:'wallet-A',[sourceKey(b)]:'wallet-B',[a.profileId]:'wrong-wallet'})
  expect(payments).toHaveLength(1);expect(payments[0].payTo).toBe('wallet-B');expect(payments[0].amountDrops).toBe('5000')
  expect(()=>royaltyPlan(run,{[sourceKey(a)]:'wallet-A',[a.profileId]:'wrong-wallet'})).toThrow('Unresolved')
})
it('keeps hire-v1 total and gives a migrating same-key writer one share across hosts',()=>{
  const moved={...b,source:{...a.source,origin:b.source.origin}}
  const both={...run,contents:[a,moved],answers:[{...run.answers[0],claims:[{...run.answers[0].claims[0],citations:[a,moved].map(c=>({source:c.source,resourceId:c.resourceId,version:c.version,spanId:c.spans[0].id}))}]}]}
  expect(royaltyPlan(both,{[sourceKey(a)]:'wallet-A',[sourceKey(moved)]:'wallet-A'})).toHaveLength(1)
  expect(royaltyPlan(both,{[sourceKey(a)]:'wallet-A',[sourceKey(moved)]:'wallet-A'})[0].amountDrops).toBe('5000')
})
