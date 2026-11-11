// Local native equivalent when Docker is unavailable. OFFSET 1700 only.
import {createServer} from 'node:http'
import {spawn,execFileSync} from 'node:child_process'
import {mkdirSync,readFileSync,writeFileSync,symlinkSync,existsSync} from 'node:fs'
import {resolve,join} from 'node:path'
const root=resolve('.'),dir=resolve('scratch/hosted-local'),state=join(dir,'state')
for(const p of [dir,join(state,'api/reports'),join(state,'publisher/data')]) mkdirSync(p,{recursive:true,mode:0o700})
if(!existsSync(join(dir,'data'))) symlinkSync(join(root,'data'),join(dir,'data'))
const children=[]
const fake=createServer((req,res)=>{
 if(req.url==='/sse') {res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: first\n\n');setTimeout(()=>res.end('data: last\n\n'),1000)}
 else {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.headers))}
})
await new Promise(r=>fake.listen(6803,'127.0.0.1',r))
const env={...process.env,HOSTED:'1',HOSTED_ORIGIN:'http://127.0.0.1:6801',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SETTLEMENT_RAIL:'simulated',SEARCH_EMBEDDINGS:'off',LANGFUSE_ENABLED:'0',PUBLISHER_SECRET:'offline-local-proof-only',PUBLISHER_URL:'http://127.0.0.1:10490',PUBLISHER_DB:join(state,'publisher/data/publisher.db'),APP_DB:join(state,'api/app.db'),REPORT_DIR:join(state,'api/reports'),HOSTED_CONTROL_PATH:join(state,'control.json'),PORT:'10488',RAW_API_PORT:'10489',PUBLISHER_PORT:'10490',HOSTED_LISTEN:'127.0.0.1'}
function start(command,args,extra={},cwd=root) {const child=spawn(command,args,{env:{...env,...extra},cwd,stdio:'ignore'});children.push(child);return child}
const front=readFileSync('docker/hosted/front/default.conf.template','utf8').replace('listen 8080','listen 127.0.0.1:6801').replace('${VM_UPSTREAM}','127.0.0.1:6800').replace('${HOSTED_VIDEO_URL}','').replace('/usr/share/nginx/html',join(root,'docker/hosted'))
let vm=readFileSync('docker/hosted/nginx.conf','utf8');vm=vm.slice(vm.indexOf('  server {'),vm.lastIndexOf('}')).replace('listen 8080','listen 127.0.0.1:6800').replace('/usr/share/nginx/html',join(root,'dist')).replaceAll('/etc/nginx/proxy-headers.conf',join(root,'docker/hosted/proxy-headers.conf')).replace('http://api:8788','http://127.0.0.1:10488').replace('http://publisher:8790','http://127.0.0.1:10490')
const nginx=process.env.NGINX_BIN||'/opt/homebrew/opt/nginx/bin/nginx'
const testFront=front.replaceAll('127.0.0.1:6801','127.0.0.1:6802').replaceAll('127.0.0.1:6800','127.0.0.1:6803').replace(/map \$http_x_forwarded_for[\s\S]*?\n}\n/,'')
const conf=`worker_processes 1; pid ${dir}/nginx.pid; error_log ${dir}/nginx.log crit; events {worker_connections 128;} http {include /opt/homebrew/etc/nginx/mime.types; access_log off; client_body_temp_path ${dir}/client; proxy_temp_path ${dir}/proxy; ${vm}\n${front}\n${testFront}\n}`
writeFileSync(join(dir,'nginx.conf'),conf)
try {
  execFileSync(process.execPath,['scripts/hosted-control.mjs','init','--local','--execute','--path',env.HOSTED_CONTROL_PATH],{stdio:'ignore'})
  start(process.execPath,['docker/hosted/start.mjs'],{ROLE:'api',HOSTED_BUNDLE:join(dir,'dist/api.mjs')})
  start(process.execPath,[join(root,'docker/hosted/start.mjs')],{ROLE:'publisher',HOSTED_BUNDLE:join(dir,'dist/publisher.mjs')},join(state,'publisher'))
  start(nginx,['-c',join(dir,'nginx.conf'),'-g','daemon off;'])
  for(const url of ['http://127.0.0.1:10490/health','http://127.0.0.1:10488/livez','http://127.0.0.1:10489/health','http://127.0.0.1:6801/livez']) {
    let ready=false
    for(let i=0;i<100;i++) {try{if((await fetch(url,{signal:AbortSignal.timeout(500)})).ok){ready=true;break}}catch{/* boot */}await new Promise(r=>setTimeout(r,100))}
    if(!ready) throw Error(`Listener did not start: ${new URL(url).port}`)
  }
  const rawStatus=await fetch('http://127.0.0.1:10489/api/demo/status')
  const missingGateway=rawStatus.status===404
  execFileSync(process.execPath,['--import','tsx','scripts/hosted-smoke.mjs','--url','http://127.0.0.1:6801','--offline',...(missingGateway?['--expect-paused']:['--paused-url','http://127.0.0.1:6801']),'--out',join(dir,'evidence')],{stdio:'inherit'})
  const forwarded=await (await fetch('http://127.0.0.1:6802/headers',{headers:{'X-Forwarded-For':'1.2.3.4, 198.51.100.9',Authorization:'Bearer private-probe','X-Internal-Arbitrary':'private-probe','X-RA-Principal':'owner'}})).json()
  if(forwarded['x-forwarded-for']!=='198.51.100.9'||forwarded.authorization||forwarded['x-internal-arbitrary']||forwarded['x-ra-principal']) throw Error('Front header boundary failed: '+JSON.stringify(forwarded))
  const time=Date.now(),stream=await fetch('http://127.0.0.1:6802/sse'),reader=stream.body.getReader()
  const first=await reader.read()
  if(!new TextDecoder().decode(first.value).includes('first')||Date.now()-time>900) throw Error('SSE buffered')
  await reader.cancel()
  await new Promise(r=>fake.close(r))
  const unreachable=await fetch('http://127.0.0.1:6802/unreachable')
  if(unreachable.status!==503||!(await unreachable.text()).includes('shared demo is paused')) throw Error('Unreachable backend fallback failed')
  writeFileSync(join(dir,'evidence/proxy.json'),JSON.stringify({at:new Date().toISOString(),headerWhitelist:true,oneForwardedHop:true,sseUnbuffered:true,unreachablePaused503:true,kind:'local-native-synthetic-proxy'},null,2))
  console.log(JSON.stringify({ports:{web:6800,front:6801,api:10488,raw:10489,publisher:10490},missingGateway,mode:'native-fixture-simulated',cloud:false}))
} finally {
  fake.closeAllConnections();fake.close()
  for(const child of children) child.kill('SIGTERM')
  await Promise.all(children.map(c=>new Promise(r=>{if(c.exitCode!==null||c.signalCode)return r();c.once('exit',r);setTimeout(()=>{c.kill('SIGKILL');r()},5000).unref()})))
}
