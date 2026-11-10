// Operator CLI: atomic persistent-disk control changes, locally or via IAP SSH.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
const [action,...argv]=process.argv.slice(2)
const o={}
for(let i=0;i<argv.length;i++) {
  if(['--dry-run','--execute','--local'].includes(argv[i])) o[argv[i].slice(2)]=true
  else if(['--project','--reason','--path'].includes(argv[i])&&argv[i+1]) o[argv[i].slice(2)]=argv[++i]
  else throw Error('Unknown control option')
}
if(!['init','pause','resume','status'].includes(action)) throw Error('Expected init, pause, resume or status')
if(o.execute&&o['dry-run']) throw Error('Choose one execution mode')
const path=o.path||'/srv/researchagent/control.json'
if(o.local) {
  if(!o.execute || o['dry-run']) { console.log(JSON.stringify({action,path,state:'planned'})); process.exit(0) }
  process.umask(0o077)
  let control=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):undefined
  if(!control && action!=='init') throw Error('Control missing: initialize paused first')
  control ||= {admissionsPaused:true,spendingPaused:true,reasonCode:'prelaunch',expiresAt:'2026-11-19T16:00:00Z'}
  if(typeof control.admissionsPaused!=='boolean'||typeof control.spendingPaused!=='boolean'||!Number.isFinite(Date.parse(control.expiresAt))) throw Error('Invalid durable control')
  if(action==='init' && existsSync(path)) { console.log('control exists; unchanged'); process.exit(0) }
  if(action==='resume' && Date.now()>=Date.parse(control.expiresAt)) throw Error('Admissions expired')
  if(action==='pause'||action==='resume') Object.assign(control,{admissionsPaused:action==='pause',spendingPaused:action==='pause',reasonCode:action==='pause'?(o.reason||'operator'):'ready'})
  if(!/^[a-z0-9-]{1,64}$/.test(control.reasonCode)) throw Error('Reason must be a bounded code')
  if(action!=='status') {
    const temp=`${path}.${randomUUID()}`
    writeFileSync(temp,JSON.stringify(control)+'\n',{mode:0o600,flag:'wx'})
    // fsync file + directory so a crash cannot silently lose the pause.
    const {openSync,fsyncSync,closeSync}=await import('node:fs')
    const fd=openSync(temp,'r');fsyncSync(fd);closeSync(fd)
    renameSync(temp,path)
    const {dirname}=await import('node:path');const dir=openSync(dirname(path),'r');fsyncSync(dir);closeSync(dir)
  }
  console.log(JSON.stringify(control));process.exit(0)
}
if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(o.project||'')) throw Error('--project required')
if(o.reason && !/^[a-z0-9-]{1,64}$/.test(o.reason)) throw Error('Invalid reason')
if(o.path) throw Error('Remote control uses only the fixed persistent-disk path')
const cmd=`sudo docker compose --env-file /etc/researchagent/images -f /opt/researchagent/compose.yaml exec -T api node /app/scripts/hosted-control.mjs ${action} --local --execute --path /state/control.json${o.reason?' --reason '+o.reason:''}`
const args=['compute','ssh','ra-app',`--project=${o.project}`,'--zone=asia-southeast1-b','--tunnel-through-iap',`--command=${cmd}`]
if(!o.execute||o['dry-run']) console.log(['gcloud',...args].map(x=>"'"+x.replaceAll("'","'\\''")+"'").join(' '))
else {execFileSync('gcloud',args,{stdio:'inherit'})}
