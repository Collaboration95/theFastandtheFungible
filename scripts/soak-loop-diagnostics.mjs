/** Diagnostic preload only: no production import or branch. Records sizes, never payloads. */
import { performance } from 'node:perf_hooks'
import { createHook } from 'node:async_hooks'
import { DatabaseSync, StatementSync } from 'node:sqlite'
export async function installSpans(channel) {
  const ring = []; const ticks = []; const stack = []
  const add = (label, start, payloadBytes = null) => {
    ring.push({label, start, end:performance.now(), payloadBytes})
    if(ring.length > 4096) ring.shift()
  }
  const wrap = (prototype, prefix) => {
    for(const name of Object.getOwnPropertyNames(prototype)) {
      if(name === 'constructor') continue
      const descriptor = Object.getOwnPropertyDescriptor(prototype,name)
      if(typeof descriptor.value !== 'function') continue
      const original = descriptor.value
      Object.defineProperty(prototype,name,{...descriptor,value:function(...args) {
        const start=performance.now()
        try {return original.apply(this,args)} finally {add(prefix+'.'+name,start,args.reduce((n,a)=>n+(typeof a==='string'?Buffer.byteLength(a):0),0))}
      }})
    }
  }
  for(const [path,name] of [['../server/store.ts','Store'],['../server/agents/loop.ts','RunLoop'],['../server/audit.ts','AuditLog'],['../server/publisher-client.ts','PublisherClient']]) {
    const module=await import(path);wrap(module[name].prototype,name)
  }
  wrap(DatabaseSync.prototype,'SQLite');wrap(StatementSync.prototype,'SQLite.statement')
  const stringify=JSON.stringify
  JSON.stringify=function(...args) {const start=performance.now();let result;try {return result=stringify.apply(this,args)} finally {add('JSON.stringify',start,typeof result==='string'?Buffer.byteLength(result):0)}}
  const {ServerResponse}=await import('node:http');wrap(ServerResponse.prototype,'HTTP.response')
  // Async hooks capture complete synchronous callbacks, including continuations after await.
  const hook=createHook({before(id){stack.push({id,start:performance.now()})},after(id){const tick=stack.pop();if(tick?.id===id){ticks.push({...tick,end:performance.now()});if(ticks.length>4096)ticks.shift()}}});hook.enable()
  let last=performance.now()
  const timer=setInterval(()=>{
    const now=performance.now(),delayMs=now-last-10
    if(delayMs>30) channel.postMessage({lag:true,at:Date.now(),start:last,end:now,delayMs,spans:ring.filter(s=>s.end>=last&&s.start<=now).map(s=>({...s,durationMs:s.end-s.start})),ticks:ticks.filter(s=>s.end>=last&&s.start<=now).map(s=>({...s,durationMs:s.end-s.start}))})
    last=performance.now()
  },10);timer.unref()
}
