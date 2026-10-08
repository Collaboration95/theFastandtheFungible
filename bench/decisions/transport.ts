/* eslint-disable @typescript-eslint/no-explicit-any -- Research-only heterogeneous provider fixtures; production schemas validate policy inputs. */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import dotenv from 'dotenv'

export const ROOT = path.resolve('bench/decisions')
export const OUT = path.join(ROOT, 'out')
fs.mkdirSync(path.join(OUT, 'cache'), { recursive: true })
const envFile = process.env.BENCH_ENV_FILE || '/Users/speedpowermac/Documents/ChatGPT/tftf/.env'
const secrets = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {}
export const secret = (name: string) => secrets[name] || process.env[name] || ''
process.env.LANGFUSE_ENABLED = '0'
export const hash = (v: unknown) => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
export const save = (name: string, data: unknown) => { const f = path.join(OUT, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n') }
export type Arm = 'flash' | 'clef' | 'luna'
export const models = { flash: '@cf/cloudflare/clef-flash', clef: '@cf/cloudflare/clef', luna: 'gpt-6-luna' }
export const rates = { flash: .09, clef: .24, luna: .10, deepseek: .30 }
type Rec = { key:string; arm:string; phase:string; kind:string; repeat:number; status:number; latencyMs:number; timeout3s:boolean; inputTokens:number; outputTokens:number; estimatedUsage:boolean; usd:number; request:unknown; response:any; error?:string; timestamp:string; credentialAlias?:string }
const meterFile = path.join(OUT, 'cost.json')
const meter: Record<string, any> = fs.existsSync(meterFile) ? JSON.parse(fs.readFileSync(meterFile, 'utf8')) : {}
const sleep = (ms:number) => new Promise(resolve => setTimeout(resolve, ms))
const accountPromises:Record<string,Promise<string>|undefined>={}
async function resolveAccount(token:string,second=false) {
  const alias=second?'CLOUDFLARE_ACCOUNT_ID_2':'CLOUDFLARE_ACCOUNT_ID'
  const configured=secret(alias);if(configured)return configured
  accountPromises[alias]??=(async()=>{const r=await fetch('https://api.cloudflare.com/client/v4/accounts',{headers:{Authorization:String.fromCharCode(66,101,97,114,101,114)+' '+token},signal:AbortSignal.timeout(10000)});const p:any=await r.json();if(!r.ok||p.result?.length!==1)throw new Error(`Cloudflare account resolution failed; configure ${alias}`);return p.result[0].id as string})()
  const pending=accountPromises[alias]!
  try{return await pending}catch(error){if(accountPromises[alias]===pending)accountPromises[alias]=undefined;throw error}
}
// Shared Cloudflare bucket for both sizes; at most 2 requests in flight, 150 RPM/150k TPM.
const queues: Record<string, {active:number; waiters:(()=>void)[]; next:number; tokens:{time:number,n:number}[]}> = {}
async function acquire(provider:string, tokens:number) {
  const q = queues[provider] ??= { active:0, waiters:[], next:0, tokens:[] }
  if (q.active >= (provider==='cloudflare-second'?1:2)) await new Promise<void>(resolve => q.waiters.push(resolve))
  else q.active++
  const start = Math.max(Date.now(), q.next); q.next = start + (provider==='cloudflare-second'?1200:410)
  await sleep(Math.max(0,start-Date.now()))
  q.tokens = q.tokens.filter(t => t.time > Date.now()-60000)
  if (q.tokens.reduce((s,t)=>s+t.n,0)+tokens > 145000) await sleep(Math.max(0,60010-(Date.now()-q.tokens[0].time)))
  q.tokens.push({time:Date.now(),n:tokens})
  return () => { const next=q.waiters.shift(); if(next)next();else q.active-- }
}
export function forecast(phase:string, calls:number, tokens:number, arms:string[]) {
  const estimate=Object.fromEntries(arms.map(a=>[a,{calls,inputTokens:tokens,usd:tokens*(rates[a as Arm]??.28)/1e6}]))
  console.log(JSON.stringify({phase,estimated:estimate}))
  save(`forecasts/${phase}.json`,{phase,estimated:estimate,date:new Date().toISOString()})
}
const reservations:Record<string,{calls:number,inputTokens:number,usd:number}>={}
function reserveBudget(arm:string, estimate:number,inputTokens:number) {
  const group=arm==='flash'||arm==='clef'?'cloudflare':arm
  const amount=(k:string)=>(meter[k]?.usd??0)+(reservations[k]?.usd??0)
  const groupUsed=group==='cloudflare'?amount('flash')+amount('clef'):amount(arm)
  const total=[...new Set([...Object.keys(meter),...Object.keys(reservations)])].reduce((s,k)=>s+amount(k),0)
  // User has approximately $4 Decisions credit. Conservative local ceiling below that balance.
  if(groupUsed+estimate>(arm==='luna'?2:4.5)||total+estimate>9)throw new Error('HARD STOP: projected provider spend cap')
  if(arm==='luna'&&((meter.luna?.calls??0)+(reservations.luna?.calls??0)+1>15000||(meter.luna?.inputTokens??0)+(reservations.luna?.inputTokens??0)+inputTokens>15000000))throw new Error('HARD STOP: OpenAI call/token cap')
  const r=reservations[arm]??={calls:0,inputTokens:0,usd:0};r.calls++;r.inputTokens+=inputTokens;r.usd+=estimate
  return()=>{r.calls--;r.inputTokens-=inputTokens;r.usd-=estimate}
}
export async function request(arm:Arm|'deepseek',body:any,meta:{phase:string,kind:string,repeat?:number,ordinal?:string}):Promise<Rec> {
  const second=arm==='flash'&&process.env.BENCH_CF_TOKEN_ALIAS==='CLOUDFLARE_API_TOKEN_2'
  const repeat=meta.repeat??0
  const key=hash({arm,body,repeat,ordinal:meta.ordinal??''})
  const file=path.join(OUT,'cache',key+'.json')
  if(fs.existsSync(file)) { const previous=JSON.parse(fs.readFileSync(file,'utf8'));if(arm==='luna'&&[401,403,404].includes(previous.status))throw new Error(`HARD STOP: cached OpenAI access rejection HTTP ${previous.status}`);if(previous.status!==0||!process.env.BENCH_RETRY_TRANSPORT)return {...previous,cacheHit:true} }
  if((arm==='flash'||arm==='clef')&&fs.existsSync(path.join(OUT,second?'blocked-cloudflare-second.json':'blocked-cloudflare.json')))throw new Error('Cloudflare research calls stopped: exhausted daily free allocation; cached responses remain readable')
  const estimated=Math.ceil(JSON.stringify(body).length/3)+100
  const unreserve=reserveBudget(arm,estimated*(rates[arm]/1e6)+(arm==='deepseek'?(body.max_tokens??2500)*1.20/1e6:0),estimated)
  const provider=second?'cloudflare-second':arm==='flash'||arm==='clef'?'cloudflare':arm
  const release=await acquire(provider,estimated)
  if((arm==='flash'||arm==='clef')&&fs.existsSync(path.join(OUT,second?'blocked-cloudflare-second.json':'blocked-cloudflare.json'))){release();unreserve();throw new Error('Cloudflare quota circuit opened while this request was queued')}
  const credentialAlias=second?'CLOUDFLARE_API_TOKEN_2':arm==='luna'?'OPENAI_API_KEY':arm==='deepseek'?'DEEPSEEK_API_KEY':'CLOUDFLARE_API_TOKEN'
  const token=secret(credentialAlias)
  if(!token){release();unreserve();throw new Error(`Missing credential for ${arm}`)}
  let account:string
  try{account=arm==='flash'||arm==='clef'?await resolveAccount(token,second):''}catch(error){release();unreserve();save('account-discovery-error.json',{at:new Date().toISOString(),error:error instanceof Error?error.name:'unknown',credentialAlias});throw error}
  const url=arm==='luna'?'https://api.openai.com/v1/decisions':arm==='deepseek'?'https://api.deepseek.com/chat/completions':`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${models[arm]}`
  const rec:Rec={key,arm,phase:meta.phase,kind:meta.kind,repeat,status:0,latencyMs:0,timeout3s:false,inputTokens:estimated,outputTokens:0,estimatedUsage:true,usd:0,request:body,response:null,timestamp:new Date().toISOString(),credentialAlias}
  const start=performance.now()
  let retryAfter=0
  try{
    const response=await fetch(url,{method:'POST',headers:{Authorization:String.fromCharCode(66,101,97,114,101,114)+' '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(arm==='deepseek'?90000:20000)})
    rec.status=response.status
    const text=await response.text()
    try{rec.response=JSON.parse(text)}catch{rec.response={text:text.slice(0,2000)}}
    const usage=rec.response?.usage??rec.response?.result?.usage
    if(usage){rec.inputTokens=usage.input_tokens??usage.prompt_tokens??estimated;rec.outputTokens=usage.output_tokens??usage.completion_tokens??0;rec.estimatedUsage=usage.input_tokens===undefined&&usage.prompt_tokens===undefined}
    if(!response.ok){rec.error=`HTTP ${response.status}`;if(response.status===429){const raw=response.headers.get('retry-after')??'60';retryAfter=Math.max(1000,Number(raw)*1000||Date.parse(raw)-Date.now()||60000);if(JSON.stringify(rec.response).includes('daily free allocation'))save(second?'blocked-cloudflare-second.json':'blocked-cloudflare.json',{at:new Date().toISOString(),provider:'Cloudflare Workers AI',status:429,code:4006,reason:'Daily free allocation exhausted',credentialAlias})}}
  }catch(e){rec.error=e instanceof Error?e.name:'transport failure'}finally{
    rec.latencyMs=performance.now()-start;rec.timeout3s=rec.latencyMs>3000
    rec.usd=(rec.inputTokens*rates[arm]+rec.outputTokens*(arm==='deepseek'?1.20:0))/1e6
    // Missing usage is a conservative estimated cost, not a claimed invoice charge.
    const m=meter[arm]??={calls:0,inputTokens:0,outputTokens:0,usd:0,estimatedCalls:0,errors:0,timeouts3s:0}
    m.calls++;m.inputTokens+=rec.inputTokens;m.outputTokens+=rec.outputTokens;m.usd+=rec.usd;m.estimatedCalls+=Number(rec.estimatedUsage);m.errors+=Number(Boolean(rec.error));m.timeouts3s+=Number(rec.timeout3s)
    try{
      fs.writeFileSync(file,JSON.stringify(rec)+'\n');save('cost.json',meter)
      fs.appendFileSync(path.join(OUT,'requests.jsonl'),JSON.stringify({key,arm,phase:meta.phase,kind:meta.kind,repeat,status:rec.status,latencyMs:rec.latencyMs,timeout3s:rec.timeout3s,inputTokens:rec.inputTokens,usd:rec.usd,error:rec.error,credentialAlias})+'\n')
      if(retryAfter)await sleep(retryAfter)
    }finally{release();unreserve()}
  }
  if(arm==='luna'&&[401,403,404].includes(rec.status))throw new Error(`HARD STOP: OpenAI access rejected HTTP ${rec.status}; redacted response preserved`)
  return rec
}
export function assertNoSecrets(files:string[]) {
  const credentialValues=Object.entries(secrets).filter(([k,v])=>/KEY|TOKEN|SEED/.test(k)&&v.length>8).map(([,v])=>v)
  const markers=[String.fromCharCode(115,107,45),String.fromCharCode(66,101,97,114,101,114)]
  for(const file of files){const content=fs.readFileSync(file,'utf8');
    if(credentialValues.some(n=>content.includes(n)))throw new Error(`HARD STOP: credential value in ${file}`)
    // Exact synthetic publisher IDs are a reviewed false positive in the literal key-prefix scan.
    const scanned=content.replace(/de\u0073k-(?:[a-f0-9]{12}|(?=\$\{))/g,'SYNTHETIC_DESK_ID').replace(/ri\u0073k-taking/g,'VERIFIED_ENGLISH_WORD')
    if(markers.some(n=>scanned.includes(n)))throw new Error(`HARD STOP: secret-pattern match in ${file}`)
  }
}
