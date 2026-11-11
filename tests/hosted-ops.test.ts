import { describe, it, expect } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync, statSync, existsSync } from 'node:fs'
import { resources } from './helpers/resource-scope.js'
import { join } from 'node:path'
const run=(file:string,args:string[],env={})=>execFileSync(process.execPath,[file,...args],{encoding:'utf8',env:{...process.env,...env}})
describe('hosted operator boundaries',()=>{
 it('plans the VM/front topology without invoking cloud tools or leaking env secrets',()=>{
  const dir=resources().tempDir('ra-ho-test-')
  try {
   writeFileSync(join(dir,'gcloud'),'#!/bin/sh\nexit 99\n',{mode:0o700})
   const args=['deploy','--project','ra-ho-test','--billing-account','000000-000000-000000','--manifest',join(dir,'manifest.json'),'--notification-channel','projects/ops/notificationChannels/123']
   const output=run('docker/hosted/ops.mjs',args,{PATH:dir+':'+process.env.PATH,DEEPSEEK_API_KEY:'sentinel-private-value',XRPL_PAYER_SEED:'sentinel-private-seed',XRPL_PUBLISHER_THE_FAB_FLOOR_SEED:'sentinel-private-writer'})
   expect(output).toContain("'compute' 'instances' 'create'")
   // A writer seed named by data/writers and by the environment is one secret, created once.
   const created=[...output.matchAll(/'secrets' 'create' '([^']+)'/g)].map(m=>m[1])
   expect(created.filter(s=>s.startsWith('ra-xrpl-publisher-the-fab-floor-seed-'))).toHaveLength(1)
   expect(new Set(created).size).toBe(created.length)
   expect(output).toContain('--machine-type=e2-standard-2')
   expect(output).toContain('--resource-policies=ra-daily')
   expect(output).toContain('--source-ranges=10.77.0.0/24')
   expect(output).toContain('--source-ranges=35.235.240.0/20')
   expect(output).toContain('--vpc-egress=private-ranges-only')
   expect(output).toContain('--timeout=3600')
   expect(output).toContain("'billing' 'accounts' 'describe' '000000-000000-000000' '--format=value(currencyCode)'")
   expect(output).toContain('--budget-amount=RESOLVED_FROM_BILLING_CURRENCY')
   expect(output).toContain('--path=/ready')
   // An existing uptime check is put back to 60 s on every deploy (H6: it was slowed to 900 s while probes minted sessions).
   expect(output).toContain("'monitoring' 'uptime' 'update' 'UPTIME_ID' '--project=ra-ho-test' '--period=1'")
   expect(output).toContain("'--tunnel-through-iap' '--quiet'")
   expect(output).toContain('/run/researchagent-startup.done')
   expect(output).toContain('restart --no-block google-startup-scripts.service')
   // Archive modes, not the operator's private umask, reach the image (UID 1000 must read /app).
   expect(output).toContain("tar -xpf '/PRIVATE_BUILD_DIRECTORY/.source.tar'")
   // Cloud API lessons: quoted filter values and a quota project for budgets.
   const source=readFileSync('docker/hosted/ops.mjs','utf8')
   expect(source).not.toMatch(/--filter=displayName=[^"]/)
   // Teardown retries must treat Cloud Run's "Cannot find service" as already absent.
   expect(source).toContain('Cannot find/i')
   // Re-linking an already linked project is a rate-limited write (429 in cloud).
   expect(source).toMatch(/billingAccountName\)'\],\{attempts:6\}\) !== `billingAccounts\/\$\{billing\}`\) gc\(\['billing','projects','link'/)
   expect(output).toMatch(/'billing' 'budgets' 'create' '--billing-account=[^']+' '--billing-project=ra-ho-test'/)
   // GCP service-account IDs must be 6-30 characters ("ra-vm" was rejected in cloud).
   const accounts=[...output.matchAll(/'service-accounts' 'create' '([^']+)'/g)].map(m=>m[1])
   expect(accounts).toEqual(['ra-app-vm','ra-front'])
   for (const id of accounts) expect(id).toMatch(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/)
   expect(output).not.toMatch(/sentinel-private|firestore|gcloud.*storage.*create/)
   expect(existsSync(join(dir,'manifest.json'))).toBe(false)
  } finally {rmSync(dir,{recursive:true,force:true})}
 })
 it('plans a signing seed for every served writer, free-only Open Records included (R9-B drops unsigned free articles)',()=>{
  const dir=resources().tempDir('ra-ho-writers-')
  writeFileSync(join(dir,'gcloud'),'#!/bin/sh\nexit 99\n',{mode:0o700})
  const args=['deploy','--project','ra-ho-test','--billing-account','000000-000000-000000','--manifest',join(dir,'manifest.json'),'--notification-channel','projects/ops/notificationChannels/123','--dry-run']
  const output=run('docker/hosted/ops.mjs',args,{PATH:dir+':'+process.env.PATH})
  const created=[...output.matchAll(/'secrets' 'create' '([^']+)'/g)].map(m=>m[1])
  const served=execFileSync('ls',['data/writers'],{encoding:'utf8'}).split('\n').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(join('data/writers',f),'utf8')).publisher)
  expect(served.find(p=>p.slug==='open-records')).toBeTruthy()
  expect(Object.values(served.find(p=>p.slug==='open-records').prices??{}).some(n=>Number(n)>0)).toBe(false) // free-only
  for (const p of served) expect(created.filter(s=>s.startsWith(`ra-xrpl-publisher-${p.slug}-seed-`))).toHaveLength(1)
  // The same wallet flow provisions it: hosted-wallets.ts plans one seed file per served writer (dry run, no Testnet).
  const wallets=execFileSync(process.execPath,['--import','tsx','scripts/hosted-wallets.ts','--testnet','--out',join(dir,'wallets'),'--dry-run'],{encoding:'utf8'})
  expect(wallets).toContain(join(dir,'wallets','XRPL_PUBLISHER_OPEN_RECORDS_SEED'))
  for (const p of served) expect(wallets).toContain(`ra-xrpl-publisher-${p.slug}-seed-RELEASE`)
  expect(existsSync(join(dir,'wallets'))).toBe(false)
 })
 it('states the budget in the billing currency, redacts the alert address and plans adoption checks',()=>{
  const dir=resources().tempDir('ra-ho-budget-')
  try {
   writeFileSync(join(dir,'gcloud'),'#!/bin/sh\nexit 99\n',{mode:0o700})
   const args=['deploy','--project','ra-ho-test','--billing-account','000000-000000-000000','--manifest',join(dir,'manifest.json'),'--alert-email','operator.private@example.com','--budget-amount','70SGD','--adopt-project','--dry-run']
   const output=run('docker/hosted/ops.mjs',args,{PATH:dir+':'+process.env.PATH})
   expect(output).toContain('--budget-amount=70SGD')
   expect(output).toContain('email_address=<alert-email>')
   expect(output).not.toContain('operator.private@example.com')
   expect(output).toContain("'projects' 'describe' 'ra-ho-test' '--format=json'")
   expect(output).toContain("'billing' 'projects' 'describe' 'ra-ho-test' '--format=json'")
   const bad=spawnSync(process.execPath,['docker/hosted/ops.mjs',...args.slice(0,-3),'70 SGD','--dry-run'],{encoding:'utf8'})
   expect(bad.status).not.toBe(0)
  } finally {rmSync(dir,{recursive:true,force:true})}
 })
 it('derives budgets from the billing currency and adopts only the labelled, linked project',async()=>{
  const {budgetAmount,adoptable}=await import('../docker/hosted/budget.mjs')
  expect(budgetAmount('USD')).toBe('50USD')
  expect(budgetAmount('SGD')).toBe('70SGD')
  expect(budgetAmount('SGD','65.50SGD')).toBe('65.50SGD')
  expect(()=>budgetAmount('SGD','50USD')).toThrow(/currency SGD/)
  expect(()=>budgetAmount('EUR')).toThrow(/--budget-amount/)
  expect(()=>budgetAmount('')).toThrow(/unavailable/)
  const project={lifecycleState:'ACTIVE',labels:{purpose:'sff-demo',expires:'20261120'}}
  const link={billingEnabled:true,billingAccountName:'billingAccounts/000000-000000-000000'}
  expect(adoptable(project,link,'000000-000000-000000')).toBe(true)
  expect(adoptable({...project,labels:{purpose:'other',expires:'20261120'}},link,'000000-000000-000000')).toBe(false)
  expect(adoptable(project,{...link,billingAccountName:'billingAccounts/111111-111111-111111'},'000000-000000-000000')).toBe(false)
  expect(adoptable({...project,lifecycleState:'DELETE_REQUESTED'},link,'000000-000000-000000')).toBe(false)
 })
 it('keeps operator runtime overrides across re-renders and accepts only allowlisted names',()=>{
  const startup=readFileSync('docker/hosted/startup.sh','utf8')
  expect(startup).toContain('/etc/researchagent/env.local')
  expect(startup).toMatch(/HOSTED_PROVIDERS_READY_UNTIL\|HOSTED_\(RESEARCH\|DECISION\)/)
  const allowlist=startup.split('\n').find(line=>line.includes('$name =~ ^(HOSTED_PROVIDERS_READY_UNTIL'))!
  expect(allowlist).not.toMatch(/SEED|API_KEY|SECRET|HMAC/)
  expect(startup).toContain('[[ $name != DECISION_PROVIDER || $value =~ ^(openai|cloudflare|fixture)$ ]] || exit 1')
  expect(startup.lastIndexOf('researchagent-startup.done')).toBeGreaterThan(startup.indexOf('bash /opt/researchagent/update.sh'))
  // Escrow is offered by the writers whose seeds are deployed (the publisher refuses quotes otherwise).
  const escrow=startup.slice(startup.indexOf("if ! grep -q '^ESCROW_WRITERS='"),startup.indexOf('chmod 600 /etc/researchagent/env.new'))
  const map='XRPL_PUBLISHER_THE_FAB_FLOOR_SEED=ra-x\nXRPL_PAYER_SEED=ra-y\nXRPL_PUBLISHER_ALPHALEAK_SEED=ra-z\nDEEPSEEK_API_KEY=ra-k\n'
  const dir=resources().tempDir('ra-ho-escrow-')
  writeFileSync(join(dir,'secrets.map'),map); writeFileSync(join(dir,'env.new'),'HOSTED=1\n')
  execFileSync('bash',['-c',escrow.replaceAll('/opt/researchagent',dir).replaceAll('/etc/researchagent',dir)])
  expect(readFileSync(join(dir,'env.new'),'utf8')).toBe('HOSTED=1\nESCROW_WRITERS=the-fab-floor,alphaleak\n')
  // A broken current image must not block its replacement: pause falls back to the durable file.
  expect(startup).toMatch(/hosted-control\.mjs pause --local --execute --path \/state\/control\.json --reason deploy \|\| pause_on_disk/)
 })
 it('keeps final snapshot before deleting the disk and never deletes the project',()=>{
  const output=run('docker/hosted/ops.mjs',['teardown','--project','ra-ho-test','--manifest','/tmp/absent-ho-manifest.json','--dry-run'])
  expect(output.indexOf("'disks' 'snapshot'")).toBeLessThan(output.indexOf("'disks' 'delete'"))
  expect(output).toContain('finalSnapshot')
  expect(output).not.toContain("'projects' 'delete'")
 })
 it('persists paused control privately, does not reset on init, and refuses expired resume',()=>{
  const dir=resources().tempDir('ra-ho-control-'),file=join(dir,'control.json')
  const args=['--local','--execute','--path',file]
  try {
   run('scripts/hosted-control.mjs',['init',...args])
   expect(statSync(file).mode&0o777).toBe(0o600)
   expect(JSON.parse(readFileSync(file,'utf8')).spendingPaused).toBe(true)
   run('scripts/hosted-control.mjs',['pause',...args,'--reason','maintenance'])
   run('scripts/hosted-control.mjs',['init',...args])
   expect(JSON.parse(readFileSync(file,'utf8')).reasonCode).toBe('maintenance')
   writeFileSync(file,JSON.stringify({admissionsPaused:true,spendingPaused:true,expiresAt:'2020-01-01T00:00:00Z'}))
   expect(spawnSync(process.execPath,['scripts/hosted-control.mjs','resume',...args]).status).not.toBe(0)
  } finally {rmSync(dir,{recursive:true,force:true})}
 })
 it('strips unapproved headers, disables SSE buffering and preserves the publisher Cloud Run guard',()=>{
  const front=readFileSync('docker/hosted/front/default.conf.template','utf8')
  expect(front).toContain('proxy_pass_request_headers off')
  expect(front).toContain('proxy_set_header X-Forwarded-For $visitor_ip')
  expect(front).not.toContain('$proxy_add_x_forwarded_for')
  expect(front).toContain('proxy_buffering off')
  expect(front).toContain('error_page 502 504 =503 /paused.html')
  expect(front).toMatch(/location = \/ready \{\s*rewrite \^ \/readyz break;/)
  expect(front).not.toMatch(/gzip_types[^;]*event-stream/)
  // The VM web role runs with a read-only root: nginx temp paths must all be under /tmp.
  const vm=readFileSync('docker/hosted/nginx.conf','utf8')
  for (const kind of ['client_body','proxy','fastcgi','uwsgi','scgi']) expect(vm).toMatch(new RegExp(`${kind}_temp_path /tmp/`))
  expect(readFileSync('docker/Dockerfile.publisher','utf8')).toContain('if (process.env.K_SERVICE) throw')
 })
})
