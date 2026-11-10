#!/usr/bin/env node
// Private disk control, locally or via IAP. Never exposed as an HTTP route.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, chmodSync, openSync, fsyncSync, closeSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
const [action = 'status', ...argv] = process.argv.slice(2)
const o = {}, targets = ['all','admissions','spending']
let target = 'all'
for (let i=0;i<argv.length;i++) {
  if (targets.includes(argv[i]) && i===0) target=argv[i]
  else if (['--dry-run','--execute','--local'].includes(argv[i])) o[argv[i].slice(2)]=true
  else if (['--project','--reason','--path'].includes(argv[i]) && argv[i+1]) o[argv[i].slice(2)]=argv[++i]
  else throw Error('Unknown control option')
}
if (!['init','pause','resume','status'].includes(action)) throw Error('Expected init, pause, resume or status')
if (o.execute && o['dry-run']) throw Error('Choose one execution mode')
if (o.reason && !/^[a-z0-9_-]{1,64}$/.test(o.reason)) throw Error('Invalid reason')
if (o.project && o.local) throw Error('Choose local disk or remote project')
if (o.project) {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(o.project)) throw Error('Invalid project')
  if (o.path) throw Error('Remote control uses only the fixed persistent-disk path')
  const cmd=`sudo docker compose --env-file /etc/researchagent/images -f /opt/researchagent/compose.yaml exec -T api node /app/scripts/hosted-control.mjs ${action} ${target} --local --execute --path /state/control.json${o.reason?' --reason '+o.reason:''}`
  const args=['compute','ssh','ra-app',`--project=${o.project}`,'--zone=asia-southeast1-b','--tunnel-through-iap',`--command=${cmd}`]
  if (!o.execute || o['dry-run']) console.log(['gcloud',...args].map(x=>"'"+x.replaceAll("'","'\\''")+"'").join(' '))
  else execFileSync('gcloud',args,{stdio:'inherit'})
  process.exit(0)
}
const path=resolve(o.path || process.env.HOSTED_CONTROL_PATH || 'data/hosted-control.json')
if (o['dry-run'] || (o.local && !o.execute)) { console.log(JSON.stringify({action,target,path,state:'planned'})); process.exit(0) }
process.umask(0o077)
const closed={admissionsPaused:true,spendingPaused:true,reasonCode:'control_unavailable',expiresAt:'1970-01-01T00:00:00Z'}
let control
try { control=JSON.parse(readFileSync(path,'utf8')) } catch { /* unavailable is closed */ }
const valid=control && typeof control.admissionsPaused==='boolean' && typeof control.spendingPaused==='boolean' && /^[a-z0-9_-]{1,64}$/.test(control.reasonCode) && Number.isFinite(Date.parse(control.expiresAt))
if (action==='status') { console.log(JSON.stringify({...valid?control:closed,effectivePaused:!valid || Date.parse(control.expiresAt)<=Date.now() || control.admissionsPaused || control.spendingPaused},null,2)); process.exit(0) }
if (action==='init' && existsSync(path)) { if (!valid) throw Error('Invalid durable control'); console.log('control exists; unchanged'); process.exit(0) }
if (action==='resume' && (!valid || Date.parse(control.expiresAt)<=Date.now())) throw Error('Control missing, invalid or expired: initialize or pause explicitly first')
const expiry=action==='resume' ? control.expiresAt : process.env.HOSTED_CONTROL_EXPIRES_AT || control?.expiresAt || '2026-11-19T16:00:00Z'
if (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry)<=Date.now() || Date.parse(expiry)>Date.parse('2026-11-19T16:00:00Z')) throw Error('Set a valid future HOSTED_CONTROL_EXPIRES_AT within the event window')
const next={...valid?control:closed,expiresAt:expiry,reasonCode:o.reason || (action==='resume'?'operator_ready':action==='init'?'prelaunch':'operator_paused')}
if (action==='init') { next.admissionsPaused=true; next.spendingPaused=true }
else {
  if (target!=='spending') next.admissionsPaused=action==='pause'
  if (target!=='admissions') next.spendingPaused=action==='pause'
}
mkdirSync(dirname(path),{recursive:true,mode:0o700})
const temp=`${path}.${randomUUID()}`
writeFileSync(temp,JSON.stringify(next)+'\n',{mode:0o600,flag:'wx'})
const fd=openSync(temp,'r'); try {fsyncSync(fd)} finally {closeSync(fd)}
renameSync(temp,path); chmodSync(path,0o600)
const dir=openSync(dirname(path),'r'); try {fsyncSync(dir)} finally {closeSync(dir)}
console.log(JSON.stringify(next,null,2))
