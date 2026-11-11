import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { resources } from './helpers/resource-scope.js'
import { Store } from '../server/store.js'
import { loadConfig } from '../server/config.js'
import { HostedLimits, LIMITS, mintGroup } from '../server/hosted/limits.js'
import { HostedQueue, HostedPlanLane } from '../server/hosted/queue.js'
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
  limits.update(first.id,{state:'done',run_id:'run-1'})
  for(let i=2;i<=5;i++){advance(61000);const h=limits.reserve('a',String(i),'q','1.1.1.1',200,'submit',{});limits.update(h.id,{state:'done',run_id:`run-${i}`})}
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
  // Owner decision: unstarted plans do not use a daily question; replaced money is still released.
  expect(limits.remaining('a')).toEqual({questions:5,minor:800})
  // A scope still in progress (no result yet) keeps the one-question-at-a-time rule.
  expect(()=>limits.reserve('a','third','q3','1.1.1.1',200,'scope',{question:'q3'})).toThrow('session_busy')
})

it('names a fixture decision model in the environment label (H5: the live chip said "live models")',async()=>{
  const {modelsLabel}=await import('../server/hosted/routes.js')
  expect(modelsLabel(true,false)).toBe('live research · fixture purchase decisions · per-answer fallback labelled')
  expect(modelsLabel(true,true)).toBe('live research and purchase decisions · per-answer fallback labelled')
  expect(modelsLabel(false,false)).toBe('fixture models')
})

