import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { resolve, relative } from 'node:path'
export const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex')
export const releaseJobs = ['verify', 'chaos', 'browser', 'python', 'artifacts', 'check']
export function validateManifest(manifest, root) {
  if (manifest.schema !== 1 || !/^[a-f0-9]{40}$/.test(manifest.sourceSha) || manifest.mode !== 'fixture providers; simulated settlement') throw Error('Invalid provenance')
  for (const kind of ['tgz', 'wheel', 'sdist', 'mcpb', 'mcp-tgz', 'metadata']) {
    const a = manifest.artifacts.find(a => a.kind === kind)
    if (!a || !a.version || !a.file || relative(root, resolve(root, a.file)).startsWith('..')) throw Error('Missing artifact: ' + kind)
    const file = resolve(root, a.file)
    if (statSync(file).size !== a.bytes || sha256(file) !== a.sha256) throw Error('Artifact hash changed: ' + kind)
  }
}
export function admitRelease(manifest, receipt, sha, jobs) {
  if (manifest.sourceSha !== sha || receipt.sourceSha !== sha || receipt.manifestSha256 !== sha256(receipt.manifestFile)) throw Error('Stale source or manifest')
  for (const name of releaseJobs) if (jobs[name] !== 'success') throw Error('Required job failed: ' + name)
  // `app` boots the web UI from the mcp-tgz bytes, so it must carry that artifact's hash.
  for (const kind of ['tgz', 'wheel', 'mcpb', 'mcp-tgz', 'app']) {
    const r = receipt.consumers.find(r => r.kind === kind)
    const a = manifest.artifacts.find(a => a.kind === (kind === 'app' ? 'mcp-tgz' : kind))
    if (!r || r.sha256 !== a.sha256 || r.citations < 1 || r.receipts !== 1 || r.intents !== 1 || !r.idempotent || !r.capPreserved) throw Error('Missing accepted consumer: ' + kind)
  }
}
