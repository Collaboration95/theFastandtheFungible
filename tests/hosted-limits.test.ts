import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { resources } from './helpers/resource-scope.js'
import { Store } from '../server/store.js'
import { loadConfig } from '../server/config.js'
import { HostedLimits, LIMITS } from '../server/hosted/limits.js'
import { HostedQueue } from '../server/hosted/queue.js'
import { readControl, requireAdmissions } from '../server/hosted/control.js'
import { hostedExecution, meteredFetch } from '../server/hosted/execution.js'
beforeEach(() => { vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-10T12:00:00Z')) })
const cleanup:(()=>unknown)[]=[]
afterEach(async()=>{for(const f of cleanup.splice(0).reverse()) await f();vi.unstubAllEnvs();vi.restoreAllMocks()})
function setup() {
  const dir=resources().tempDir('hg-limits-'), control=join(dir,'control.json'), db=join(dir,'app.db')
  let now=Date.parse('2026-11-10T23:59:00Z')
  const c=loadConfig({HOSTED:'1',HOSTED_CONTROL_PATH:control,HOSTED_IP_HMAC_KEY:'key'.repeat(12),HOSTED_RESEARCH_INPUT_USD_PER_MILLION:'1',HOSTED_RESEARCH_OUTPUT_USD_PER_MILLION:'1'})
  const write=(admissionsPaused=false,spendingPaused=false)=>writeFileSync(control,JSON.stringify({admissionsPaused,spendingPaused,reasonCode:'test',expiresAt:'2026-11-19T16:00:00Z'}))
  write()
  const a=new Store(db),b=new Store(db);cleanup.push(()=>a.close(),()=>b.close())
  return {a,b,c,write,control,limits:new HostedLimits(a,c,()=>now),other:new HostedLimits(b,c,()=>now),advance:(ms:number)=>now+=ms}
}
it('keeps only cookie hashes server-side and uses absolute 24h expiry',()=>{
  const {a,limits,advance}=setup(),s=limits.session()
  expect(s.token).toHaveLength(64); expect(s.principal).not.toBe(s.token)
  expect(JSON.stringify(a.hostedState(db=>db.prepare('SELECT * FROM hosted_sessions').all()))).not.toContain(s.token)
  expect(limits.session(s.token).principal).toBe(s.principal)
  advance(86400000);expect(limits.session(s.token).principal).not.toBe(s.principal)
})
it('binds normalized full request digests and keeps idempotence before pause or capacity',()=>{
  const {limits,write}=setup()
  const a=limits.reserve('a','key','question','1.2.3.4',200,'submit',{budgetMinor:200,question:'question',answers:{a:'one'}})
  write(true,true)
  expect(limits.reserve('a','key','question','1.2.3.4',200,'submit',{answers:{a:'one'},question:'question',budgetMinor:200}).id).toBe(a.id)
  for(const body of [{budgetMinor:199},{answers:{a:'two'}},{escrow:false}]) expect(()=>limits.reserve('a','key','question','1.2.3.4',200,'submit',body)).toThrow('idempotency_conflict')
})
it('serializes session/IP/global caps across independent journal connections, midnight and restart',()=>{
  const {limits,other,a,b,c,advance}=setup()
  const holds=[]
  for(let i=0;i<300;i++) {
    const writer=i%2?limits:other
    const h=writer.reserve('visitor'+i,'key','question','10.0.'+Math.floor(i/2)+'.'+(i%2),200,'submit',{i})
    writer.update(h.id,{state:'active'});holds.push(h)
  }
  expect(()=>other.reserve('overflow','key','question','2.3.4.5',200,'submit',{})).toThrow('allowance_exhausted')
  expect(a.hostedState(db=>db.prepare('SELECT sum(minor) AS n FROM hosted_holds').get()!.n)).toBe(60000)
  advance(120000)
  expect(()=>limits.reserve('nextday','key','question','2.3.4.5',200,'submit',{})).toThrow('allowance_exhausted')
  const restarted=new HostedLimits(b,c,()=>Date.parse('2026-11-11T00:01:00Z'))
  expect(()=>restarted.reserve('restart','key','question','2.3.4.5',200,'submit',{})).toThrow('allowance_exhausted')
  expect(JSON.stringify(a.hostedState(db=>db.prepare('SELECT * FROM hosted_holds').all()))).not.toContain('10.0.')
})
it('enforces one outstanding ask, session questions/gross and six IP starts per minute (H9-09)',()=>{
  const {limits,advance}=setup();advance(-600000)
  const first=limits.reserve('a','1','q','1.1.1.1',200,'submit',{})
  expect(()=>limits.reserve('a','2','q','2.2.2.2',200,'submit',{})).toThrow('session_busy')
  limits.update(first.id,{state:'done'})
  for(let i=2;i<=5;i++){advance(61000);const h=limits.reserve('a',String(i),'q','1.1.1.1',200,'submit',{});limits.update(h.id,{state:'done'})}
  expect(()=>limits.reserve('a','6','q','1.1.1.1',1,'submit',{})).toThrow('allowance_exhausted')
  for(let i=0;i<6;i++) limits.reserve('burst'+i,'k','q','9.9.9.9',0,'submit',{})
  expect(()=>limits.reserve('burst7','k','q','9.9.9.9',0,'submit',{})).toThrow('start_rate')
})
it('charges failed and partial model attempts before transport, with conservative per-question and token ceilings',async()=>{
  const {limits,c,write,a}=setup();vi.stubEnv('HOSTED','1')
  const h=limits.reserve('a','k','q','1.1.1.1',0,'submit',{})
  const transport=vi.fn(async()=>{throw new Error('partial timeout')})
  const call=()=>hostedExecution.run({limits,holdId:h.id,principal:'a'},()=>meteredFetch(transport,'research')('https://provider.test',{body:JSON.stringify({model:'test',max_tokens:3000,messages:['q']})}))
  await expect(call()).rejects.toThrow('partial timeout');await expect(call()).rejects.toThrow('partial timeout');await expect(call()).rejects.toThrow('question_token_cap')
  expect(transport).toHaveBeenCalledTimes(2)
  expect(a.hostedState(db=>db.prepare('SELECT count(*) AS n FROM hosted_attempts').get()!.n)).toBe(2)
  write(false,true);await expect(call()).rejects.toThrow('spending_paused')
  expect(c.HOSTED).toBe('1')
})
it('fails missing/unreadable/expired controls closed while separating admissions and spending',()=>{
  const {c,write,control}=setup();write(true,false)
  expect(()=>requireAdmissions(c)).toThrow('paused');expect(readControl(control).spendingPaused).toBe(false)
  writeFileSync(control,'bad-json');expect(readControl(control).spendingPaused).toBe(true)
  unlinkSync(control);expect(readControl(control).admissionsPaused).toBe(true)
  writeFileSync(control,JSON.stringify({admissionsPaused:false,spendingPaused:false,reasonCode:'ready',expiresAt:'2026-01-01T00:00:00Z'}));expect(readControl(control).spendingPaused).toBe(true)
})
it('runs one job, exposes two waiting positions, cancels and expires without starting new work',async()=>{
  const {c,write}=setup();let now=0;const queue=new HostedQueue(c,()=>now);cleanup.push(()=>queue.close())
  let finish!:()=>void;const start=vi.fn(()=>new Promise<void>(resolve=>finish=resolve)),second=vi.fn(async()=>{}),expired=vi.fn()
  queue.enqueue('a',start,expired);queue.enqueue('b',second,expired);queue.enqueue('c',second,expired)
  expect(queue.position('a')).toBe(0);expect(queue.position('b')).toBe(1);expect(queue.position('c')).toBe(2)
  expect(()=>queue.enqueue('d',second,expired)).toThrow('queue_full')
  expect(queue.cancel('b')).toBe(true);now=LIMITS.queueMs;queue.tick();expect(expired).toHaveBeenCalledTimes(2)
  await Promise.resolve();finish();await Promise.resolve();expect(second).not.toHaveBeenCalled()
  write(true,true);expect(()=>queue.enqueue('e',second,expired)).toThrow('paused')
})

it('releases only provider-proven usage and proven unspent terminal principal, preserving gross refunds',async()=>{
  const {limits,a}=setup();vi.stubEnv('HOSTED','1')
  const hold=limits.reserve('a','k','q','1.1.1.1',200,'submit',{})
  const run=a.admit({surface:'web',principal:'a',question:'q',requestedMinor:200,maxMinor:200,idempotencyKey:'k'}).run
  limits.update(hold.id,{run_id:run.runId})
  const call=meteredFetch(async()=>new Response(JSON.stringify({usage:{prompt_tokens:1,completion_tokens:2}}),{headers:{'Content-Type':'application/json'}}),'research')
  await hostedExecution.run({limits,holdId:hold.id,principal:'a'},async()=>{await (await call('https://provider.test',{body:JSON.stringify({model:'test',max_tokens:3000})})).json()})
  expect(a.hostedState(db=>db.prepare('SELECT reserved FROM hosted_attempts').get()!.reserved)).toBe(3)
  a.updateRun(run.runId,{phase:'DONE'});limits.settle(hold.id)
  expect(limits.forRun(run.runId)?.minor).toBe(0)
  expect(a.hostedState(db=>db.prepare('SELECT model_envelope FROM hosted_holds').get()!.model_envelope)).toBe(3)
})

it('settles a streamed attempt at the provider’s [DONE] marker, though the reader cancels before the stream ends (H5)',async()=>{
  const {limits,a}=setup();vi.stubEnv('HOSTED','1')
  const h=limits.reserve('a','k','q','1.1.1.1',0,'submit',{})
  const encoder=new TextEncoder()
  // DeepSeek-style SSE: content, a final usage frame, [DONE]; the socket closes later.
  const transport=async()=>new Response(new ReadableStream({async start(controller){
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"{}"}}],"usage":null}\n\ndata: {"choices":[],"usage":{"prompt_tokens":40,"completion_tokens":7}}\n\ndata: [DONE]\n\n'))
    await new Promise(resolve=>setTimeout(resolve,20));controller.close()
  }}),{headers:{'Content-Type':'text/event-stream'}})
  // Read like server/agents/llm.ts: stop at [DONE], then cancel the reader.
  const call=()=>hostedExecution.run({limits,holdId:h.id,principal:'a'},async()=>{
    const reader=(await meteredFetch(transport,'research')('https://provider.test',{body:JSON.stringify({model:'test',max_tokens:3000})})).body!.getReader()
    const decoder=new TextDecoder();let pending='',finished=false
    while(!finished){const {value,done}=await reader.read();pending+=decoder.decode(value,{stream:!done});const lines=pending.split('\n');pending=lines.pop()??'';finished=lines.some(line=>line.trim()==='data: [DONE]')||done}
    await reader.cancel()
  })
  // Before the fix every call kept its 3,000-token worst case, so the third call hit question_token_cap and the answer fell back to offline extracts.
  for(let i=0;i<4;i++) await call()
  const rows=a.hostedState(db=>db.prepare('SELECT reserved,input_tokens,output_tokens FROM hosted_attempts').all())
  expect(rows).toEqual(Array(4).fill({reserved:47,input_tokens:40,output_tokens:7}))
})

