import { expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
vi.mock('../scripts/chaos/child.mjs', () => ({ runChild: vi.fn() }))
import { runChild } from '../scripts/chaos/child.mjs'
import { chaos } from '../scripts/chaos.mjs'
it('counts a watchdog on an expected-kill fault as a violation, saves context and continues', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chaos-continuation-')), output = join(dir,'summary.json')
  runChild.mockResolvedValueOnce({code:0, signal:null, timedOut:false, tail:JSON.stringify({iterations:0})})
  runChild.mockResolvedValueOnce({code:null, signal:'SIGKILL', timedOut:true,tail:'last child output',elapsedMs:45001})
  runChild.mockImplementationOnce(async args => {
    const work = args[5]
    writeFileSync(join(work,'result.json'), JSON.stringify({ faultsInjected:1, payments:0, refunds:0, stuckReservations:0, reservationsHeld:0, rss:123, handles:2, metrics:{} }))
    return {code:0,signal:null,timedOut:false}
  })
  try {
    const result = await chaos({runs:2, output})
    expect(runChild).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({attempts:2, iterations:1, invariantViolations:1, processKills:0})
    expect(JSON.parse(readFileSync(output+'.watchdog-0.json','utf8'))).toMatchObject({fault:'kill-before-sign',tail:'last child output'})
    expect(JSON.parse(readFileSync(output,'utf8')).windows).toHaveLength(1)
  } finally { rmSync(dir,{recursive:true,force:true}) }
})
