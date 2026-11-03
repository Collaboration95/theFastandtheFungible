// Local fixture-only first-run path. Run with node --import tsx; no .env, no fixed test ports.
import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { performance } from 'node:perf_hooks'
const out = mkdtempSync('/tmp/round2-q-')
const port = () => new Promise(resolve => { const s=createServer(); s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))}) })
const [web,api,pub]=await Promise.all([port(),port(),port()])
const env={...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD:'1', DEMO_WEB_PORT:String(web),DEMO_API_PORT:String(api),DEMO_PUBLISHER_PORT:String(pub),APP_DB:out+'/app.db',PUBLISHER_DB:out+'/publisher.db',REPORT_DIR:out+'/reports',RA_URL:`http://127.0.0.1:${api}`,RA_API_TOKEN:randomBytes(32).toString('hex'),MCP_MAX_BUDGET_MINOR:'200',MCP_DAILY_CAP_MINOR:'500',SETTLEMENT_RAIL:'simulated',SEARCH_EMBEDDINGS:'off',LANGFUSE_ENABLED:'0'}
env.RA_DATA_DIR=out
const codespaces=process.env.Q_CODESPACES === '1'
const results={scope:'local, warm npm cache, fixture models, simulated SGD; not a real Codespace',ports:'OS-assigned',steps:{}}
function timed(name,cmd,args){const t=performance.now();const output=execFileSync(cmd,args,{env,encoding:'utf8'});results.steps[name]=Number(((performance.now()-t)/1000).toFixed(3));return output}
timed('npm ci','npm',['ci'])
const t=performance.now();const demo= codespaces ? spawn(process.execPath,['--import','tsx','.devcontainer/start.ts'],{env,stdio:['ignore','pipe','pipe']}) : spawn('make',['run'],{env,stdio:['ignore','pipe','pipe']})
try{
 await new Promise((resolve,reject)=>{let text='';const timeout=setTimeout(()=>reject(Error('demo readiness timeout')),30000);demo.stdout.on('data',b=>{text+=b;if(text.includes('ResearchAgent ready:')){clearTimeout(timeout);resolve()}});demo.once('exit',()=>reject(Error('demo exited')));demo.stderr.resume()})
 results.steps[codespaces ? 'devcontainer → ready' : 'make run → ready']=Number(((performance.now()-t)/1000).toFixed(3))
 const ts=timed('examples/ask.ts','node',['--import','tsx','examples/ask.ts']);writeFileSync(out+'/ask.txt',ts)
 if(!ts.includes('What your money bought') || !ts.includes('"structuralUse":"cited"'))throw Error('missing paid contribution')
 timed('fresh venv','python3',['-m','venv',out+'/venv'])
 timed('pip install',out+'/venv/bin/pip',['install','./packages/sdk-python'])
 const py=timed('examples/python/ask.py',out+'/venv/bin/python',['examples/python/ask.py']);writeFileSync(out+'/python.txt',py)
 if(!py.includes('2 of 2 requested facts answered.'))throw Error('coverage failed')
 const quick=timed('sdk-quickstart','node',['--import','tsx','examples/sdk-quickstart.ts']);writeFileSync(out+'/quickstart.txt',quick)
 console.log(JSON.stringify({...results,logs:out},null,2))
}finally{demo.kill('SIGTERM');await new Promise(resolve=>demo.once('exit',resolve))}
