import { expect, test } from 'vitest'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ResourceScope } from '../shared/resource-scope.js'
// @ts-expect-error local orchestration helper is JavaScript
import { admitReuse, fingerprint, outputProof, reusableGates } from '../scripts/acceptance-reuse.mjs'

test('reuse binds clean source, runtime, passed steps, output bytes and fresh age', async () => {
  const scope = new ResourceScope()
  try {
    const dir = await scope.tempDir('acceptance-reuse-')
    const output = join(dir, 'artifact'), receipt = join(dir, 'acceptance.json')
    writeFileSync(output, 'verified artifact')
    const current = {
      sourceSha:'sha', sourceTree:'tree', runnerSha256:'runner', supportSha256:'support', dependencySha256:'deps',
      host:{hostname:'host',platform:'darwin',arch:'arm64',node:'v26'},
      worktreeDirty:false, schedule:{localArchitectures:['arm64']},
    }
    const prior = {...current, sourceStable:true, quick:false, finishedAt:new Date().toISOString(),
      gates:reusableGates.map((name: string) => ({name,pass:true,status:'PASS'})), reuseOutputs:outputProof([output])}
    const save = (value: unknown) => writeFileSync(receipt, JSON.stringify(value))
    save(prior)
    expect(admitReuse(receipt,current).rows).toHaveLength(reusableGates.length)
    for (const key of ['sourceSha','sourceTree','runnerSha256','supportSha256','dependencySha256']) {
      expect(()=>admitReuse(receipt,{...current,[key]:'different'})).toThrow('mismatch')
    }
    expect(()=>admitReuse(receipt,{...current,host:{...current.host,node:'different'}})).toThrow('host')
    expect(()=>admitReuse(receipt,{...current,worktreeDirty:true})).toThrow('clean')
    for (const change of [{sourceStable:false},{quick:true},{worktreeDirty:true},{reuseOutputs:[]},
      {finishedAt:'2020-01-01'}, {gates:prior.gates.filter((row: {name: string})=>row.name!=='coverage')},
      {gates:prior.gates.map((row: {name: string})=>row.name==='chaos'?{...row,pass:false}:row)}]) {
      save({...prior,...change});expect(()=>admitReuse(receipt,current)).toThrow()
    }
    save(prior);writeFileSync(output,'changed bytes')
    expect(()=>admitReuse(receipt,current)).toThrow('output changed')
    expect(fingerprint(output)).not.toBe(prior.reuseOutputs[0].fingerprint)
  } finally { await scope.close() }
})