// H7: a cookieless script must not be able to fill the session table and lock real visitors out.
const mintsFrom = (limits: HostedLimits, ip: string, n: number) => Array.from({ length: n }, () => limits.session(undefined, ip))
it('caps new sessions per address per hour, across midnight, and stores only a daily-rotating HMAC of the address', () => {
  const { a, limits, advance } = setup(), ip = '203.0.113.9'
  const minted = mintsFrom(limits, ip, LIMITS.sessionMintsPerIpHour)
  expect(() => limits.session(undefined, ip)).toThrow('session_rate')
  // A visitor who already holds a cookie (a reload, another tab) is not a new session and is never refused by the cap.
  expect(limits.session(minted[0].token, ip).principal).toBe(minted[0].principal)
  // Another address is unaffected, and so is a caller that gives no address (in-process use).
  expect(limits.session(undefined, '203.0.113.10').token).toHaveLength(64)
  expect(limits.session().token).toHaveLength(64)
  // Half an hour later the clock has crossed midnight UTC (the HMAC key rotated); the earlier mints still count.
  advance(30 * 60000); expect(() => limits.session(undefined, ip)).toThrow('session_rate')
  advance(30 * 60000 + 1); expect(limits.session(undefined, ip).token).toHaveLength(64)
  expect(JSON.stringify(a.hostedState(db => db.prepare('SELECT * FROM hosted_session_mints').all()))).not.toContain(ip)
  // Records older than an hour are removed by the retention pass.
  advance(3600000); limits.expireSessions()
  expect(a.hostedState(db => Number(db.prepare('SELECT count(*) AS n FROM hosted_session_mints').get()!.n))).toBe(0)
})
it('drops a session that never asked a question after 2 h, and keeps one that asked for 24 h', () => {
  const { limits, advance } = setup()
  const idle = limits.session(undefined, '198.51.100.1'), asked = limits.session(undefined, '198.51.100.2')
  limits.reserve(asked.principal, 'k', 'a question', '198.51.100.2', 200, 'scope', {})
  advance(LIMITS.sessionIdleMs - 1)
  expect(limits.session(idle.token).principal).toBe(idle.principal)
  advance(2)
  expect(limits.session(idle.token).principal).not.toBe(idle.principal)
  expect(limits.session(asked.token).principal).toBe(asked.principal)
  limits.expireSessions()
  expect(limits.session(asked.token).principal).toBe(asked.principal)
  advance(86400000 - LIMITS.sessionIdleMs)
  expect(limits.session(asked.token).principal).not.toBe(asked.principal)
})
it('keeps the money caps and the per-session question allowance when an idle session is replaced', () => {
  const { limits, advance } = setup()
  const first = limits.session(undefined, '198.51.100.3')
  expect(limits.remaining(first.principal)).toEqual({ questions: LIMITS.sessionQuestions, minor: LIMITS.sessionMinor })
  advance(LIMITS.sessionIdleMs + 1)
  const second = limits.session(first.token, '198.51.100.3')
  expect(second.principal).not.toBe(first.principal)
  // It asked nothing, so nothing was forgotten; the per-address daily cap is unchanged by a new session.
  expect(limits.remaining(second.principal)).toEqual({ questions: LIMITS.sessionQuestions, minor: LIMITS.sessionMinor })
  for (let i = 0; i < LIMITS.sessionQuestions; i++) limits.update(limits.reserve(second.principal, `q${i}`, `question ${i}`, '198.51.100.3', 0, 'submit', { i }).id, { state: 'done', run_id: `run-${i}` })
  expect(() => limits.reserve(second.principal, 'one-more', 'one more', '198.51.100.3', 0, 'submit', {})).toThrow('allowance_exhausted')
})
it('when the table is full, drops the oldest idle sessions at least 10 min old before refusing anyone, and never one that asked', () => {
  const { a, limits, advance } = setup()
  const fill = (n: number, ageMs: number, prefix: string) => a.hostedState(db => {
    for (let i = 0; i < n; i++) db.prepare('INSERT INTO hosted_sessions VALUES (?,?,?)').run(`${prefix}${i}`, 'c', limits.now() + 86400000 - ageMs + i)
  })
  const count = () => a.hostedState(db => Number(db.prepare('SELECT count(*) AS n FROM hosted_sessions').get()!.n))
  // 4,990 idle sessions 1 minute old plus 10 that asked a question 15 minutes ago: nothing is old enough to drop.
  fill(LIMITS.sessionCeiling - 10, 60000, 'young'); fill(10, 15 * 60000, 'asked')
  for (let i = 0; i < 10; i++) limits.reserve(`asked${i}`, 'k', 'a question', `198.51.100.${40 + i}`, 0, 'submit', {})
  expect(count()).toBe(LIMITS.sessionCeiling)
  expect(() => limits.session(undefined, '198.51.100.5')).toThrow('session_limit')
  // Ten minutes on, the idle ones are old enough: the oldest batch goes, a newcomer gets in, and every asked session stays.
  advance(10 * 60000)
  expect(limits.session(undefined, '198.51.100.5').token).toHaveLength(64)
  expect(count()).toBe(LIMITS.sessionCeiling - LIMITS.sessionEvictBatch + 1)
  for (let i = 0; i < 10; i++) expect(a.hostedState(db => db.prepare('SELECT 1 FROM hosted_sessions WHERE principal=?').get(`asked${i}`))).toBeTruthy()
})
it('counts an IPv6 client by its /64, so rotating addresses inside one allocation does not escape the session cap', () => {
  expect(mintGroup('203.0.113.9')).toBe('203.0.113.9')
  expect(mintGroup('::ffff:203.0.113.9')).toBe('203.0.113.9')
  const one = ['2001:db8:1:2::1', '2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd', '2001:DB8:1:2:0:0:0:7', '2001:db8:1:2:ffff:ffff:ffff:ffff%eth0'].map(mintGroup)
  expect(new Set(one)).toEqual(new Set(['2001:db8:1:2::/64']))
  expect(mintGroup('2001:db8:1:3::1')).not.toBe(mintGroup('2001:db8:1:2::1'))
  expect(mintGroup('2001:db8::1')).toBe('2001:db8:0:0::/64')
  expect(mintGroup('::1')).toBe('0:0:0:0::/64')
  const { limits } = setup()
  for (let i = 0; i < LIMITS.sessionMintsPerIpHour; i++) limits.session(undefined, `2001:db8:1:2:${i.toString(16)}::${i + 1}`)
  expect(() => limits.session(undefined, '2001:db8:1:2:dead:beef::1')).toThrow('session_rate')
  expect(limits.session(undefined, '2001:db8:1:3::1').token).toHaveLength(64)
})

