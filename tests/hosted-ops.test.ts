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
   expect(output).toContain('--budget-amount=50USD')
   expect(output).not.toMatch(/sentinel-private|firestore|gcloud.*storage.*create/)
   expect(existsSync(join(dir,'manifest.json'))).toBe(false)
  } finally {rmSync(dir,{recursive:true,force:true})}
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
  expect(readFileSync('docker/Dockerfile.publisher','utf8')).toContain('if (process.env.K_SERVICE) throw')
 })
})
