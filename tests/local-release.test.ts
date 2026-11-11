import { it, expect } from 'vitest'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resources } from './helpers/resource-scope'
// @ts-expect-error local CLI helper
import { shipPlan } from '../scripts/ship-check.mjs'
// @ts-expect-error local CLI helper
import { admitLocalRelease, localAcceptanceGates, localGateSteps, sha256 } from '../scripts/release-contract.mjs'
// @ts-expect-error local CLI helper
import { classify, makeSteps } from '../scripts/local-gate.mjs'

it('release admission requires every step in the full local gate, including hosted UI', () => {
  expect([...localGateSteps].sort()).toEqual(makeSteps(classify([], {full:true})).map((row: {id:string})=>row.id).sort())
})

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
  const hosted = {wheelSha256:sha256(join(root,'wheel')),typescriptSha256:sha256(join(root,'mcp-tgz')),exports:['fixture-purchase','fixture-anchored-decline','testnet-hosted','fixture-unsigned-free'].map(kind => ({kind,sha256:'c'.repeat(64),anchorBinding:['fixture-purchase','fixture-unsigned-free'].includes(kind)?'absent':'PASS',python:{pass:true},typescript:{pass:true}}))}
  const receipt = { verifiers:{typescript:{pass:true},python:{pass:true},hosted,receiptSha256:sha256(join(root,'accepted-receipt.json'))},sourceSha:sha,manifestSha256:sha256(manifestFile),consumers:['tgz','wheel','mcpb','mcp-tgz','app'].map(kind => ({kind,sha256:sha256(join(root,kind==='app'?'mcp-tgz':kind)),citations:1,receipts:1,intents:1,idempotent:true,capPreserved:true})) }
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
  // H8-02: hosted-demo exports must verify with the packed wheel and TS CLI, anchor binding included.
  const withHosted = (h: object) => ({...args,receipt:{...args.receipt,verifiers:{...receipt.verifiers,hosted:{...hosted,...h}}}})
  expect(() => admitLocalRelease({...args,receipt:{...args.receipt,verifiers:{...receipt.verifiers,hosted:undefined}}})).toThrow('packed wheel and TS CLI')
  expect(() => admitLocalRelease(withHosted({wheelSha256:'d'.repeat(64)}))).toThrow('packed wheel and TS CLI')
  for (const kind of ['fixture-purchase','fixture-anchored-decline','testnet-hosted','fixture-unsigned-free']) {
    expect(() => admitLocalRelease(withHosted({exports:hosted.exports.filter(r => r.kind !== kind)}))).toThrow('Hosted export not verified: '+kind)
    expect(() => admitLocalRelease(withHosted({exports:hosted.exports.map(r => r.kind === kind ? {...r,python:{pass:false}} : r)}))).toThrow('Hosted export not verified: '+kind)
  }
  expect(() => admitLocalRelease(withHosted({exports:hosted.exports.map(r => r.kind === 'testnet-hosted' ? {...r,anchorBinding:'absent'} : r)}))).toThrow('anchor binding')
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

