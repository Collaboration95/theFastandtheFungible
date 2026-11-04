import { it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
// @ts-expect-error CLI helper has no TS declarations
import { validateManifest, admitRelease, releaseJobs, sha256 } from '../scripts/release-contract.mjs'
it('blocks swapped bytes, omitted receipts, stale successful SHA and any failed required job', () => {
  const root = mkdtempSync(join(tmpdir(), 'release-contract-'))
  try {
    const kinds = ['tgz','wheel','sdist','mcpb','mcp-tgz','metadata']
    for (const kind of kinds) writeFileSync(join(root,kind),kind)
    const sha = 'a'.repeat(40)
    const manifest = {schema:1,sourceSha:sha,mode:'fixture providers; simulated settlement',artifacts:kinds.map(kind=>({kind,file:kind,version:'1.0.0',bytes:kind.length,sha256:sha256(join(root,kind))}))}
    const manifestFile = join(root,'manifest.json'); writeFileSync(manifestFile,JSON.stringify(manifest))
    const receipt = {sourceSha:sha,manifestFile,manifestSha256:sha256(manifestFile),consumers:['tgz','wheel','mcpb','mcp-tgz','app'].map(kind=>({kind,sha256:sha256(join(root,kind==='app'?'mcp-tgz':kind)),citations:1,receipts:1,intents:1,idempotent:true,capPreserved:true}))}
    const jobs = Object.fromEntries(releaseJobs.map((j: string)=>[j,'success']))
    expect(()=>validateManifest(manifest,root)).not.toThrow()
    expect(()=>admitRelease(manifest,receipt,sha,jobs)).not.toThrow()
    writeFileSync(join(root,'tgz'),'bad')
    expect(()=>validateManifest(manifest,root)).toThrow('hash changed')
    expect(()=>admitRelease(manifest,{...receipt,consumers:[]},sha,jobs)).toThrow('consumer')
    expect(()=>admitRelease(manifest,receipt,'b'.repeat(40),jobs)).toThrow('Stale')
    for (const job of releaseJobs) expect(()=>admitRelease(manifest,receipt,sha,{...jobs,[job]:'failure'})).toThrow('Required job')
    expect(()=>admitRelease(manifest,{...receipt,consumers:receipt.consumers.map(r=>({...r,receipts:0}))},sha,jobs)).toThrow('consumer')
  } finally { rmSync(root,{recursive:true,force:true}) }
})
