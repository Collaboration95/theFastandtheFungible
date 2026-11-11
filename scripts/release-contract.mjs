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
  validateConsumers(manifest, receipt, sha)
}

// Local admission consumes actual local receipts, never synthetic GitHub job states.
export const localAcceptanceGates = ['soak', 'soak-evidence', 'render', 'artifacts', 'artifact-preservation', 'consumers', 'artifact-evidence', 'desktop-download-arm64', 'desktop-arm64', 'arm64-evidence', 'desktop-recovery', 'desktop-download-x64', 'desktop-x64', 'x64-evidence', 'browser', 'demo-build', 'browser-demo', 'browser-ledger', 'site-demo', 'site-ledger', 'hygiene', 'lint', 'typecheck', 'check-fast', 'python', 'ui-build', 'coverage', 'coverage-gate', 'chaos']
export const localGateSteps = ['hygiene','readme','lint','typecheck','gate-tests','app-build','unit','chaos','key-reveal','browser-app','browser-perf','browser-hosted','demo-build','browser-demo','browser-judge','browser-ledger','python','sdk-package','desktop-loader','desktop-build']
export function admitLocalRelease({ manifest, receipt, gate, acceptance, sha, tree, version, root, dmgRoot }) {
  validateManifest(manifest, root)
  if (gate.schema !== 'local-gate-v1' || gate.state !== 'success' || !gate.route?.all || gate.source?.dirty || gate.source?.head !== sha || gate.source?.tree !== tree || gate.finalSource?.head !== sha || gate.finalSource?.tree !== tree || gate.finalSource?.dirty) throw Error('Clean exact-source full local gate required')
  for (const id of localGateSteps) if (gate.steps.filter(row => row.id === id && row.state === 'success').length !== 1) throw Error('Missing local gate step: ' + id)
  if (!acceptance.pass || !acceptance.checksPass || !acceptance.acceptanceEligible || acceptance.quick || acceptance.worktreeDirty || !acceptance.sourceStable || acceptance.sourceSha !== sha || acceptance.sourceTree !== tree || JSON.stringify(acceptance.schedule?.localArchitectures) !== '["arm64","x64"]' || acceptance.schedule?.mode === 'bounded DAG including soak') throw Error('Clean exact-source full all-arch acceptance required')
  for (const name of localAcceptanceGates) if (acceptance.gates.filter(row => row.name === name && row.pass === true && row.status === 'PASS').length !== 1) throw Error('Missing acceptance gate: ' + name)
  // Validate consumers directly instead of supplying invented hosted job results.
  validateConsumers(manifest, receipt, sha)
  if (!receipt.verifiers?.typescript?.pass || !receipt.verifiers?.python?.pass || receipt.verifiers?.receiptSha256 !== sha256(resolve(root, 'accepted-receipt.json'))) throw Error('Missing accepted receipt verifiers')
  validateHostedExports(manifest, receipt)
  const acceptedReceipt = { ...receipt }; delete acceptedReceipt.manifestFile
  if (JSON.stringify(acceptance.artifacts) !== JSON.stringify(manifest.artifacts) || JSON.stringify(acceptance.consumers) !== JSON.stringify(acceptedReceipt)) throw Error('Acceptance artifacts or consumer receipt changed')
  for (const a of manifest.artifacts) if (a.version !== (['wheel','sdist'].includes(a.kind) ? version.replace(/-rc\.(\d+)$/, 'rc$1') : version)) throw Error('Artifact version mismatch: ' + a.kind)
  for (const arch of ['arm64','x64']) {
    const name = `ResearchAgent-${version}-${arch}.dmg`
    const rows = acceptance.dmgs.filter(row => row.file.endsWith('/' + name))
    const file = resolve(dmgRoot, name)
    if (rows.length !== 1 || rows[0].bytes !== statSync(file).size || rows[0].sha256 !== sha256(file)) throw Error('Accepted DMG changed: ' + arch)
  }
}
export function validateConsumers(manifest, receipt, sha) {
  if (manifest.sourceSha !== sha || receipt.sourceSha !== sha || receipt.manifestSha256 !== sha256(receipt.manifestFile)) throw Error('Stale source or manifest')
  for (const kind of ['tgz', 'wheel', 'mcpb', 'mcp-tgz', 'app']) {
    const r = receipt.consumers.find(r => r.kind === kind)
    const a = manifest.artifacts.find(a => a.kind === (kind === 'app' ? 'mcp-tgz' : kind))
    if (!r || r.sha256 !== a.sha256 || r.citations < 1 || r.receipts !== 1 || r.intents !== 1 || !r.idempotent || !r.capPreserved) throw Error('Missing accepted consumer: ' + kind)
  }
}
// H8-02: hosted-demo exports (fresh HOSTED=1 fixtures and the committed real Testnet export) verified by the packed
// wheel and the packed TS CLI, with anchor binding checked on every anchored export.
export const hostedExportKinds = ['fixture-purchase', 'fixture-anchored-decline', 'testnet-hosted']
export function validateHostedExports(manifest, receipt) {
  const hosted = receipt.verifiers?.hosted, hash = kind => manifest.artifacts.find(a => a.kind === kind)?.sha256
  if (!hosted || hosted.wheelSha256 !== hash('wheel') || hosted.typescriptSha256 !== hash('mcp-tgz')) throw Error('Hosted exports must be verified by the packed wheel and TS CLI')
  for (const kind of hostedExportKinds) {
    const rows = (hosted.exports ?? []).filter(r => r.kind === kind)
    if (rows.length !== 1 || !rows[0].python?.pass || !rows[0].typescript?.pass || !/^[a-f0-9]{64}$/.test(rows[0].sha256 ?? '')) throw Error('Hosted export not verified: ' + kind)
    if (kind !== 'fixture-purchase' && rows[0].anchorBinding !== 'PASS') throw Error('Hosted export anchor binding not checked: ' + kind)
  }
}