it('publication CLI refuses a failed acceptance child before pushing a tag or creating a release', () => {
  // Isolated local Git remote and mocked CLI responses; no GitHub access.
  const root=resources().tempDir('publisher-refusal-'), bin=join(root,'bin')
  mkdirSync(bin);mkdirSync(join(root,'scripts'))
  const env: NodeJS.ProcessEnv={...process.env,PATH:bin+':'+process.env.PATH}
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key]
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,env,encoding:'utf8',stdio:'pipe'}).trim()
  git('init','-q','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid')
  writeFileSync(join(root,'package.json'),JSON.stringify({version:'1.2.3'}))
  writeFileSync(join(root,'.gitignore'),'remote.git/\n')
  writeFileSync(join(bin,'npm'),`#!${process.execPath}
console.log('local-gate: success; receipt '+process.cwd()+'/.git/fixture-gate.json')
`,{mode:0o755})
  writeFileSync(join(bin,'gh'),`#!${process.execPath}
const fs=require('node:fs')
if(process.argv[2]==='api' && process.argv[3].endsWith('/status')) {
 fs.writeFileSync('.git/status-queried','fixture')
 console.log(JSON.stringify({statuses:[{context:'local-gate',state:'success'}]}))
} else {
 fs.writeFileSync('.git/forbidden-gh-call',process.argv.slice(2).join(' '))
 process.exit(99)
}
`,{mode:0o755})
  writeFileSync(join(root,'scripts/final-acceptance.mjs'),"import {writeFileSync} from 'node:fs';writeFileSync('.git/acceptance-ran','fixture rejection');process.exit(9)\n")
  git('add','.');git('commit','-qm','isolated refusal fixture');git('tag','-a','v1.2.3','-m','fixture notes')
  git('init','--bare','-q',join(root,'remote.git'));git('remote','add','origin',join(root,'remote.git'));git('push','-q','origin','main')
  const result=spawnSync(process.execPath,[resolve('scripts/release.mjs'),'publish','--tag','v1.2.3'],{cwd:root,env,encoding:'utf8'})
  expect(result.status).not.toBe(0)
  expect(result.stderr).toContain('Command failed:')
  expect(existsSync(join(root,'.git/status-queried'))).toBe(true)
  expect(existsSync(join(root,'.git/acceptance-ran'))).toBe(true)
  expect(existsSync(join(root,'.git/forbidden-gh-call'))).toBe(false)
  expect(existsSync(join(root,'dist/local-release/assets'))).toBe(false)
  expect(git('ls-remote','--tags','origin','refs/tags/v1.2.3')).toBe('')
  expect(git('status','--porcelain')).toBe('')
})