it('estimates a queued question’s wait from recent runs, rounded up to 5 s, and says nothing before one has finished (H7)', async () => {
  const { c } = setup(); let now = 0
  const queue = new HostedQueue(c, () => now); cleanup.push(() => queue.close())
  expect(queue.estimateSeconds()).toBeUndefined()
  for (const [i, seconds] of [20, 40, 30].entries()) {
    let finish: (() => void) | undefined
    queue.enqueue(`r${i}`, () => new Promise<void>(resolve => { finish = resolve }), vi.fn())
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    if (i === 0) expect(queue.estimateSeconds()).toBeUndefined() // the first is still running: nothing has finished
    now += seconds * 1000; finish!(); await vi.waitFor(() => expect(queue.busy).toBe(false))
    if (i === 0) expect(queue.estimateSeconds()).toBe(0) // idle: a new question starts at once
  }
  // Typical run: the median of 20, 40 and 30 s is 30 s. One started 12 s ago, two wait: a new arrival is third.
  queue.enqueue('running', () => new Promise<void>(() => undefined), vi.fn()); now += 12000
  queue.enqueue('w1', async () => undefined, vi.fn()); queue.enqueue('w2', async () => undefined, vi.fn())
  expect(queue.estimateSeconds(0)).toBe(0)
  expect(queue.estimateSeconds(1)).toBe(20) // 30 - 12 left of the running one
  expect(queue.estimateSeconds(2)).toBe(50) // + one typical run
  expect(queue.estimateSeconds(3)).toBe(80)
  // A run past its typical length is never promised sooner than 10 s.
  now += 60000; expect(queue.estimateSeconds(1)).toBe(10)
})
it('uses the median of exactly the last ten completed runs, including an even-sized history (H7)', async () => {
  const { c } = setup(); let now = 0
  const queue = new HostedQueue(c, () => now); cleanup.push(() => queue.close())
  for (const [i, seconds] of [999, 999, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].entries()) {
    let finish: (() => void) | undefined
    queue.enqueue(`history-${i}`, () => new Promise<void>(resolve => { finish = resolve }), vi.fn())
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'), { interval: 1 })
    now += seconds * 1000; finish!()
    await vi.waitFor(() => expect(queue.busy).toBe(false), { interval: 1 })
  }
  queue.enqueue('next', () => new Promise<void>(() => undefined), vi.fn())
  // The old 999 s outliers are gone; the middle two of 10..100 s are 50 and 60.
  expect(queue.estimateSeconds(1)).toBe(55)
  expect(queue.estimateSeconds(2)).toBe(110)
})
it('plans in a small lane of its own: two at once, a short wait for the next, then busy (H7)', async () => {
  vi.useFakeTimers()
  try {
    const lane = new HostedPlanLane({ concurrent: 2, waiting: 1, waitMs: 5000 })
    const gates: (() => void)[] = [], started: string[] = []
    const plan = (name: string) => lane.run(() => new Promise<string>(resolve => { started.push(name); gates.push(() => resolve(name)) }))
    const a = plan('a'), b = plan('b'), c = plan('c')
    expect(started).toEqual(['a', 'b']) // two run; the third waits for a free place
    await expect(plan('d')).rejects.toMatchObject({ status: 429, code: 'busy' }) // the waiting place is taken too
    gates[0](); expect(await a).toBe('a')
    await vi.advanceTimersByTimeAsync(0); expect(started).toEqual(['a', 'b', 'c'])
    gates[1](); gates[2](); expect(await Promise.all([b, c])).toEqual(['b', 'c'])
    expect(lane.depth).toBe(0)
    // A wait that outlasts the limit is refused as busy, and the place is given up.
    const x = plan('x'), y = plan('y'), z = plan('z'), zRefused = expect(z).rejects.toMatchObject({ code: 'busy' })
    await vi.advanceTimersByTimeAsync(5001); await zRefused
    expect(lane.depth).toBe(2)
    gates.splice(0).forEach(open => open()); await Promise.all([x, y])
    expect(lane.depth).toBe(0)
  } finally { vi.useRealTimers() }
})

