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
