import { describe, it, expect } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { resources } from './helpers/resource-scope.js'
import { readControl } from '../server/hosted/control.js'
const run=(args:string[],env:NodeJS.ProcessEnv)=>JSON.parse(execFileSync(process.execPath,['scripts/hosted-control.mjs',...args],{env,encoding:'utf8'}))
describe('hosted gateway and operator integration',()=>{
 it('keeps separate private admission/spending controls and refuses implicit expiry renewal',()=>{
  const file=join(resources().tempDir('ra-hg-ops-'),'control.json')
  const env={...process.env,HOSTED_CONTROL_PATH:file}
  expect(run(['status'],env).effectivePaused).toBe(true)
  run(['init'],env)
  run(['resume','all'],env)
  expect(readControl(file).spendingPaused).toBe(false)
  run(['pause','admissions','--reason','maintenance-window'],env)
  expect(readControl(file)).toMatchObject({admissionsPaused:true,spendingPaused:false,reasonCode:'maintenance-window'})
  run(['pause','spending'],env)
  run(['resume','admissions'],env)
  expect(readControl(file)).toMatchObject({admissionsPaused:false,spendingPaused:true})
  writeFileSync(file,JSON.stringify({admissionsPaused:false,spendingPaused:false,reasonCode:'expired',expiresAt:'2020-01-01T00:00:00Z'}))
  expect(run(['status'],env).effectivePaused).toBe(true)
  expect(spawnSync(process.execPath,['scripts/hosted-control.mjs','resume'],{env:{...env,HOSTED_CONTROL_EXPIRES_AT:'2026-11-19T16:00:00Z'}}).status).not.toBe(0)
  expect(readControl(file).spendingPaused).toBe(true)
  run(['pause'],env)
  expect(JSON.parse(readFileSync(file,'utf8'))).toMatchObject({admissionsPaused:true,spendingPaused:true})
  run(['pause'],{...env,HOSTED_CONTROL_EXPIRES_AT:'2026-11-19T16:00:00Z'})
  expect(readControl(file).reasonCode).toBe('operator_paused')
  writeFileSync(file,'null')
  expect(run(['status'],env)).toMatchObject({effectivePaused:true,spendingPaused:true})
 })
 it('plans remote scoped control without touching disk or invoking cloud tools',()=>{
  const dir=resources().tempDir('ra-hg-plan-'), file=join(dir,'absent.json')
  writeFileSync(join(dir,'gcloud'),'#!/bin/sh\nexit 99\n',{mode:0o700})
  const out=execFileSync(process.execPath,['scripts/hosted-control.mjs','pause','spending','--project','ra-hg-test','--dry-run'],{encoding:'utf8',env:{...process.env,HOSTED_CONTROL_PATH:file,PATH:dir+':'+process.env.PATH}})
  expect(out).toContain('pause spending --local --execute --path /state/control.json')
 })
 it('routes every public writer path to HG and uses only actual gateway configuration',()=>{
  const nginx=readFileSync('docker/hosted/nginx.conf','utf8')
  expect(nginx).toContain('^/(api|runs|w|proof|livez|startupz|readyz)')
  expect(nginx).not.toContain('$publisher')
  const env=readFileSync('docker/hosted/env.template','utf8')
  expect(env).toContain('HOSTED_TRUSTED_PROXY=127.0.0.1')
  expect(env).toContain('HOSTED_PROVIDERS_READY_UNTIL=1970-01-01T00:00:00Z')
  expect(readFileSync('docker/hosted/ops.mjs','utf8')).not.toContain('HOSTED_SESSION_KEY')
 })
})