it('counts cancelled or abandoned plans separately from started questions, with 15 plans per session per UTC day', () => {
  const { limits, advance } = setup(); advance(-3_600_000)
  for (let i = 0; i < 15; i++) {
    const h = limits.reserve('judge', `plan-${i}`, 'XRPL', '203.0.113.90', 200, 'scope', { question: 'XRPL' })
    limits.update(h.id, { scope_result: '{}', state: 'draft' })
    expect(limits.remaining('judge').questions).toBe(5)
    advance(61_000)
  }
  expect(() => limits.reserve('judge', 'plan-16', 'XRPL', '203.0.113.90', 200, 'scope', {})).toThrow('plan_limit')
  const h = limits.reserve('judge', 'plan-14', 'XRPL', '203.0.113.90', 200, 'submit', {})
  expect(limits.remaining('judge').questions).toBe(5) // reservation alone creates no run
  limits.update(h.id, { state: 'done', run_id: 'accepted-run' })
  expect(limits.reserve('judge', 'plan-14', 'XRPL', '203.0.113.90', 200, 'submit', {}).id).toBe(h.id)
  expect(limits.remaining('judge').questions).toBe(4)
})
it('checks the five-question cap when promoting an existing plan to Start', () => {
  const { limits, advance } = setup(); advance(-3_600_000)
  const pending = limits.reserve('judge', 'pending', 'XRPL', '203.0.113.90', 0, 'scope', {})
  limits.update(pending.id, { scope_result: '{}', state: 'draft' })
  for (let i = 0; i < 5; i++) { advance(61_000); const h = limits.reserve('judge', `start-${i}`, 'XRPL', '203.0.113.90', 0, 'submit', {}); limits.update(h.id, { state: 'done', run_id: `accepted-${i}` }) }
  expect(() => limits.reserve('judge', 'pending', 'XRPL', '203.0.113.90', 0, 'submit', {})).toThrow('allowance_exhausted')
})

it('charges a plan started across midnight to the day Start is accepted, once', () => {
  const { limits, advance } = setup()
  const h = limits.reserve('judge', 'plan', 'XRPL', '203.0.113.90', 0, 'scope', {})
  limits.update(h.id, { scope_result: '{}', state: 'draft' })
  advance(120_000)
  limits.reserve('judge', 'plan', 'XRPL', '203.0.113.90', 0, 'submit', {})
  limits.update(h.id, { run_id: 'midnight-run', state: 'done' })
  expect(limits.remaining('judge').questions).toBe(4)
  advance(86_400_000)
  expect(limits.remaining('judge').questions).toBe(5)
  limits.update(h.id, { run_id: 'midnight-run' })
  expect(limits.remaining('judge').questions).toBe(5)
})

it('migrates already-started holds without resetting the question count, and leaves old drafts free', () => {
  const { limits, a, c } = setup()
  const started = limits.reserve('judge', 'started', 'XRPL', '203.0.113.90', 0, 'submit', {})
  limits.update(started.id, { run_id: 'existing-run', state: 'done' })
  const draft = limits.reserve('judge', 'draft', 'XRPL', '203.0.113.90', 0, 'scope', {})
  limits.update(draft.id, { scope_result: '{}', state: 'draft' })
  a.hostedState(db => db.exec('ALTER TABLE hosted_holds DROP COLUMN started_day'))
  const upgraded = new HostedLimits(a, c, limits.now)
  expect(upgraded.remaining('judge').questions).toBe(4)
  expect(upgraded.reserve('judge', 'draft', 'XRPL', '203.0.113.90', 0, 'scope', {}).id).toBe(draft.id)
  expect(upgraded.remaining('judge').questions).toBe(4)
})


it('closes waiting plans immediately and drains the running plan before releasing its lane', async () => {
  const lane = new HostedPlanLane({ concurrent: 1, waiting: 1, waitMs: 20000 })
  let finish!: () => void
  const running = lane.run(() => new Promise<void>(resolve => { finish = resolve }))
  const queuedWork = vi.fn(async () => undefined)
  const queued = lane.run(queuedWork)
  const refused = expect(queued).rejects.toMatchObject({ status: 503, code: 'demo_unavailable' })
  lane.close(); await refused
  expect(lane.depth).toBe(1)
  await expect(lane.run(queuedWork)).rejects.toMatchObject({ status: 503, code: 'demo_unavailable' })
  expect(queuedWork).not.toHaveBeenCalled()
  finish(); await running
  expect(lane.depth).toBe(0)
})
