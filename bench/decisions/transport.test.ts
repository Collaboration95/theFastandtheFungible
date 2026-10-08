import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// Separate test-process cwd/env keep all mock evidence outside the real benchmark.
const originalCwd=process.cwd(),originalFetch=globalThis.fetch
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'decision-transport-'))
process.chdir(temporary)
const envFile=path.join(temporary,'mock.env')
fs.writeFileSync(envFile,'CLOUDFLARE_API_TOKEN=mock-primary-credential\nCLOUDFLARE_ACCOUNT_ID=primary-account\nCLOUDFLARE_API_TOKEN_2=mock-second-credential\nOPENAI_API_KEY=mock-openai-credential\n')
process.env.BENCH_ENV_FILE=envFile
process.env.BENCH_CF_TOKEN_ALIAS='CLOUDFLARE_API_TOKEN_2'
const {request,OUT}=await import('./transport.js')
const json=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}})

test('second-account discovery ignores primary account ID; failure releases admission and evicts rejected discovery',async()=>{
 let discovery=0,inferences=0
 globalThis.fetch=async(input,init)=>{
  const url=String(input)
  if(url.endsWith('/accounts'))return ++discovery===1?json({success:false},403):json({result:[{id:'second-account'}]})
  inferences++
  assert.ok(url.includes('/accounts/second-account/'))
  const auth=(init?.headers as Record<string,string>).Authorization
  assert.ok(auth.endsWith('mock-second-credential'))
  return json({success:true,result:{answers:{},usage:{input_tokens:10,output_tokens:0}}})
 }
 const result=await Promise.allSettled([
  request('flash',{state:'first-discovery-fails'},{phase:'unit',kind:'round'}),
  request('flash',{state:'next-discovery-recovers'},{phase:'unit',kind:'round'}),
 ])
 assert.equal(result[0].status,'rejected')
 assert.equal(result[1].status,'fulfilled')
 assert.equal(discovery,2)
 assert.equal(inferences,1)
 if(result[1].status==='fulfilled')assert.equal(result[1].value.credentialAlias,'CLOUDFLARE_API_TOKEN_2')
 const cache=fs.readdirSync(path.join(OUT,'cache')).map(f=>fs.readFileSync(path.join(OUT,'cache',f),'utf8')).join('\n')
 assert.ok(!cache.includes('mock-second-credential'))
 assert.ok(!cache.includes('mock-primary-credential'))
})

test('a quota response stops requests already waiting in the second-account queue',async()=>{
 let inferences=0
 globalThis.fetch=async()=>{inferences++;return json({success:false,errors:[{code:4006,message:'you have used up your daily free allocation'}]},429,{'retry-after':'0.001'})}
 const result=await Promise.allSettled([
  request('flash',{state:'quota-exhausted'},{phase:'unit',kind:'round'}),
  request('flash',{state:'must-not-be-sent'},{phase:'unit',kind:'round'}),
 ])
 assert.equal(inferences,1)
 assert.equal(result[0].status,'fulfilled')
 assert.equal(result[1].status,'rejected')
 assert.ok(fs.existsSync(path.join(OUT,'blocked-cloudflare-second.json')))
})

test('fresh and cached OpenAI access rejections both hard-stop without a replayed network call',async()=>{
 let inferences=0
 globalThis.fetch=async()=>{inferences++;return json({error:{message:'test rejected access'}},403)}
 const operation=()=>request('luna',{input:'mock-rejection'},{phase:'unit',kind:'round'})
 await assert.rejects(operation,/HARD STOP/)
 await assert.rejects(operation,/HARD STOP/)
 assert.equal(inferences,1)
})

test.after(()=>{
 globalThis.fetch=originalFetch
 process.chdir(originalCwd)
 fs.rmSync(temporary,{recursive:true,force:true})
})
