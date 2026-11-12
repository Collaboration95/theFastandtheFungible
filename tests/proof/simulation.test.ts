import { expect,it } from 'vitest'
import { schedules, faults } from '../../scripts/proof/simulation.js'
it('exercises every real-code crash/fault family and checks five gates',async()=>{
  const result=await schedules(40,279)
  expect(result.violations).toEqual({G1:0,G2:0,G3:0,G4:0,G5:0})
  expect(Object.keys(result.byFault)).toEqual(expect.arrayContaining([...faults]))
  for (const fault of faults.filter(f => f !== 'none')) expect(result.exercised[fault]).toBeGreaterThan(0)
  expect(result.outcomes.VERIFIED).toBeGreaterThan(0)
})
