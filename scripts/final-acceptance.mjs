import { createStepRunner, acceptanceOutcome, runGraph } from './final-acceptance-steps.mjs'
/** Local fixture rehearsal. No dotenv, publication, signing, or release mutation. */
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync, readlinkSync, cpSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { hostname, platform, release, arch, cpus, loadavg } from 'node:os'
const quick=process.argv.includes('--quick')
const failFast=process.argv.includes('--fail-fast')
const skipSoak=process.argv.includes('--skip-soak')
const serial=process.argv.includes('--serial')
const isolatedSoak=process.argv.includes('--isolated-soak')
const allArch=process.argv.includes('--all-arch')
if(process.argv.slice(2).some(a=>!['--quick','--fail-fast','--skip-soak','--serial','--isolated-soak','--all-arch'].includes(a))) throw Error('Usage: node scripts/final-acceptance.mjs [--quick] [--fail-fast] [--skip-soak] [--serial] [--isolated-soak] [--all-arch]')
const out=resolve('scratch/final-acceptance-'+new Date().toISOString().replace(/[^0-9]/g,''));mkdirSync(out,{recursive:true})
const destination=resolve('dist/final')
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const env=Object.fromEntries(['PATH','HOME','TMPDIR','LANG'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
Object.assign(env,{DOTENV_CONFIG_PATH:'.no-final-env',LLM_PROVIDER:'fixture',DECISION_PROVIDER:'fixture',SETTLEMENT_RAIL:'simulated',LANGFUSE_ENABLED:'0',SEARCH_EMBEDDINGS:'off',CSC_IDENTITY_AUTO_DISCOVERY:'false'})
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const report={schema:1,acceptanceEligible:!quick&&!skipSoak,mode:skipSoak?'fixture rehearsal; soak explicitly skipped':quick?'quick fixture rehearsal; RSS slope diagnostic only; not full acceptance':'full fixture workload on a declared local host',sourceSha:git('rev-parse','HEAD'),sourceTree:git('rev-parse','HEAD^{tree}'),worktreeDirty:Boolean(git('status','--porcelain')),runnerSha256:digest('scripts/final-acceptance.mjs'),timestamp:new Date().toISOString(),host:{hostname:hostname(),platform:platform(),release:release(),arch:arch(),cpus:cpus().length,node:process.version,load:loadavg()},gates:[],artifacts:[],dmgs:[],pass:false}
const save=()=>{writeFileSync(join(out,'acceptance.json'),JSON.stringify(report,null,2)+'\n');mkdirSync(destination,{recursive:true});cpSync(join(out,'acceptance.json'),join(destination,'acceptance.json'))}
report.schedule={mode:serial?'serial':isolatedSoak?'isolated soak then DAG':'bounded DAG including soak',concurrency:4,siblingNiceness:10,localArchitectures:allArch?['arm64','x64']:['arm64'],hostedArchitectures:['arm64','x64']}
const step=createStepRunner(report,save,failFast)
const tasks=[]
const schedule=(name,action,after=[])=>tasks.push({name,run:action,after})
async function run(name,cmd,args,extra={},dependencies=[]) {
 return step(name,async row=>{
  // Give the timing-sensitive soak priority over sibling compiler/packaging work.
  const command=name==='soak'?cmd:'/usr/bin/nice'
  const argv=name==='soak'?args:['-n','10',cmd,...args]
  row.command=[command,...argv];save()
  const log=join(out,name+'.log')
  const {openSync,closeSync}=await import('node:fs');const fd=openSync(log,'w')
  try {const code=await new Promise((done,fail)=>{const child=spawn(command,argv,{env:Object.fromEntries(Object.entries({...env,...extra}).filter(([,v])=>v!==null)),stdio:['ignore',fd,fd]});child.on('error',fail);child.on('exit',done) });row.exitCode=code;row.pass=code===0;if(!row.pass)throw Error(name+' failed; see '+log)}
  finally {closeSync(fd);row.finishedAt=new Date().toISOString();row.logSha256=digest(log);save()}
 },dependencies)
}
const artifact=(p)=>({file:p,bytes:statSync(p).size,sha256:digest(p)})
try {
  if(platform()!=='darwin'||arch()!=='arm64')throw Error('Full unsigned arm64 acceptance requires an Apple Silicon Mac')
  const ts=new Date().toISOString().replace(/[^0-9]/g,'')
  const browserResults=resolve('test-results','final-acceptance-'+ts);report.browserResults=browserResults
  const soak=join(out,'soak-same-engine.json');mkdirSync('scratch',{recursive:true})
  schedule('soak',async()=> {if(skipSoak){report.gates.push({name:'soak',pass:false,status:'skipped (requested)'});save();return}
  await run('soak','caffeinate',['-dims','node','scripts/soak-same-engine.mjs','--runs',quick?'200':'2000','--warmup',quick?'20':'200','--concurrency','1','--seed','279','--history-runs','10000','--events-per-run','60','--data-dir','scratch/finals-soak-279-'+ts,'--output',soak,'--burst',...(quick?['--diagnostic-slope']:[])])
  })
  schedule('soak-evidence',()=>step('soak-evidence',async()=>{const r=JSON.parse(readFileSync(soak));report.soak={file:soak,sha256:digest(soak),source:r.source,summary:r.summary,burst:r.burst,restarts:r.restarts.length}},skipSoak?['soak']:[]),['soak'])
  schedule('render',()=>run('render','node',['scripts/render-soak.mjs',soak,join(out,'soak-same-engine.svg')],{},['soak-evidence']),['soak-evidence'])
  schedule('artifacts',()=>run('artifacts','make',['release-artifacts']),['browser', 'desktop-arm64', 'coverage',...(allArch?['desktop-x64']:[])])
  schedule('artifact-preservation',()=>step('artifact-preservation',async()=>{
    report.artifacts=JSON.parse(readFileSync('dist/release/manifest.json')).artifacts
    cpSync('dist/release',join(out,'release'),{recursive:true})
  },['artifacts']),['artifacts'])
  schedule('consumers',()=>run('consumers','node',['scripts/check-release-consumers.mjs','--manifest','dist/release/manifest.json'],{},['artifacts']),['artifacts'])
  schedule('artifact-evidence',()=>step('artifact-evidence',async()=>{
  report.artifacts=JSON.parse(readFileSync('dist/release/manifest.json')).artifacts;save()
  report.consumers=JSON.parse(readFileSync('dist/release/consumer-results.json'));report.verifiers=report.consumers.verifiers;cpSync('dist/release',join(out,'release'),{recursive:true});save()
  },['artifacts','consumers']),['artifacts', 'consumers'])
  schedule('desktop-download-arm64',()=>run('desktop-download-arm64','node',['desktop/download.mjs'],{DESKTOP_ARCH:'arm64'}),[])
  schedule('desktop-arm64',()=>run('desktop-arm64','node',['desktop/build.mjs','--dmg','--unsigned'],{DESKTOP_ARCH:'arm64'},['desktop-download-arm64']),['desktop-download-arm64', 'browser', 'coverage'])
  schedule('arm64-evidence',()=>step('arm64-evidence',async()=>{
  report.dmgs=readdirSync('desktop/out').filter(f=>f.endsWith('.dmg')).map(f=>artifact(join('desktop/out',f)));save()
  const app=resolve('desktop/out/mac-arm64/ResearchAgent.app')
  const walkApp=(dir,relative='')=>readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    const p=join(dir,e.name),name=join(relative,e.name)
    return e.isSymbolicLink()?[{file:name,symlink:readlinkSync(p)}]:e.isDirectory()?walkApp(p,name):[{...artifact(p),file:name}]
  })
  const appManifest=join(out,'app-manifest.json');writeFileSync(appManifest,JSON.stringify(walkApp(app),null,2)+'\n')
  report.app={path:app,manifest:artifact(appManifest),executable:artifact(join(app,'Contents/MacOS/ResearchAgent'))};save()
  },['desktop-arm64']),['desktop-arm64'])
  const app=resolve('desktop/out/mac-arm64/ResearchAgent.app')
  schedule('desktop-recovery',()=>run('desktop-recovery','node',['desktop/smoke.mjs','--fixture-only','--recovery','--app',app,'--output',join(out,'desktop-recovery.json')],{RA_DESKTOP_KEYCHAIN_SERVICE:'ResearchAgent-Accept-'+randomUUID(),LLM_PROVIDER:null,DECISION_PROVIDER:null,SETTLEMENT_RAIL:null},['desktop-arm64','arm64-evidence']),['desktop-arm64','arm64-evidence'])
  if(allArch) {
  schedule('desktop-download-x64',()=>run('desktop-download-x64','node',['desktop/download.mjs'],{DESKTOP_ARCH:'x64'}),['desktop-recovery'])
  schedule('desktop-x64',()=>run('desktop-x64','node',['desktop/build.mjs','--dmg','--unsigned'],{DESKTOP_ARCH:'x64'},['desktop-download-x64']),['desktop-download-x64'])
  schedule('x64-evidence',()=>step('x64-evidence',async()=>{
  report.x64='built; native acceptance pending'
  report.dmgs=readdirSync('desktop/out').filter(f=>f.endsWith('.dmg')).map(f=>artifact(join('desktop/out',f)))
  },['desktop-x64']),['desktop-x64'])
  } else report.x64='deferred to hosted desktop release matrix; native acceptance pending'
  schedule('browser',()=>run('browser','npx',['playwright','test','--output',join(browserResults,'app')]),['coverage'])
  schedule('demo-build',()=>run('demo-build','npm',['run','build:demo']),[])
  schedule('browser-demo',()=>run('browser-demo','npx',['playwright','test','--config','playwright.demo.config.ts','--output',join(browserResults,'demo')],{},['demo-build']),['demo-build'])
  schedule('browser-ledger',()=>run('browser-ledger','npx',['playwright','test','--config','playwright.ledger.config.ts','--output',join(browserResults,'ledger')]),[])
  report.site=[]
  for(const page of ['demo','ledger']) schedule('site-'+page,()=>step('site-'+page,async()=>{
    const url='https://collaboration95.github.io/theFastandtheFungible/'+page+'/'
    const response=execFileSync('gh',['api','--include',url],{env,maxBuffer:20*1024**2}).toString()
    const status=Number(response.match(/^HTTP\/\S+ (\d+)/)?.[1])
    report.site.push({url,status});if(status!==200)throw Error(url+' status '+status)
  }))
  schedule('hygiene',()=>run('hygiene','npm',['run','hygiene']))
  schedule('lint',()=>run('lint','npm',['run','lint']))
  schedule('typecheck',()=>run('typecheck','npm',['run','typecheck']))
  schedule('check-fast',()=>step('check-fast',async row=>{row.coveredBy=['hygiene','lint','typecheck','coverage','chaos']} ,['hygiene','lint','typecheck','coverage','chaos']),['hygiene','lint','typecheck','coverage','chaos'])
  schedule('python',()=>run('python','python3',['-m','pytest','packages/sdk-python']),[])
  schedule('ui-build',()=>run('ui-build','npm',['run','build']))
  schedule('coverage',()=>run('coverage','npx',['vitest','run','--coverage']),['ui-build'])
  schedule('coverage-gate',()=>run('coverage-gate','node',['scripts/check-coverage.mjs'],{},['coverage']),['coverage'])
  schedule('chaos',()=>run('chaos','npm',['run','chaos','--','--runs','200','--seed','279']),[])
  if(isolatedSoak) for(const task of tasks) if(!['soak','soak-evidence','render'].includes(task.name)) task.after=[...(task.after??[]),'soak']
  // Start long independent work first; reserve the dist writer chain for coverage → browser → desktop → artifacts.
  const priority=['soak','chaos','ui-build','coverage','demo-build','browser-demo']
  const rank=name=>priority.includes(name)?priority.indexOf(name):priority.length
  if(!serial) tasks.sort((a,b)=>rank(a.name)-rank(b.name))
  await runGraph(tasks,{concurrency:serial?1:4,failFast})
  Object.assign(report,acceptanceOutcome(report.gates,quick||skipSoak));if(!report.checksPass)process.exitCode=1
} catch(error) {report.error=error.message;process.exitCode=1}
finally {
  report.finishedAt=new Date().toISOString();report.durationMs=Date.parse(report.finishedAt)-Date.parse(report.timestamp);save();cpSync(out,destination,{recursive:true});if(existsSync(join(out,'release')))cpSync(join(out,'release'),'dist/release',{recursive:true});console.log(JSON.stringify({pass:report.pass,checksPass:report.checksPass,acceptanceEligible:report.acceptanceEligible,error:report.error,output:join(destination,'acceptance.json')}))
}
