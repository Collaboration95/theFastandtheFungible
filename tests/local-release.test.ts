import { it, expect } from 'vitest'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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

it('publisher keeps dry-run remote writes behind admission and exact-tag preflight', () => {
  const text=readFileSync('scripts/release-publish.mjs','utf8')
  expect(text).toContain("git('cat-file', '-t', tagObject) !== 'tag'")
  expect(text).toContain("git('rev-parse', `${tag}^{commit}`) !== initial.sha")
  expect(text).toContain("if (dryRun) console.log('DRY RUN: no tag push or release creation.")
  expect(text.indexOf("finalCheck(); git('push'")).toBeGreaterThan(text.indexOf('if (dryRun)'))
  expect(text).toContain("'--verify-tag'")
  expect(text).toContain("'--latest=".slice(1))
})
