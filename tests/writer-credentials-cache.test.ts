import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WriterCredentials } from '../server/writer-credentials.js'

const subject = 'rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf'
const issuer = 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV'
const hash = 'A'.repeat(64), domainId = 'D'.repeat(64)
let delay = 0, fail = false, accepted = true
const rpc = vi.fn(async (req: Record<string, unknown>): Promise<unknown> => {
 if (delay) await new Promise(resolve => setTimeout(resolve, delay))
 if (fail) throw Error('offline')
 if (req.command === 'server_info') return {result:{info:{network_id:1}}}
 if (req.command === 'ledger') return {result:{validated:true,ledger_index:123,ledger_hash:hash,ledger:{close_time:Math.floor(Date.now()/1000)-946684800}}}
 if (req.index) return {result:{validated:true,ledger_hash:hash,index:domainId,node:{LedgerEntryType:'PermissionedDomain',AcceptedCredentials:[{Credential:{Issuer:issuer,CredentialType:'AB'}}]}}}
 return {result:{validated:true,ledger_hash:hash,index:hash,node:{LedgerEntryType:'Credential',Subject:(req.credential as {subject:string}).subject,Issuer:issuer,CredentialType:'AB',Flags:accepted ? 65536 : 0}}}
})
const verifiers: WriterCredentials[] = []
function verifier() { const v = new WriterCredentials([], rpc, 1200, 300_000, domainId); verifiers.push(v); return v }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-12T00:00:00Z')); delay=0; fail=false; accepted=true; rpc.mockClear() })
afterEach(async () => { for (const v of verifiers.splice(0)) v.dispose(); await vi.advanceTimersByTimeAsync(4000); vi.clearAllTimers(); vi.useRealTimers() })

it('returns pending at 300 ms for a 3 s cold read, then verified when it lands', async () => {
 delay=750 // four bounded RPCs, three seconds overall
 const v=verifier(), values: unknown[]=[]
 void v.check(subject).then(value=>values.push(value))
 await vi.advanceTimersByTimeAsync(299)
 expect(values).toEqual([])
 await vi.advanceTimersByTimeAsync(1)
 expect(values).toEqual([{status:'check_pending'}])
 await vi.advanceTimersByTimeAsync(2700)
 expect((await v.check(subject)).status).toBe('verified')
})

it('never waits across TTL expiry and shares one refresh across concurrent requests', async () => {
 const v=verifier()
 expect((await v.check(subject)).status).toBe('verified')
 delay=750
 await vi.advanceTimersByTimeAsync(240_000)
 const requests=rpc.mock.calls.length
 const values=await Promise.all(Array.from({length:30},()=>v.check(subject)))
 expect(values.every(v=>v.status==='verified')).toBe(true)
 expect(rpc.mock.calls.length).toBe(requests)
 await vi.advanceTimersByTimeAsync(3000)
 expect(rpc.mock.calls.filter(([r])=>r.index)).toHaveLength(2)
 await vi.advanceTimersByTimeAsync(57_001)
 expect((await v.check(subject)).status).toBe('verified')
})

it('serves stale on refresh failure for at most ten minutes beyond TTL, then unavailable', async () => {
 const v=verifier()
 expect((await v.check(subject)).status).toBe('verified')
 fail=true
 await vi.advanceTimersByTimeAsync(899_999)
 expect((await v.check(subject)).status).toBe('verified')
 await vi.advanceTimersByTimeAsync(1)
 expect(await v.check(subject)).toEqual({status:'check_failed'})
 fail=false
 await vi.advanceTimersByTimeAsync(60_000)
 expect((await v.check(subject)).status).toBe('verified')
})

it('replaces stale verification with a genuine revoked observation', async () => {
 const v=verifier()
 await v.check(subject)
 accepted=false
 await vi.advanceTimersByTimeAsync(240_000)
 expect(await v.check(subject)).toEqual({status:'unverified'})
})

it('prewarms the domain and wallets without waiting, reusing their in-flight reads', async () => {
 delay=750
 const v=verifier()
 expect(v.prewarm([subject,subject])).toBeUndefined()
 await vi.advanceTimersByTimeAsync(3000)
 expect((await v.check(subject)).status).toBe('verified')
 expect(rpc.mock.calls.filter(([r])=>r.index)).toHaveLength(1)
 expect(rpc.mock.calls.filter(([r])=>r.credential)).toHaveLength(1)
})

it('paces a full registry warmup through the existing RPC queue deadlines', async () => {
 delay=750
 const subjects=Array.from({length:10},(_,i)=>subject.slice(0,-1)+'123456789A'[i])
 const v=verifier()
 v.prewarm(subjects.slice(0,5)); v.prewarm(subjects.slice(5))
 await vi.advanceTimersByTimeAsync(10_000)
 expect((await Promise.all(subjects.map(s=>v.check(s)))).every(v=>v.status==='verified')).toBe(true)
 expect(rpc.mock.calls.filter(([r])=>r.index)).toHaveLength(1)
 expect(rpc.mock.calls.filter(([r])=>r.credential)).toHaveLength(10)
})

it('returns unavailable on an actual cold failure, with bounded background retries', async () => {
 fail=true
 const v=verifier()
 expect(await v.check(subject)).toEqual({status:'check_failed'})
 await Promise.all(Array.from({length:30},()=>v.check(subject)))
 expect(rpc).toHaveBeenCalledTimes(1)
 await vi.advanceTimersByTimeAsync(60_000)
 expect(rpc).toHaveBeenCalledTimes(2)
})

it('expires a verified credential even while stale reads are allowed', async () => {
 const expiration=Math.floor(Date.now()/1000)-946684800+360
 const base=rpc.getMockImplementation()!
 rpc.mockImplementationOnce(base).mockImplementationOnce(base).mockImplementationOnce(base).mockImplementationOnce(async req=>{
  const response=await base(req) as {result:Record<string,unknown>}
  return {result:{...response.result,node:{...(response.result.node as object),Expiration:expiration}}}
 })
 const v=verifier()
 expect((await v.check(subject)).status).toBe('verified')
 fail=true
 await vi.advanceTimersByTimeAsync(360_000)
 expect(await v.check(subject)).toEqual({status:'check_failed'})
})

it('renders pending with unavailable styling and accepts the wire state', async () => {
 const {WriterVerificationSchema}=await import('../shared/writer-verification.js')
 const {renderToStaticMarkup}=await import('react-dom/server')
 const {createElement}=await import('react')
 const {WriterVerification}=await import('../src/components/WriterVerification.js')
 const value=WriterVerificationSchema.parse({status:'check_pending'})
 const pending=renderToStaticMarkup(createElement(WriterVerification,{value}))
 const failed=renderToStaticMarkup(createElement(WriterVerification,{value:{status:'check_failed'}}))
 expect(pending).toContain('check pending')
 expect(pending.replace('check pending','check unavailable')).toBe(failed)
})

it('serves immediately at original TTL while a retry is still reading the ledger', async () => {
 const v=verifier()
 await v.check(subject)
 fail=true
 await vi.advanceTimersByTimeAsync(240_000)
 fail=false; delay=750
 await vi.advanceTimersByTimeAsync(60_000)
 const values:unknown[]=[]
 void v.check(subject).then(value=>values.push(value))
 await vi.advanceTimersByTimeAsync(0)
 expect(values).toMatchObject([{status:'verified'}])
 await vi.advanceTimersByTimeAsync(3000)
 expect((await v.check(subject)).status).toBe('verified')
})
