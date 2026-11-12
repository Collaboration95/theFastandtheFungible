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
const [frontPort,vmPort]=await Promise.all([free(),free()])
const apiServer=createServer().listen(0,'127.0.0.1');await once(apiServer,'listening')
const origin=`https://127.0.0.1:${frontPort}`,url=`http://127.0.0.1:${frontPort}`
Object.assign(process.env,{HOSTED:'1',MCP_PUBLIC:'on',HOSTED_ORIGIN:origin,HOSTED_TRUSTED_PROXY:'127.0.0.1',HOSTED_IP_HMAC_KEY:'local-proof-not-a-deployed-key-0001',HOSTED_CONTROL_PATH:join(dir,'control.json'),LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SETTLEMENT_RAIL:'simulated',ANCHOR_RAIL:'off',LANGFUSE_ENABLED:'0'})
writeFileSync(process.env.HOSTED_CONTROL_PATH,JSON.stringify({admissionsPaused:false,spendingPaused:false,reasonCode:'local_proof',expiresAt:'2026-11-19T16:00:00Z'}))
const {createPublisherApp}=await import('../../publisher/routes.ts'), {createApiApp}=await import('../../server/routes.ts')
const pub=createPublisherApp({journal:':memory:',rail:'simulated',env:{}});await pub.locals.ready
const publisher=pub.listen(0,'127.0.0.1');await once(publisher,'listening')
const api=await createApiApp({dbPath:join(dir,'app.db'),publisherUrl:`http://127.0.0.1:${publisher.address().port}`,hostedReadiness:async()=>true})
apiServer.on('request',api.app)
const nginx=process.env.NGINX_BIN||'/opt/homebrew/bin/nginx'
const front=readFileSync('docker/hosted/front/default.conf.template','utf8').replace('listen 8080',`listen 127.0.0.1:${frontPort}`).replaceAll('${VM_UPSTREAM}',`127.0.0.1:${vmPort}`).replace('${HOSTED_VIDEO_URL}','').replace('/usr/share/nginx/html',join(root,'docker/hosted')).replace('Host $host','Host $http_host')
let vm=readFileSync('docker/hosted/nginx.conf','utf8');vm=vm.slice(vm.indexOf('  server {'),vm.lastIndexOf('}')).replace('listen 8080',`listen 127.0.0.1:${vmPort}`).replaceAll('/etc/nginx/proxy-headers.conf',join(dir,'headers.conf')).replaceAll('http://api:8788',`http://127.0.0.1:${apiServer.address().port}`).replace('/usr/share/nginx/html',join(root,'dist'))
writeFileSync(join(dir,'headers.conf'),readFileSync('docker/hosted/proxy-headers.conf','utf8').replace('Host $host','Host $http_host'))
writeFileSync(join(dir,'nginx.conf'),`worker_processes 1; pid ${dir}/nginx.pid; error_log ${dir}/error.log crit; events {worker_connections 128;} http {include ${process.env.NGINX_MIME||'/opt/homebrew/etc/nginx/mime.types'}; access_log off; client_body_temp_path ${dir}/client; proxy_temp_path ${dir}/proxy; ${vm}\n${front}}`)
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
  const args={question:'How do x402 payments work?',budget_sgd:2,idempotency_key:'local-reach-proof'}
  const result=await client.callTool({name:'ask_expert',arguments:args});assert(!result.isError,JSON.stringify(result))
  const run=JSON.parse(result.content[0].text);assert.equal(run.phase,'DONE');assert(run.purchases.length>0)
  const again=await client.callTool({name:'ask_expert',arguments:args});assert.equal(JSON.parse(again.content[0].text).run_id,run.run_id)
  const verified=await client.callTool({name:'verify_answer',arguments:{run_id:run.run_id}});assert.equal(JSON.parse(verified.content[0].text).ok,true)
  console.log(JSON.stringify({kind:'native-two-nginx-hosted-gateway',models:'fixture',settlement:'simulated',readiness:'test override; no Testnet balance proof',tools,sse:true,ask:run.phase,purchases:run.purchases.length,retrySameRun:true,receiptsVerified:true,cloud:false}))
} finally {
  await client.close();processNginx.kill('SIGTERM');await once(processNginx,'exit').catch(()=>{})
  apiServer.closeAllConnections();await new Promise(r=>apiServer.close(r));await api.close()
  publisher.closeAllConnections();await new Promise(r=>publisher.close(r));pub.locals.journal.close();rmSync(dir,{recursive:true,force:true})
}
