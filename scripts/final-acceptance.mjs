/** Local fixture rehearsal. No dotenv, publication, signing, or release mutation. */
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync, readlinkSync, cpSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { hostname, platform, release, arch, cpus, loadavg } from 'node:os'
const quick=process.argv.includes('--quick')
if(process.argv.slice(2).some(a=>a!=='--quick')) throw Error('Usage: node scripts/final-acceptance.mjs [--quick]')
const out=resolve('scratch/final-acceptance-'+new Date().toISOString().replace(/[^0-9]/g,''));mkdirSync(out,{recursive:true})
const destination=resolve('dist/final')
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
Object.assign(env,{DOTENV_CONFIG_PATH:'.no-final-env',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SETTLEMENT_RAIL:'simulated',LANGFUSE_ENABLED:'0',SEARCH_EMBEDDINGS:'off',CSC_IDENTITY_AUTO_DISCOVERY:'false'})
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const report={schema:1,mode:quick?'quick fixture rehearsal':'full fixture workload on a declared local host',sourceSha:git('rev-parse','HEAD'),sourceTree:git('rev-parse','HEAD^{tree}'),worktreeDirty:Boolean(git('status','--porcelain')),runnerSha256:digest('scripts/final-acceptance.mjs'),timestamp:new Date().toISOString(),host:{hostname:hostname(),platform:platform(),release:release(),arch:arch(),cpus:cpus().length,node:process.version,load:loadavg()},gates:[],artifacts:[],dmgs:[],pass:false}
const save=()=>{writeFileSync(join(out,'acceptance.json'),JSON.stringify(report,null,2)+'\n');mkdirSync(destination,{recursive:true});cpSync(join(out,'acceptance.json'),join(destination,'acceptance.json'))}
async function run(name,cmd,args,extra={}) {
  const row={name,command:[cmd,...args],startedAt:new Date().toISOString(),pass:false};report.gates.push(row);save()
  const log=join(out,name+'.log')
  const {openSync,closeSync}=await import('node:fs');const fd=openSync(log,'w')
  try {const code=await new Promise((done,fail)=>{const child=spawn(cmd,args,{env:Object.fromEntries(Object.entries({...env,...extra}).filter(([,v])=>v!==null)),stdio:['ignore',fd,fd]});child.on('error',fail);child.on('exit',done) });row.exitCode=code;row.pass=code===0;if(!row.pass)throw Error(name+' failed; see '+log)}
  finally {closeSync(fd);row.finishedAt=new Date().toISOString();row.logSha256=digest(log);save()}
}
const artifact=(p)=>({file:p,bytes:statSync(p).size,sha256:digest(p)})
try {
  if(platform()!=='darwin'||arch()!=='arm64')throw Error('Full unsigned arm64 acceptance requires an Apple Silicon Mac')
  const ts=new Date().toISOString().replace(/[^0-9]/g,'')
  const soak=resolve('scratch/finals-soak-279.json');mkdirSync('scratch',{recursive:true})
  await run('soak','caffeinate',['-dims','node','scripts/soak-same-engine.mjs','--runs',quick?'200':'2000','--warmup',quick?'20':'200','--concurrency','1','--seed','279','--history-runs','10000','--events-per-run','60','--data-dir','scratch/finals-soak-279-'+ts,'--output',soak,'--burst'])
  {const r=JSON.parse(readFileSync(soak));report.soak={file:soak,sha256:digest(soak),source:r.source,summary:r.summary,burst:r.burst,restarts:r.restarts.length}};
  await run('render','node',['scripts/render-soak.mjs',soak,join(out,'soak-same-engine.svg')])
  await run('artifacts','make',['release-artifacts'])
  await run('consumers','node',['scripts/check-release-consumers.mjs','--manifest','dist/release/manifest.json'])
  report.artifacts=JSON.parse(readFileSync('dist/release/manifest.json')).artifacts;save()
  report.consumers=JSON.parse(readFileSync('dist/release/consumer-results.json'));report.verifiers=report.consumers.verifiers;cpSync('dist/release',join(out,'release'),{recursive:true});save()
  await run('desktop-download-arm64','node',['desktop/download.mjs'],{DESKTOP_ARCH:'arm64'})
  await run('desktop-arm64','node',['desktop/build.mjs','--dmg','--unsigned'],{DESKTOP_ARCH:'arm64'})
  report.dmgs=readdirSync('desktop/out').filter(f=>f.endsWith('.dmg')).map(f=>artifact(join('desktop/out',f)));save()
  const app=resolve('desktop/out/mac-arm64/ResearchAgent.app')
  const walkApp=(dir,relative='')=>readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    const p=join(dir,e.name),name=join(relative,e.name)
    return e.isSymbolicLink()?[{file:name,symlink:readlinkSync(p)}]:e.isDirectory()?walkApp(p,name):[{...artifact(p),file:name}]
  })
  const appManifest=join(out,'app-manifest.json');writeFileSync(appManifest,JSON.stringify(walkApp(app),null,2)+'\n')
  report.app={path:app,manifest:artifact(appManifest),executable:artifact(join(app,'Contents/MacOS/ResearchAgent'))};save()
  await run('desktop-recovery','node',['desktop/smoke.mjs','--fixture-only','--recovery','--app',app,'--output',join(out,'desktop-recovery.json')],{RA_DESKTOP_KEYCHAIN_SERVICE:'ResearchAgent-Accept-'+randomUUID(),LLM_PROVIDER:null,DECISION_PROVIDER:null,SETTLEMENT_RAIL:null})
  await run('desktop-download-x64','node',['desktop/download.mjs'],{DESKTOP_ARCH:'x64'})
  await run('desktop-x64','node',['desktop/build.mjs','--dmg','--unsigned'],{DESKTOP_ARCH:'x64'})
  report.x64='built; native acceptance pending'
  report.dmgs=readdirSync('desktop/out').filter(f=>f.endsWith('.dmg')).map(f=>artifact(join('desktop/out',f)))
  await run('browser','npx',['playwright','test'])
  await run('demo-build','npm',['run','build:demo'])
  await run('browser-demo','npx',['playwright','test','--config','playwright.demo.config.ts'])
  await run('browser-ledger','npx',['playwright','test','--config','playwright.ledger.config.ts'])
  // GitHub-hosted pages are read only through authenticated gh, as are all GitHub accesses.
  report.site=[]
  for(const page of ['demo','ledger']) {
    const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)])
    for(const p of walk('site/'+page)) {
      const url='https://collaboration95.github.io/theFastandtheFungible/'+p.slice(5)
      const remote=execFileSync('gh',['api',url],{env,maxBuffer:20*1024**2})
      const hash=createHash('sha256').update(remote).digest('hex')
      const match=hash===digest(p);report.site.push({url,sha256:hash,match});save();if(!match)throw Error('Published page differs from committed-source build: '+url)
    }
  }
  await run('check-fast','npm',['run','check:fast'])
  await run('python','python3',['-m','pytest','packages/sdk-python'])
  await run('coverage','npx',['vitest','run','--coverage'])
  await run('coverage-gate','node',['scripts/check-coverage.mjs'])
  await run('chaos','npm',['run','chaos','--','--runs','200','--seed','279'])
  report.pass=true
} catch(error) {report.error=error.message;process.exitCode=1}
finally {
  const soak='scratch/finals-soak-279.json'
  if(existsSync(soak)){const r=JSON.parse(readFileSync(soak));report.soak={file:soak,sha256:digest(soak),source:r.source,summary:r.summary,burst:r.burst,restarts:r.restarts.length}}
  report.finishedAt=new Date().toISOString();save();cpSync(out,destination,{recursive:true});if(existsSync(join(out,'release')))cpSync(join(out,'release'),'dist/release',{recursive:true});console.log(JSON.stringify({pass:report.pass,error:report.error,output:join(destination,'acceptance.json')}))
}