it('dry-run stages the admitted bytes and annotation without a tag push or release creation', () => {
  // Fixture packages/DMGs exercise the orchestration, not real build acceptance.
  const root=resources().tempDir('publisher-dryrun-'), bin=join(root,'bin')
  mkdirSync(bin);mkdirSync(join(root,'scripts'))
  const env: NodeJS.ProcessEnv={...process.env,PATH:bin+':'+process.env.PATH}
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key]
  const git=(...args:string[])=>execFileSync('git',args,{cwd:root,env,encoding:'utf8',stdio:'pipe'}).trim()
  git('init','-q','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid')
  writeFileSync(join(root,'package.json'),JSON.stringify({version:'1.2.3-rc.2'}))
  writeFileSync(join(root,'.gitignore'),'remote.git/\ndist/\ndesktop/\n')
  const contract=JSON.stringify(pathToFileURL(resolve('scripts/release-contract.mjs')).href)
  writeFileSync(join(bin,'npm'),`#!${process.execPath}
const {execFileSync}=require('node:child_process'),fs=require('node:fs')
const git=(ref)=>execFileSync('git',['rev-parse',ref],{encoding:'utf8'}).trim()
const source={head:git('HEAD'),tree:git('HEAD^{tree}'),dirty:false}
fs.writeFileSync('.git/gate.json',JSON.stringify({schema:'local-gate-v1',state:'success',route:{all:true},source,finalSource:source,steps:${JSON.stringify(localGateSteps.map((id:string)=>({id,state:'success'})))}}))
console.log('local-gate: success; receipt '+process.cwd()+'/.git/gate.json')
`,{mode:0o755})
  writeFileSync(join(bin,'gh'),`#!${process.execPath}
require('node:fs').writeFileSync('.git/forbidden-gh-call','unexpected');process.exit(99)
`,{mode:0o755})
  writeFileSync(join(root,'scripts/final-acceptance.mjs'),`
import {mkdirSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {resolve,join} from 'node:path'
import {sha256,localAcceptanceGates} from ${contract}
const git=(ref)=>execFileSync('git',['rev-parse',ref],{encoding:'utf8'}).trim()
const sha=git('HEAD'),version='1.2.3-rc.2',root=resolve('dist/release')
mkdirSync(root,{recursive:true});mkdirSync('dist/final',{recursive:true});mkdirSync('desktop/out',{recursive:true})
const artifacts=['tgz','wheel','sdist','mcpb','mcp-tgz','metadata'].map(kind=>{
 writeFileSync(join(root,kind),kind)
 return {kind,file:kind,version:['wheel','sdist'].includes(kind)?'1.2.3rc2':version,bytes:kind.length,sha256:sha256(join(root,kind))}
})
writeFileSync(join(root,'manifest.json'),JSON.stringify({schema:1,sourceSha:sha,mode:'fixture providers; simulated settlement',artifacts}))
writeFileSync(join(root,'accepted-receipt.json'),'fixture')
const consumers={sourceSha:sha,manifestSha256:sha256(join(root,'manifest.json')),verifiers:{typescript:{pass:true},python:{pass:true},hosted:{wheelSha256:artifacts.find(a=>a.kind==='wheel').sha256,typescriptSha256:artifacts.find(a=>a.kind==='mcp-tgz').sha256,exports:['fixture-purchase','fixture-anchored-decline','testnet-hosted','fixture-unsigned-free'].map(kind=>({kind,sha256:'c'.repeat(64),anchorBinding:['fixture-purchase','fixture-unsigned-free'].includes(kind)?'absent':'PASS',python:{pass:true},typescript:{pass:true}}))},receiptSha256:sha256(join(root,'accepted-receipt.json'))},consumers:['tgz','wheel','mcpb','mcp-tgz','app'].map(kind=>({kind,sha256:artifacts.find(a=>a.kind===(kind==='app'?'mcp-tgz':kind)).sha256,citations:1,receipts:1,intents:1,idempotent:true,capPreserved:true}))}
writeFileSync(join(root,'consumer-results.json'),JSON.stringify(consumers))
const dmgs=['arm64','x64'].map(arch=>{const file=resolve('desktop/out','ResearchAgent-'+version+'-'+arch+'.dmg');writeFileSync(file,arch);return {file,bytes:arch.length,sha256:sha256(file)}})
writeFileSync('dist/final/acceptance.json',JSON.stringify({pass:true,checksPass:true,acceptanceEligible:true,quick:false,worktreeDirty:false,sourceStable:true,sourceSha:sha,sourceTree:git('HEAD^{tree}'),schedule:{mode:'isolated soak then DAG',localArchitectures:['arm64','x64']},gates:localAcceptanceGates.map(name=>({name,pass:true,status:'PASS'})),artifacts,consumers,dmgs}))
`)
  // The real desktop staging helper runs; only package/test producers are fixtures.
  writeFileSync(join(root,'scripts/desktop-release-assets.mjs'),`import ${JSON.stringify(pathToFileURL(resolve('scripts/desktop-release-assets.mjs')).href)}\n`)
  git('add','.');git('commit','-qm','isolated dry-run fixture');git('tag','-a','v1.2.3-rc.2','-m','Fixture annotation\n\nPreserve these notes.')
  git('init','--bare','-q',join(root,'remote.git'));git('remote','add','origin',join(root,'remote.git'));git('push','-q','origin','main')
  const result=spawnSync(process.execPath,[resolve('scripts/release.mjs'),'publish','--tag','v1.2.3-rc.2','--dry-run'],{cwd:root,env,encoding:'utf8'})
  expect(result.status,result.stderr).toBe(0)
  const assets=join(root,'dist/local-release/assets')
  const report=JSON.parse(readFileSync(join(assets,'release-publication.json'),'utf8'))
  expect(report).toMatchObject({tag:'v1.2.3-rc.2',dryRun:true,mainAncestor:true,prerelease:true,latest:false,sha:git('rev-parse','HEAD')})
  expect(readFileSync(join(root,'dist/local-release/notes.md'),'utf8')).toContain('Fixture annotation\n\nPreserve these notes.')
  for (const row of report.assets) expect(sha256(join(assets,row.file))).toBe(row.sha256)
  for (const arch of ['arm64','x64']) expect(sha256(join(assets,'ResearchAgent-unsigned-'+arch+'.dmg'))).toBe(sha256(join(assets,'ResearchAgent-1.2.3-rc.2-'+arch+'.dmg')))
  expect(existsSync(join(root,'.git/forbidden-gh-call'))).toBe(false)
  expect(git('ls-remote','--tags','origin','refs/tags/v1.2.3-rc.2')).toBe('')
  expect(git('status','--porcelain')).toBe('')
})
