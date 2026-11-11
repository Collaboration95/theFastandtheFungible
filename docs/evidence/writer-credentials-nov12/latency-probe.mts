import { readFileSync, writeFileSync } from 'node:fs'
const root = process.cwd()
const { PublisherClient } = await import(root+'/server/publisher-client.ts')
const { TESTNET_QUESTIONS } = await import(root+'/shared/contracts/examples.ts')
const evidence=JSON.parse(readFileSync(root+'/docs/evidence/writer-credentials-nov12/ledger.json','utf8'))
const ports=JSON.parse(readFileSync('/tmp/x2-ports.json','utf8'))
process.env.WRITER_CREDENTIAL_DOMAIN=''
process.env.WRITER_CREDENTIAL_ISSUERS=''
const client=new PublisherClient({baseUrl:`http://127.0.0.1:${ports.pub}`})
const registry=await client.registry()
const out=[]
for (const enabled of [false,true]) {
 process.env.WRITER_CREDENTIAL_DOMAIN=enabled?evidence.domainId:''
 for (const q of TESTNET_QUESTIONS) {
  const times=[]
  for(let i=0;i<8;i++) {
   const t=performance.now()
   const results=await Promise.all(registry.map(p=>client.searchPublisher(p.slug,q.text,5)))
   const ms=performance.now()-t
   if(i>0)times.push(ms)
   if(i===0&&enabled)out.push({preset:q.id,coldMs:ms,verifiedWriters:[...new Set(results.flat().filter(h=>h.verification?.status==='verified').map(h=>h.publisherSlug))]})
  }
  times.sort((a,b)=>a-b)
  out.push({preset:q.id,enabled,samplesMs:times,p50Ms:times[3]})
 }
}
writeFileSync(root+'/docs/evidence/writer-credentials-nov12/latency.json',JSON.stringify({scope:'Local HOSTED=1 publisher; fixture models; signed search metadata, live Testnet credentials; seven warm samples after one cold sample; no purchase',observations:out},null,2)+'\n')
console.log(JSON.stringify(out.map(({samplesMs,...r})=>r)))
