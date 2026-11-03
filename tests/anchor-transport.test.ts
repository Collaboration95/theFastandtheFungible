import { afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ mode:'valid', active:0, max:0, calls:0, options:[] as {maxPayload:number;handshakeTimeout:number}[] }))
vi.mock('ws', async () => {
 const { EventEmitter } = await import('node:events')
 return {default:class extends EventEmitter {
  closed=false
  constructor(_url:string, options:{maxPayload:number;handshakeTimeout:number}) { super(); state.calls++;state.active++;state.max=Math.max(state.max,state.active);state.options.push(options);queueMicrotask(()=>state.mode==='error'?this.emit('error',Error('offline')):this.emit('open')) }
  send(payload:string) {
   const request=JSON.parse(payload);expect(request.command).toBe('tx');expect(request.binary).toBe(false)
   if(state.mode==='hung')return
   queueMicrotask(()=>this.emit('message',Buffer.from(state.mode==='malformed'?'invalid':JSON.stringify(state.mode==='missing'?{id:'anchor',error:'txnNotFound'}:{id:'anchor',result:{hash:request.transaction}}))))
  }
  terminate(){if(!this.closed){this.closed=true;state.active--;queueMicrotask(()=>this.emit('close'))}}
 }}
})
import { anchorLookup } from '../sdk/anchor.js'
afterEach(()=>{vi.useRealTimers();state.mode='valid';state.calls=0;state.max=0;state.options=[]})
it('bounds concurrent sockets and configures size/deadline while sending only tx lookups',async()=>{
 const results=await Promise.all(Array.from({length:6},()=>anchorLookup('A'.repeat(64))))
 expect(results).toHaveLength(6);expect(state.max).toBeLessThanOrEqual(2);expect(state.active).toBe(0)
 expect(state.options.every(o=>o.maxPayload===262144&&o.handshakeTimeout===5000)).toBe(true)
})
for(const mode of ['error','malformed','missing'])it(`closes both bounded endpoints on ${mode}`,async()=>{
 state.mode=mode;await expect(anchorLookup('A'.repeat(64))).rejects.toThrow('unavailable');expect(state.calls).toBe(2);expect(state.active).toBe(0)
})
it('terminates a stalled lookup after five seconds per endpoint',async()=>{
 vi.useFakeTimers();state.mode='hung'
 const pending=anchorLookup('A'.repeat(64)).catch(e=>e)
 await vi.advanceTimersByTimeAsync(10001)
 expect((await pending).message).toContain('unavailable');expect(state.calls).toBe(2);expect(state.active).toBe(0)
})
