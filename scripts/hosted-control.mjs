#!/usr/bin/env node
// Private disk control, locally or via IAP. Never exposed as an HTTP route.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, chmodSync, openSync, fsyncSync, closeSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { AUTO_REASON, MARKER_FILE, parseMarker } from '../docker/hosted/autoresume.mjs'
import { LINK_KEYS, LINKS_FILE, cleanLinks, validLink } from '../docker/hosted/links.mjs'
const [action = 'status', ...argv] = process.argv.slice(2)
const o = {}, targets = ['all','admissions','spending']
let target = 'all'
for (let i=0;i<argv.length;i++) {
  if (targets.includes(argv[i]) && i===0) target=argv[i]
  else if (['--dry-run','--execute','--local'].includes(argv[i])) o[argv[i].slice(2)]=true
  else if (['--project','--reason','--path','--only-if-reason','--video','--proof','--clear'].includes(argv[i]) && argv[i+1]) o[argv[i].slice(2)]=argv[++i]
  else throw Error('Unknown control option')
}
if (!['init','pause','resume','status','links'].includes(action)) throw Error('Expected init, pause, resume, status or links')
// links: the public video / proof links on the state disk (H7). Show them, set them (--video URL, --proof URL) or remove them (--clear video|proof|all).
for (const key of LINK_KEYS) if (o[key] !== undefined && !validLink(o[key])) throw Error(`--${key} must be a plain https URL (a real host, at most 300 characters, no spaces or quotes)`)
if (o.clear !== undefined && ![...LINK_KEYS,'all'].includes(o.clear)) throw Error('--clear takes video, proof or all')
if (action!=='links' && (LINK_KEYS.some(k=>o[k]!==undefined) || o.clear!==undefined)) throw Error('--video, --proof and --clear belong to the links action')
if (o.execute && o['dry-run']) throw Error('Choose one execution mode')
if (o.reason && !/^[a-z0-9_-]{1,64}$/.test(o.reason)) throw Error('Invalid reason')
if (o['only-if-reason'] && !/^[a-z0-9_-]{1,64}$/.test(o['only-if-reason'])) throw Error('Invalid reason')
if (o.project && o.local) throw Error('Choose local disk or remote project')
if (o.project) {
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(o.project)) throw Error('Invalid project')
  if (o.path) throw Error('Remote control uses only the fixed persistent-disk path')
  const cmd=`sudo docker compose --env-file /etc/researchagent/images -f /opt/researchagent/compose.yaml exec -T api node /app/scripts/hosted-control.mjs ${action} ${target} --local --execute --path /state/control.json${o.reason?' --reason '+o.reason:''}${LINK_KEYS.map(k=>o[k]?` --${k} ${o[k]}`:'').join('')}${o.clear?' --clear '+o.clear:''}${o['only-if-reason']?' --only-if-reason '+o['only-if-reason']:''}`
  const args=['compute','ssh','ra-app',`--project=${o.project}`,'--zone=asia-southeast1-b','--tunnel-through-iap',`--command=${cmd}`]
  if (!o.execute || o['dry-run']) console.log(['gcloud',...args].map(x=>"'"+x.replaceAll("'","'\\''")+"'").join(' '))
  else execFileSync('gcloud',args,{stdio:'inherit'})
  process.exit(0)
}
const path=resolve(o.path || process.env.HOSTED_CONTROL_PATH || 'data/hosted-control.json')
if (o['dry-run'] || (o.local && !o.execute)) { console.log(JSON.stringify({action,target,path,state:'planned'})); process.exit(0) }
process.umask(0o077)
if (action==='links') {
  const file=join(dirname(path),LINKS_FILE)
  let doc={}
  try { doc=cleanLinks(JSON.parse(readFileSync(file,'utf8'))) } catch { /* absent or unreadable: no links set */ }
  const next={...doc}
  for (const key of LINK_KEYS) if (o[key]) next[key]=o[key]
  if (o.clear) for (const key of o.clear==='all'?LINK_KEYS:[o.clear]) delete next[key]
  if (JSON.stringify(next)!==JSON.stringify(doc)) { mkdirSync(dirname(file),{recursive:true,mode:0o700}); writeDurable(file,JSON.stringify(next)+'\n') }
  console.log(JSON.stringify({file,links:next,changed:JSON.stringify(next)!==JSON.stringify(doc),note:'The API reads this file on every status call: no redeploy or restart.'},null,2))
  process.exit(0)
}
const closed={admissionsPaused:true,spendingPaused:true,reasonCode:'control_unavailable',expiresAt:'1970-01-01T00:00:00Z'}
let control
try { control=JSON.parse(readFileSync(path,'utf8')) } catch { /* unavailable is closed */ }
const valid=control && typeof control.admissionsPaused==='boolean' && typeof control.spendingPaused==='boolean' && /^[a-z0-9_-]{1,64}$/.test(control.reasonCode) && Number.isFinite(Date.parse(control.expiresAt))
// The qualification marker sits beside the control file; it arms the guarded auto-resume after an unplanned restart.
const markerPath=join(dirname(path),MARKER_FILE)
const qualified=()=>{ try { return parseMarker(JSON.parse(readFileSync(markerPath,'utf8'))) ?? null } catch { return null } }
if (action==='status') { console.log(JSON.stringify({...(valid?control:closed),effectivePaused:!valid || Date.parse(control.expiresAt)<=Date.now() || control.admissionsPaused || control.spendingPaused,qualified:qualified()},null,2)); process.exit(0) }
if (action==='init' && existsSync(path)) { if (!valid) throw Error('Invalid durable control'); console.log('control exists; unchanged'); process.exit(0) }
if (action==='resume' && (!valid || Date.parse(control.expiresAt)<=Date.now())) throw Error('Control missing, invalid or expired: initialize or pause explicitly first')
if (action==='resume' && o['only-if-reason'] && control.reasonCode!==o['only-if-reason']) throw Error('Control changed: its reason is no longer the expected one, not resuming')
const expiry=action==='resume' ? control.expiresAt : process.env.HOSTED_CONTROL_EXPIRES_AT || control?.expiresAt || '2026-11-19T16:00:00Z'
if (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry)>Date.parse('2026-11-19T16:00:00Z')) throw Error('Set a valid HOSTED_CONTROL_EXPIRES_AT within the event window')
const next={...(valid?control:closed),expiresAt:expiry,reasonCode:o.reason || (action==='resume'?'operator_ready':action==='init'?'prelaunch':'operator_paused')}
if (action==='init') { next.admissionsPaused=true; next.spendingPaused=true }
else {
  if (target!=='spending') next.admissionsPaused=action==='pause'
  if (target!=='admissions') next.spendingPaused=action==='pause'
}
mkdirSync(dirname(path),{recursive:true,mode:0o700})
// Atomic and durable: 0600 temporary file, fsync, rename, directory fsync.
function writeDurable(file,text) {
  const temp=`${file}.${randomUUID()}`
  writeFileSync(temp,text,{mode:0o600,flag:'wx'})
  const fd=openSync(temp,'r'); try {fsyncSync(fd)} finally {closeSync(fd)}
  renameSync(temp,file); chmodSync(file,0o600)
  const dir=openSync(dirname(file),'r'); try {fsyncSync(dir)} finally {closeSync(dir)}
}
writeDurable(path,JSON.stringify(next)+'\n')
// An operator bringing the WHOLE service up records which release they qualified. The release id
// comes from the running container (RA_COMMIT, set from the deployed images file). Without one
// (an older release, or a rollback to one) any earlier marker is deleted, so an unidentified
// release can never be auto-resumed on the strength of a previous release's qualification.
// The automatic resume itself leaves the operator's marker untouched.
if (action==='resume' && !next.admissionsPaused && !next.spendingPaused && o.reason!==AUTO_REASON) {
  const commit=process.env.RA_COMMIT||''
  if (/^[0-9a-f]{40}$/.test(commit)) {
    writeDurable(markerPath,JSON.stringify({commit,qualifiedAt:new Date().toISOString()})+'\n')
    if (process.env.HOSTED==='1') console.error(`Auto-resume after an unplanned restart is armed for release ${commit.slice(0,12)}`)
  } else {
    rmSync(markerPath,{force:true})
    if (process.env.HOSTED==='1') console.error('Auto-resume is NOT armed: this release has no id (RA_COMMIT); redeploy it, then resume again')
  }
}
console.log(JSON.stringify(next,null,2))
