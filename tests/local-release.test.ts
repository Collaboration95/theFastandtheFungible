import { it, expect } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { resources } from './helpers/resource-scope'
// @ts-expect-error local CLI helper
import { shipPlan } from '../scripts/ship-check.mjs'
// @ts-expect-error local CLI helper
import { admitLocalRelease, localAcceptanceGates, localGateSteps, sha256 } from '../scripts/release-contract.mjs'

it('ordinary shipping keeps current routing; full modes publish only after acceptance', () => {
  expect(shipPlan()).toEqual([['npm', ['run','gate','--','--base','origin/main']]])
  for (const mode of ['release','breaking']) {
    const plan = shipPlan({mode,base:'HEAD^',publish:true})
    expect(plan).toEqual([
      ['npm',['run','gate','--','--base','HEAD^','--full']],
      [process.execPath,['scripts/final-acceptance.mjs','--all-arch']],
      ['npm',['run','gate','--','--base','HEAD^','--full','--publish']],
    ])
  }
  expect(() => shipPlan({mode:'typo'})).toThrow('SHIP_MODE')
  expect(() => shipPlan({base:'--full'})).toThrow('SHIP_BASE')
})

it('local admission rejects stale, partial, quick, contended and tampered release evidence', () => {
  const root = resources().tempDir('local-release-contract-'), sha = 'a'.repeat(40), tree = 'b'.repeat(40), version = '1.2.3'
  const kinds = ['tgz','wheel','sdist','mcpb','mcp-tgz','metadata']
  for (const kind of kinds) writeFileSync(join(root,kind),kind)
  const manifest = { schema:1, sourceSha:sha, mode:'fixture providers; simulated settlement', artifacts:kinds.map(kind => ({kind,file:kind,version,bytes:kind.length,sha256:sha256(join(root,kind))})) }
  const manifestFile = join(root,'manifest.json'); writeFileSync(manifestFile,JSON.stringify(manifest))
  writeFileSync(join(root,'accepted-receipt.json'),'fixture receipt')
  const receipt = { verifiers:{typescript:{pass:true},python:{pass:true},receiptSha256:sha256(join(root,'accepted-receipt.json'))},sourceSha:sha,manifestSha256:sha256(manifestFile),consumers:['tgz','wheel','mcpb','mcp-tgz','app'].map(kind => ({kind,sha256:sha256(join(root,kind==='app'?'mcp-tgz':kind)),citations:1,receipts:1,intents:1,idempotent:true,capPreserved:true})) }
  const identity = {head:sha,tree,dirty:false}
  const gate = {schema:'local-gate-v1',state:'success',route:{all:true},source:identity,finalSource:identity,steps:localGateSteps.map((id: string) => ({id,state:'success'}))}
  const dmgs = ['arm64','x64'].map(arch => { const file=join(root,`ResearchAgent-${version}-${arch}.dmg`);writeFileSync(file,arch);return {file,bytes:arch.length,sha256:sha256(file)} })
  const acceptance = {pass:true,checksPass:true,acceptanceEligible:true,quick:false,worktreeDirty:false,sourceStable:true,sourceSha:sha,sourceTree:tree,schedule:{mode:'isolated soak then DAG',localArchitectures:['arm64','x64']},gates:localAcceptanceGates.map((name: string) => ({name,pass:true,status:'PASS'})),artifacts:manifest.artifacts,consumers:receipt,dmgs}
  const args = {manifest,receipt:{...receipt,manifestFile},gate,acceptance,sha,tree,version,root,dmgRoot:root}
  expect(() => admitLocalRelease(args)).not.toThrow()
  for (const patch of [{pass:false},{checksPass:false},{quick:true},{acceptanceEligible:false},{worktreeDirty:true},{sourceStable:false},{sourceSha:tree},{sourceTree:sha},{gates:[]},{schedule:{localArchitectures:['arm64']}}]) expect(() => admitLocalRelease({...args,acceptance:{...acceptance,...patch}})).toThrow()
  for (const name of localAcceptanceGates) expect(() => admitLocalRelease({...args,acceptance:{...acceptance,gates:acceptance.gates.filter((r: {name:string})=>r.name!==name)}})).toThrow('Missing acceptance gate')
  for (const id of localGateSteps) expect(() => admitLocalRelease({...args,gate:{...gate,steps:gate.steps.filter((r: {id:string})=>r.id!==id)}})).toThrow('Missing local gate step')
  expect(() => admitLocalRelease({...args,gate:{...gate,source:{...identity,dirty:true}}})).toThrow('full local gate')
  expect(() => admitLocalRelease({...args,receipt:{...args.receipt,consumers:[]}})).toThrow('consumer')
  expect(() => admitLocalRelease({...args,version:'2.0.0'})).toThrow('version mismatch')
  writeFileSync(dmgs[1].file,'swapped')
  expect(() => admitLocalRelease(args)).toThrow('DMG changed')
  writeFileSync(join(root,'tgz'),'tampered')
  expect(() => admitLocalRelease(args)).toThrow('hash changed')
})

it('default ship-check forwards to the gate for uncommitted work; publication requires clean source', () => {
  const root = resources().tempDir('ship-check-cli-'), bin=join(root,'bin')
  mkdirSync(bin)
  const env: NodeJS.ProcessEnv = {...process.env, PATH:bin+':'+process.env.PATH}
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key]
  const git = (...args: string[]) => execFileSync('git',args,{cwd:root,env,stdio:'pipe'})
  git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid')
  writeFileSync(join(root,'tracked'),'original');git('add','.');git('commit','-qm','fixture')
  writeFileSync(join(root,'tracked'),'uncommitted')
  writeFileSync(join(bin,'npm'),`#!${process.execPath}
console.log(JSON.stringify(process.argv.slice(2)))
`,{mode:0o755})
  const cli=resolve('scripts/ship-check.mjs')
  const run=(args:string[])=>spawnSync(process.execPath,[cli,...args],{cwd:root,env,encoding:'utf8'})
  const ordinary=run([])
  expect(ordinary.status).toBe(0)
  expect(JSON.parse(ordinary.stdout.trim())).toEqual(['run','gate','--','--base','origin/main'])
  const publish=run(['--publish'])
  expect(publish.status).toBe(1)
  expect(publish.stderr).toContain('clean worktree')
  expect(publish.stdout).toBe('')
})

it('release dry-run refuses dirty, mismatched and lightweight tags before any builds or remote access', () => {
  const root=resources().tempDir('release-preflight-')
  const env: NodeJS.ProcessEnv={...process.env}
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key]
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,env,stdio:'pipe'})
  git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid')
  writeFileSync(join(root,'package.json'),JSON.stringify({version:'1.2.3'}))
  git('add','.');git('commit','-qm','fixture');git('tag','v1.2.3')
  const run=()=>spawnSync(process.execPath,[resolve('scripts/release.mjs'),'publish','--tag','v1.2.3','--dry-run'],{cwd:root,env,encoding:'utf8'})
  expect(run().stderr).toContain('annotated release tag')
  git('tag','-d','v1.2.3');git('tag','-a','v1.2.3','-m','fixture notes')
  writeFileSync(join(root,'package.json'),JSON.stringify({version:'9.9.9'}))
  expect(run().stderr).toContain('clean worktree')
  git('add','.');git('commit','-qm','different source')
  expect(run().stderr).toContain('Tag/source changed')
  git('tag','-d','v1.2.3');git('tag','-a','v1.2.3','-m','fixture notes')
  expect(run().stderr).toContain('Tag/package version mismatch')
})
