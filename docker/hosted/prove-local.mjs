// Nearest local equivalent: real front + VM nginx configs, hosted API and publisher, ephemeral ports.
// Run with Node 22: node --import tsx docker/hosted/prove-local.mjs. No cloud access or live wallets.
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,join} from 'node:path'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
const dir=mkdtempSync(join(tmpdir(),'ra-reach-proxy-')), root=resolve('.')
const free=async()=>{const s=createServer().listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p}
const [frontPort,vmPort,probeFrontPort]=await Promise.all([free(),free(),free()])
const probe=createServer((req,res)=>{
  if(req.url==='/sse'){res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: first\n\n');setTimeout(()=>res.end('data: last\n\n'),1000)}
  else {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.headers))}
}).listen(0,'127.0.0.1');await once(probe,'listening')
const probePort=probe.address().port
const apiServer=createServer().listen(0,'127.0.0.1');await once(apiServer,'listening')
const origin=`https://127.0.0.1:${frontPort}`,url=`http://127.0.0.1:${frontPort}`
Object.assign(process.env,{HOSTED:'1',MCP_PUBLIC:'on',PUBLIC_FEED:'1',AUDIENCE_COUNTS:'1',OPERATOR_TOKEN:'local-proof-operator-token-00000000',PAID_ENDPOINT_PUBLIC:'off',HOSTED_ORIGIN:origin,HOSTED_TRUSTED_PROXY:'127.0.0.1',HOSTED_IP_HMAC_KEY:'local-proof-not-a-deployed-key-0001',HOSTED_CONTROL_PATH:join(dir,'control.json'),LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SETTLEMENT_RAIL:'simulated',ANCHOR_RAIL:'off',LANGFUSE_ENABLED:'0'})
writeFileSync(process.env.HOSTED_CONTROL_PATH,JSON.stringify({admissionsPaused:false,spendingPaused:false,reasonCode:'local_proof',expiresAt:'2026-11-19T16:00:00Z'}))
const {createPublisherApp}=await import('../../publisher/routes.ts'), {createApiApp}=await import('../../server/routes.ts')
const pub=createPublisherApp({journal:':memory:',rail:'simulated',env:{}});await pub.locals.ready
const publisher=pub.listen(0,'127.0.0.1');await once(publisher,'listening')
const api=await createApiApp({dbPath:join(dir,'app.db'),publisherUrl:`http://127.0.0.1:${publisher.address().port}`,hostedReadiness:async()=>true})
let paidSignature
apiServer.on('request',(req,res)=>{if(req.url==='/v1/ask')paidSignature=req.headers['payment-signature'];api.app(req,res)})
const nginx=process.env.NGINX_BIN||'/opt/homebrew/bin/nginx'
const front=readFileSync('docker/hosted/front/default.conf.template','utf8').replace('listen 8080',`listen 127.0.0.1:${frontPort}`).replaceAll('${VM_UPSTREAM}',`127.0.0.1:${vmPort}`).replace('${HOSTED_VIDEO_URL}','').replace('/usr/share/nginx/html',join(root,'docker/hosted'))
let vm=readFileSync('docker/hosted/nginx.conf','utf8');vm=vm.slice(vm.indexOf('  server {'),vm.lastIndexOf('}')).replace('listen 8080',`listen 127.0.0.1:${vmPort}`).replaceAll('/etc/nginx/proxy-headers.conf',join(dir,'headers.conf')).replaceAll('http://api:8788',`http://127.0.0.1:${apiServer.address().port}`).replace('/usr/share/nginx/html',join(root,'dist'))
writeFileSync(join(dir,'headers.conf'),readFileSync('docker/hosted/proxy-headers.conf','utf8'))
const probeFront=front.replace(`127.0.0.1:${frontPort}`,`127.0.0.1:${probeFrontPort}`).replaceAll(`127.0.0.1:${vmPort}`,`127.0.0.1:${probePort}`).replace(/map \$http_x_forwarded_for[\s\S]*?\n}\n/,'')
writeFileSync(join(dir,'nginx.conf'),`worker_processes 1; pid ${dir}/nginx.pid; error_log ${dir}/error.log crit; events {worker_connections 128;} http {include ${process.env.NGINX_MIME||'/opt/homebrew/etc/nginx/mime.types'}; access_log off; client_body_temp_path ${dir}/client; proxy_temp_path ${dir}/proxy; ${vm}\n${front}\n${probeFront}}`)
const processNginx=spawn(nginx,['-c',join(dir,'nginx.conf'),'-g','daemon off;'],{stdio:'ignore'})
const client=new Client({name:'reach-local-proof',version:'1'})
try {
  for(let i=0;i<100;i++){try{if((await fetch(url+'/livez')).ok)break}catch{/* listener booting */} await new Promise(r=>setTimeout(r,100))}
  const transport=new StreamableHTTPClientTransport(new URL(url+'/mcp'))
  await client.connect(transport)
  const tools=(await client.listTools()).tools.map(t=>t.name)
  assert(!tools.includes('hire'));assert(!tools.includes('pause_spending'))
  const init=await fetch(url+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:20,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'sse-proof',version:'1'}}})})
  assert.match(init.headers.get('content-type'),/text\/event-stream/);assert.match(await init.text(),/event: message/)
  const operator=await fetch(url+'/api/operator/session',{method:'POST',headers:{'X-Operator-Token':process.env.OPERATOR_TOKEN,Origin:origin}})
  assert.equal(operator.status,200);assert((await operator.json()).internal);assert(operator.headers.get('set-cookie').startsWith('__Host-ra_operator='))
  const rejectedOperator=await fetch(url+'/api/operator/session',{method:'POST',headers:{Authorization:'Bearer wrong-token',Origin:origin}});assert.equal(rejectedOperator.status,401)
  const feed=await fetch(url+'/api/feed');assert.equal(feed.headers.get('cache-control'),'public, max-age=2')
  const recorded=await fetch(url+'/api/feed/recorded');assert.equal(recorded.status,200);assert.equal(recorded.headers.get('cache-control'),'public, max-age=60')
  const search=await client.callTool({name:'search_expertise',arguments:{query:'x402 pricing'}})
  assert(!search.isError);const hits=JSON.parse(search.content[0].text).hits;assert(hits.length>0)
  assert(hits.every(hit=>new URL(hit.url).origin===origin&&/^\/w\/[^/]+\/blog\//.test(new URL(hit.url).pathname)))
  assert.equal((await fetch(hits[0].url.replace('https:', 'http:'))).status,200)
  const question=JSON.parse(readFileSync('data/corpus/v2/story-bible.json','utf8')).useCases.find(row=>row.id==='UC2').question
  const args={question,budget_sgd:2,idempotency_key:'local-reach-proof'}
  const result=await client.callTool({name:'ask_expert',arguments:args});assert(!result.isError,JSON.stringify(result))
  const run=JSON.parse(result.content[0].text);assert.equal(run.phase,'DONE');assert(run.purchases.length>0)
  assert(run.citations.length>0&&run.citations.every(citation=>new URL(citation.url).origin===origin),JSON.stringify({citationUrls:run.citations.map(citation=>citation.url)}))
  const again=await client.callTool({name:'ask_expert',arguments:args});assert.equal(JSON.parse(again.content[0].text).run_id,run.run_id)
  const verified=await client.callTool({name:'verify_answer',arguments:{run_id:run.run_id}});assert.equal(JSON.parse(verified.content[0].text).ok,true)
  const paidProbe=await fetch(url+'/v1/ask',{method:'POST',headers:{'Content-Type':'application/json','PAYMENT-SIGNATURE':'reach-proof-signature'},body:'{}'})
  assert.equal(paidProbe.status,404);assert.equal(paidSignature,'reach-proof-signature')
  const probeUrl=`http://127.0.0.1:${probeFrontPort}`
  const forwarded=await(await fetch(probeUrl+'/headers',{headers:{'X-Forwarded-For':'1.2.3.4, 198.51.100.9',Authorization:'Bearer private-probe','X-Internal-Arbitrary':'private-probe','X-RA-Principal':'owner','MCP-Protocol-Version':'2025-11-25','X-Publishing-Key':'local-publishing-capability','X-Operator-Token':'local-moderation-token'}})).json()
  assert.equal(forwarded['x-forwarded-for'],'198.51.100.9')
  assert(!forwarded.authorization&&!forwarded['x-internal-arbitrary']&&!forwarded['x-ra-principal'])
  assert.equal(forwarded['mcp-protocol-version'],'2025-11-25');assert.equal(forwarded['x-publishing-key'],'local-publishing-capability');assert.equal(forwarded['x-operator-token'],'local-moderation-token')
  const time=Date.now(),stream=await fetch(probeUrl+'/sse'),reader=stream.body.getReader()
  const first=await reader.read()
  assert(new TextDecoder().decode(first.value).includes('first')&&Date.now()-time<900,'SSE buffered')
  await reader.cancel();probe.closeAllConnections();await new Promise(r=>probe.close(r))
  const unreachable=await fetch(probeUrl+'/unreachable')
  assert.equal(unreachable.status,503);assert((await unreachable.text()).includes('shared demo is paused'))
  console.log(JSON.stringify({kind:'native-two-nginx-hosted-gateway',models:'fixture',settlement:'simulated',readiness:'test override; no Testnet balance proof',tools,sse:true,ask:run.phase,purchases:run.purchases.length,retrySameRun:true,receiptsVerified:true,publicLinks:true,paidRouteFlagOff:true,paidSignatureForwarded:true,headerWhitelist:true,oneForwardedHop:true,sseUnbuffered:true,unreachablePaused503:true,cloud:false}))
} finally {
  probe.closeAllConnections();probe.close()
  await client.close();processNginx.kill('SIGTERM');await once(processNginx,'exit').catch(()=>{})
  apiServer.closeAllConnections();await new Promise(r=>apiServer.close(r));await api.close()
  publisher.closeAllConnections();await new Promise(r=>publisher.close(r));pub.locals.journal.close();rmSync(dir,{recursive:true,force:true})
}
