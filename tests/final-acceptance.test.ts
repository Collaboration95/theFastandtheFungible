import { expect, test } from 'vitest'
// @ts-expect-error local orchestration helper is JavaScript
import { createStepRunner, acceptanceOutcome } from '../scripts/final-acceptance-steps.mjs'
test('failed build preserves independent checks and skips consumers', async () => {
  const report = { gates: [] as {name: string; status: string; pass: boolean}[] }
  const step = createStepRunner(report, () => {})
  await step('build', async () => { throw Error('build failed') })
  await step('consumer', async () => { throw Error('must not run') }, ['build'])
  let ran = false
  await step('python', async () => { ran = true })
  expect(ran).toBe(true)
  expect(report.gates.map(r => r.status)).toEqual(['FAIL', 'skipped (dependency)', 'PASS'])
  expect(report.gates.every(r => r.pass)).toBe(false)
})
test('fail-fast preserves failed step before throwing', async () => {
  const report = { gates: [] as {status: string; error: string}[] }
  const step = createStepRunner(report, () => {}, true)
  await expect(step('soak', async () => { throw Error('gate miss') })).rejects.toThrow('gate miss')
  expect(report.gates[0]).toMatchObject({status:'FAIL', error:'gate miss'})
})

test('successful quick checks cannot claim full acceptance',()=>{
  expect(acceptanceOutcome([{pass:true}],true)).toEqual({checksPass:true,acceptanceEligible:false,pass:false})
  expect(acceptanceOutcome([{pass:true}],false)).toEqual({checksPass:true,acceptanceEligible:true,pass:true})
  expect(acceptanceOutcome([{pass:false}],true).checksPass).toBe(false)
  expect(acceptanceOutcome([{pass:false}],false).pass).toBe(false)
})

// @ts-expect-error local orchestration helper is JavaScript
import { runGraph } from '../scripts/final-acceptance-steps.mjs'
test('graph overlaps independent work, serializes output writers and bounds concurrency', async () => {
  let active = 0, peak = 0
  const completed: string[] = []
  const task = (name: string, after: string[] = []) => ({ name, after, run: async () => {
    for (const dependency of after) expect(completed).toContain(dependency)
    peak = Math.max(peak, ++active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--; completed.push(name)
  } })
  await runGraph([task('coverage'), task('soak'), task('browser',['coverage']), task('desktop',['browser']), task('artifacts',['desktop'])],{concurrency:2})
  expect(peak).toBe(2); expect(active).toBe(0)
})
test('graph rejects bad dependencies and cycles instead of silently omitting checks', async () => {
  const run = async () => {}
  await expect(runGraph([{name:'one',run,after:['missing']}])).rejects.toThrow('dependency')
  await expect(runGraph([{name:'one',run,after:['two']},{name:'two',run,after:['one']}])).rejects.toThrow('Cyclic')
})
test('fail-fast drains running work before returning its failure', async () => {
  let drained = false, unexpected = false
  await expect(runGraph([
    {name:'failure',run:async()=>{throw Error('injected')}},
    {name:'running',run:async()=>{await new Promise(resolve=>setTimeout(resolve,10));drained=true}},
    {name:'pending',run:async()=>{unexpected=true}},
  ],{concurrency:2,failFast:true})).rejects.toThrow('injected')
  expect(drained).toBe(true);expect(unexpected).toBe(false)
})