it('a new question replaces the visitor’s own unstarted plan or chat reply instead of waiting 90 seconds (H5)',()=>{
  const {limits,a}=setup()
  // A finished scope (a plan the visitor cancelled, or a chat reply) is a draft with a cached scope result.
  const chat=limits.reserve('a','chat','hi','1.1.1.1',200,'scope',{question:'hi'})
  limits.update(chat.id,{scope_result:JSON.stringify({chat:{reply:'Hello'}}),state:'draft'})
  const next=limits.reserve('a','next','q','1.1.1.1',200,'scope',{question:'q'})
  expect(next.state).toBe('draft')
  const old=a.hostedState(db=>db.prepare('SELECT state,minor,gross_open FROM hosted_holds WHERE id=?').get(chat.id))
  expect(old).toEqual({state:'expired',minor:0,gross_open:0})
  // The replaced question still counts; its money does not.
  expect(limits.remaining('a')).toEqual({questions:3,minor:800})
  // A scope still in progress (no result yet) keeps the one-question-at-a-time rule.
  expect(()=>limits.reserve('a','third','q3','1.1.1.1',200,'scope',{question:'q3'})).toThrow('session_busy')
})

it('names a fixture decision model in the environment label (H5: the live chip said "live models")',async()=>{
  const {modelsLabel}=await import('../server/hosted/routes.js')
  expect(modelsLabel(true,false)).toBe('live research · fixture purchase decisions · per-answer fallback labelled')
  expect(modelsLabel(true,true)).toBe('live research and purchase decisions · per-answer fallback labelled')
  expect(modelsLabel(false,false)).toBe('fixture models')
})
