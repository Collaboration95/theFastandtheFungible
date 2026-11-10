// Bounded operator acceptance. Does not change pause state or provision wallets.
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { randomUUID } from 'node:crypto'
const argv=process.argv.slice(2)
const value=(name,fallback)=>argv.includes(name)?argv[argv.indexOf(name)+1]:fallback
const base=new URL(value('--url','http://127.0.0.1:6801'))
const offline=argv.includes('--offline'), paused=argv.includes('--expect-paused'), dry=argv.includes('--dry-run')
if(base.protocol!=='https:' && !['127.0.0.1','localhost'].includes(base.hostname)) throw Error('Public smoke requires HTTPS')
if(dry) { console.log(JSON.stringify({origin:base.origin,mode:offline?'offline':'real-Testnet',question:value('--question','operator must supply --question for live purchase'),probes:['status','two independent cookies','foreign run/receipt/SSE/history','own purchase','receipt verification','explorer','paused origin']}));process.exit(0) }
if(!offline && !value('--question')) throw Error('Live smoke requires an operator-supplied own --question (budget 200 minor)')
const rows=[]
const record=(name,pass,detail)=>{rows.push({name,pass,detail});if(!pass) throw Error(name)}
class Jar {
  cookie='';csrf=''
  async request(path,method='GET',body) {
    const response=await fetch(new URL(path,base),{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json',Origin:base.origin,...(this.cookie?{Cookie:this.cookie}:{}),...(this.csrf?{'X-CSRF-Token':this.csrf}:{}),...(body?{'Content-Type':'application/json','Idempotency-Key':randomUUID()}: {})},body:body?JSON.stringify(body):undefined})
    const cookie=response.headers.getSetCookie().find(c=>c.startsWith('__Host-ra_session='))
    if(cookie) this.cookie=cookie.split(';')[0]
    this.csrf=response.headers.get('x-csrf-token')||this.csrf
    return response
  }
  async bootstrap() {
    const r=await this.request('/api/demo/status');const status=await r.json()
    record('bounded status',r.ok&&['ready','paused','busy','degraded','ended'].includes(status.state)&&!!status.labels&&!!status.remaining&&!!status.capabilities,'status contract')
    this.csrf=status.csrfToken||this.csrf
    if(!this.csrf) {
      const session=await this.request('/api/demo/session')
      if(session.ok) {const b=await session.json();this.csrf=b.csrfToken||this.csrf}
    }
    return status
  }
}
let failure
try {
  const a=new Jar(),b=new Jar()
  const status=await a.bootstrap()
  if(paused) {
    record('paused status',status.state==='paused'||status.state==='ended','no admissions')
    const ready=await a.request('/readyz');record('paused readiness',ready.status===503,'HTTP 503')
    const create=await a.request('/runs','POST',{question:'Offline safety probe',budgetMinor:0})
    record('paused rejects ask',[403,409,423,429,503].includes(create.status),'no work admitted')
    rows.push({name:'isolation, purchase, receipt and explorer',pass:null,detail:'BLOCKED: gateway unavailable/paused; this is only paused-shell proof'})
  } else {
    await b.bootstrap()
    record('distinct hosted sessions',a.cookie&&b.cookie&&a.cookie!==b.cookie,'two independent __Host cookie jars')
    record('csrf available',a.csrf&&b.csrf,'server-issued tokens')
    record('requested rail',offline?/simulat/i.test(status.labels.rail):/testnet/i.test(status.labels.rail),'authoritative rail label')
    if(offline) record('fixture label',/fixture/i.test(status.labels.models),'authoritative model label')
    const ask=async(jar,question)=>{const r=await jar.request('/runs','POST',{question,budgetMinor:200,escrow:true});record('admitted own question',[200,201,202].includes(r.status),'budget 200 minor');return (await r.json()).runId}
    const id=await ask(a,value('--question',"Are Kestrel Semiconductor's advanced-packaging lead times in Malaysia getting shorter?"))
    record('run identity',typeof id==='string'&&id.length>0,'opaque run id')
    for(const path of [`/runs/${id}`,`/runs/${id}/events`,`/runs/${id}/receipts.json`,`/runs/${id}/report.json`,`/runs/${id}/intents/foreign/key-reveal-proof.json`]) {
      const foreign=await b.request(path);record('foreign '+path.replace(id,':id'),foreign.status===404,'404');await foreign.body?.cancel()
    }
    for(const [path,method,body] of [[`/runs/${id}/stop`,'POST',{}],[`/runs/${id}/retry-delivery`,'POST',{intentId:'foreign'}],[`/api/runs/${id}/pin`,'POST',{pinned:true}],[`/api/runs/${id}`,'DELETE',undefined]]) {
      const foreign=await b.request(path,method,body);record('foreign mutation '+method+' '+path.replace(id,':id'),foreign.status===404,'404')
    }
    const list=await b.request('/api/runs');const entries=await list.json()
    record('foreign history filtered',list.ok&&!JSON.stringify(entries).includes(id),'absent from second jar')
    const deadline=Date.now()+240000
    let run
    while(Date.now()<deadline) {
      const r=await a.request(`/runs/${id}`);record('own run readable',r.ok,'session ownership');run=await r.json()
      if(['DONE','FAILED','STOPPED'].includes(run.phase)) break
      await new Promise(r=>setTimeout(r,1000))
    }
    record('completed own question',run?.phase==='DONE','bounded 240-second completion')
    const r=await a.request(`/runs/${id}/receipts.json`);record('own receipt export',r.ok,'private no-store export')
    record('no shared receipt cache',/no-store/.test(r.headers.get('cache-control')||''),'Cache-Control no-store')
    const bundle=await r.json()
    record('real policy purchase',bundle.payments?.some(p=>p.kind==='purchase')&&bundle.receipts?.length>0,'at least one purchase and receipt')
    // Use the same offline verifier as SDK users. No raw receipt/questions saved in evidence.
    const {verifyAnswer}=await import('../sdk/verify.ts')
    const verified=await verifyAnswer(bundle,{testnet:!offline,onlineLedger:!offline})
    record('receipt verification',verified.ok,'SDK signature, grant, passage, audit and ledger verification')
    if(!offline) {
      const hashes=new Set([bundle.ledgerAnchor?.txHash,...bundle.payments.map(p=>p.txHash),...bundle.proofs.flatMap(p=>[p.keyReveal?.finishHash])].filter(Boolean))
      record('anchor present',!!bundle.ledgerAnchor?.txHash,'answer anchor required')
      for(const hash of hashes) {
        record('transaction hash',/^[A-Fa-f0-9]{64}$/.test(hash),'64 hexadecimal characters')
        const explorer=`https://testnet.xrpl.org/transactions/${hash}`
        const page=await fetch(explorer,{signal:AbortSignal.timeout(20000)})
        record('explorer reachable',page.ok,'Testnet explorer HTTP success; semantic ledger validation is from SDK above')
      }
    } else rows.push({name:'Testnet and explorer',pass:null,detail:'SKIPPED: offline simulated rail'})
    // Second visitor creates independent work after the global worker is free.
    const other=await ask(b,'Offline isolation probe: which free sources are available?')
    const foreign=await a.request(`/runs/${other}`);record('reverse ownership',foreign.status===404,'404')
    await b.request(`/runs/${other}/stop`,'POST',{})
    const pausedUrl=value('--paused-url')
    record('paused probe configured',!!pausedUrl,'independently paused endpoint required; smoke never toggles production control')
    const pr=await fetch(new URL('/readyz',pausedUrl),{signal:AbortSignal.timeout(15000)})
    record('paused probe',pr.status===503,'paused readiness HTTP 503')
  }
} catch {failure='acceptance probe failed; inspect named check, no private response logged'}
const directory=resolve(value('--out','scratch/hosted-smoke'))
mkdirSync(directory,{recursive:true,mode:0o700})
const stamp=new Date().toISOString().replaceAll(':','-')
const file=join(directory,`${stamp}.json`)
writeFileSync(file,JSON.stringify({at:new Date().toISOString(),origin:base.origin,mode:offline?'offline-fixture-simulated':'live-Testnet',scope:paused?'partial-paused-shell':'acceptance',passed:!failure,checks:rows,failure},null,2)+'\n',{mode:0o600})
console.log(JSON.stringify({evidence:file,passed:!failure,scope:paused?'partial-paused-shell':'acceptance'}))
if(failure) process.exitCode=1
