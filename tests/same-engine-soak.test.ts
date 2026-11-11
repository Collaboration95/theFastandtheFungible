import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
// @ts-expect-error manual JavaScript harness is intentionally independent of the application build
import { compare, deadline, options, burstPass, checkpointer } from '../scripts/soak-same-engine.mjs'
function evidence() {
  return { options:{runs:200},asks:Array.from({length:200},(_,index)=>({index,stage:'measured',ok:true,rss:200*1048576,ms:index<100?100:200,pid:1,engineId:'one',workerId:4,storeId:'db'})),samples:Array.from({length:61},()=>({stage:'measured',rss:200*1048576,gapMs:1000,hostSleepMs:0,worker:{loopP99Ms:12}})),restarts:Array.from({length:20},()=>({closed:true})),failures:[] as string[],auditViolations:0 }
}
it('uses known independent comparator answers and inclusive/exclusive gate boundaries',()=> {
  const r=evidence(), result=compare(r)
  expect(result.pass).toBe(true)
  expect(result.firstP95Ms).toBe(100);expect(result.lastP95Ms).toBe(200)
  expect(result.gates.latencyP95).toEqual({value:100,limit:250,pass:true})
  expect(result.gates.rssSlope.value).toBe(0)
  // A linear ramp of 1 MiB per ask has exactly 100 MiB/100 asks OLS slope;
  // the two disjoint 100-item windows have medians exactly 100 MiB apart.
  r.asks.forEach((a,i)=>{a.rss=(200+i)*1048576})
  expect(compare(r).gates.rssSlope.value).toBeCloseTo(100,8)
  expect(compare(r).gates.rssMedian).toEqual({value:100,limit:100,pass:true})
  r.samples[0].worker.loopP99Ms=50
  expect(compare(r).gates.loopP99.pass).toBe(false)
})
it('rejects a worker restart disguised as same-process reuse',()=>{const r=evidence();r.asks[120].workerId=5;expect(compare(r).valid).toBe(false)})
it('detects injected retained growth and fails overall',()=>{const r=evidence();r.asks.forEach((a,i)=>{a.rss+=i*1048576});expect(compare(r).gates.rssSlope.pass).toBe(false);expect(compare(r).pass).toBe(false)})
it('marks sample gaps and host sleep invalid',()=>{const r=evidence();r.samples[20].gapMs=8000;expect(compare(r).sampleGaps).toBe(1);expect(compare(r).valid).toBe(false)})
it('times out a hung operation, retains timeout evidence, and rejects missing asks',async()=>{await expect(deadline(new Promise(()=>{}),10)).rejects.toThrow('timeout');const r=evidence();r.failures.push('timeout');r.asks.pop();expect(compare(r).pass).toBe(false)})
it('detects a failed memory gate even with otherwise valid observations',()=>{const r=evidence();r.samples[0].rss=1600*1048576;expect(compare(r).valid).toBe(true);expect(compare(r).gates.rssMax.pass).toBe(false);expect(compare(r).pass).toBe(false)})
it('uses the relative latency allowance when it exceeds 250 ms',()=>{const r=evidence();r.asks.forEach((a,i)=>{a.ms=i<100?2000:2400});expect(compare(r).gates.latencyP95).toEqual({value:400,limit:400,pass:true});r.asks[199].ms=5000;expect(compare(r).gates.latencyP95.pass).toBe(true);for(let i=190;i<200;i++)r.asks[i].ms=2401;expect(compare(r).gates.latencyP95.pass).toBe(false)})

it('preserves string profile-directory flags without changing default invocation', () => {
  const args = ['--runs', '6', '--data-dir', '/tmp/fresh', '--output', '/tmp/report.json']
  expect(options(args).cpuProfDir).toBeUndefined()
  expect(options([...args, '--cpu-prof-dir', '/tmp/profiles']).cpuProfDir).toBe('/tmp/profiles')
  expect(options(args).runs).toBe(6)
})

it('accepts the implemented burst flag and rejects failed or absent burst evidence',()=>{
  expect(options(['--burst','--data-dir','/tmp/fresh','--output','/tmp/report']).burst).toBe(true)
  const r={...evidence(),options:{runs:200,burst:true},burst:{pass:false}}
  expect(compare(r).pass).toBe(false)
  r.burst.pass=true;expect(compare(r).pass).toBe(true)
})

it('checks concurrent leases rather than cumulative admissions, retaining the cap of four',()=>{
  const burst={peak:4,activeAfterDrain:0,admitted:6,overloaded:94,idempotentRetries:6}
  expect(burstPass(burst)).toBe(true)
  expect(burstPass({...burst,peak:5})).toBe(false)
  expect(burstPass({...burst,activeAfterDrain:1})).toBe(false)
  expect(burstPass({...burst,idempotentRetries:5})).toBe(false)
  expect(burstPass({...burst,overloaded:93})).toBe(false)
})

it('retains a failed short slope as diagnostic without exempting other gates',()=>{
  const r={...evidence(),options:{runs:200,diagnosticSlope:true}}
  // +10 MiB/100 asks: median/max pass, slope misses the unchanged limit.
  r.asks.forEach((a,i)=>{a.rss+=i*0.1*1048576})
  const result=compare(r)
  expect(result.gates.rssSlope).toMatchObject({limit:5,pass:false,gating:false})
  expect(result.pass).toBe(true)
  expect(result.acceptanceEligible).toBe(false)
  r.samples[0].worker.loopP99Ms=50
  expect(compare(r).pass).toBe(false)
  r.samples[0].worker.loopP99Ms=12
  r.samples[0].rss=1600*1048576
  expect(compare(r).pass).toBe(false)
})
it('cannot disable the full-run slope through CLI or report options',()=>{
  const args=['--data-dir','/tmp/fresh','--output','/tmp/report','--diagnostic-slope']
  expect(()=>options(args)).toThrow('full-run gate is mandatory')
  expect(options([...args,'--runs','200']).diagnosticSlope).toBe(true)
  const r={...evidence(),options:{runs:2000,diagnosticSlope:true}}
  r.asks=Array.from({length:2000},(_,index)=>({...r.asks[0],index,rss:(200+index*0.1)*1048576}))
  expect(compare(r).valid).toBe(true)
  expect(compare(r).gates.rssSlope).toMatchObject({limit:5,pass:false})
  expect(compare(r).gates.rssSlope.gating).toBeUndefined()
  expect(compare(r).pass).toBe(false)
})

it('replays the historical quick miss without rewriting its measured slope',()=>{
  const r=JSON.parse(readFileSync(new URL('../docs/evidence/round2-h2/integrated-quick-soak-279.json',import.meta.url),'utf8'))
  expect(compare(r).pass).toBe(false)
  r.options.diagnosticSlope=true
  const diagnostic=compare(r)
  expect(diagnostic.gates.rssSlope.value).toBeCloseTo(77.366358,5)
  expect(diagnostic.gates.rssSlope.pass).toBe(false)
  expect(diagnostic.gates.rssSlope.gating).toBe(false)
  expect(diagnostic.pass).toBe(true)
  expect(diagnostic.acceptanceEligible).toBe(false)
})

it('checkpoints the report at most once per interval, starting with the first ask',()=>{
  let t=0,saves=0
  const checkpoint=checkpointer(()=>{saves++},5000,()=>t)
  checkpoint();expect(saves).toBe(1)
  for(t=1;t<5000;t+=250)checkpoint()
  expect(saves).toBe(1)
  t=5000;checkpoint();expect(saves).toBe(2)
  t=5001;checkpoint();expect(saves).toBe(2)
})
