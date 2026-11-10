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
   const output=run('docker/hosted/ops.mjs',args,{PATH:dir+':'+process.env.PATH,DEEPSEEK_API_KEY:'sentinel-private-value',XRPL_PAYER_SEED:'sentinel-private-seed'})
   expect(output).toContain("'compute' 'instances' 'create'")
   expect(output).toContain('--machine-type=e2-standard-2')
   expect(output).toContain('--resource-policies=ra-daily')
   expect(output).toContain('--source-ranges=10.77.0.0/24')
   expect(output).toContain('--source-ranges=35.235.240.0/20')
   expect(output).toContain('--vpc-egress=private-ranges-only')
   expect(output).toContain('--timeout=3600')
   expect(output).toContain("'billing' 'accounts' 'describe' '000000-000000-000000' '--format=value(currencyCode)'")
   expect(output).toContain('--budget-amount=RESOLVED_FROM_BILLING_CURRENCY')
   expect(output).toContain('--path=/ready')
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
   expect(source).toMatch(/billingAccountName\)'\]\) !== `billingAccounts\/\$\{billing\}`\) gc\(\['billing','projects','link'/)
   expect(output).toMatch(/'billing' 'budgets' 'create' '--billing-account=[^']+' '--billing-project=ra-ho-test'/)
   // GCP service-account IDs must be 6-30 characters ("ra-vm" was rejected in cloud).
   const accounts=[...output.matchAll(/'service-accounts' 'create' '([^']+)'/g)].map(m=>m[1])
   expect(accounts).toEqual(['ra-app-vm','ra-front'])
   for (const id of accounts) expect(id).toMatch(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/)
   expect(output).not.toMatch(/sentinel-private|firestore|gcloud.*storage.*create/)
   expect(existsSync(join(dir,'manifest.json'))).toBe(false)
  } finally {rmSync(dir,{recursive:true,force:true})}
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
  expect(startup).not.toMatch(/env\.local[\s\S]*(SEED|API_KEY|PUBLISHER_SECRET)/)
  expect(startup).toContain('[[ $name != DECISION_PROVIDER || $value =~ ^(openai|cloudflare|fixture)$ ]] || exit 1')
  expect(startup.lastIndexOf('researchagent-startup.done')).toBeGreaterThan(startup.indexOf('bash /opt/researchagent/update.sh'))
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
  expect(readFileSync('docker/Dockerfile.publisher','utf8')).toContain('if (process.env.K_SERVICE) throw')
 })
})
