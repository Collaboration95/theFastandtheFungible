import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, lstatSync, readlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'

export const reusableGates = [
  'artifacts', 'artifact-preservation', 'consumers', 'artifact-evidence',
  'desktop-download-arm64', 'desktop-arm64', 'arm64-evidence', 'desktop-recovery',
  'browser', 'demo-build', 'browser-demo', 'browser-ledger', 'hygiene', 'lint',
  'typecheck', 'check-fast', 'python', 'ui-build', 'coverage', 'coverage-gate', 'chaos',
]
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
export function fingerprint(path) {
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) return digest('link\0' + readlinkSync(path))
  if (stat.isDirectory()) return digest(JSON.stringify(readdirSync(path).sort().map(name => [name, fingerprint(join(path, name))])))
  if (!stat.isFile()) throw Error('Unsupported acceptance output: ' + path)
  return digest(Buffer.concat([Buffer.from(String(stat.mode & 0o777) + '\0'), readFileSync(path)]))
}
export function outputProof(paths) {
  return [...new Set(paths)].map(path => ({ path, fingerprint: fingerprint(path) }))
}
/** Reuse only complete non-timing evidence on this clean tree and runtime.
 * The soak and live site probes are always fresh. No failed row is reusable. */
export function admitReuse(file, current, hash = fingerprint) {
  const prior = JSON.parse(readFileSync(file, 'utf8'))
  for (const key of ['sourceSha', 'sourceTree', 'runnerSha256', 'supportSha256', 'dependencySha256']) {
    if (!current[key] || prior[key] !== current[key]) throw Error('Reuse mismatch: ' + key)
  }
  for (const key of ['hostname', 'platform', 'release', 'arch', 'cpus', 'node', 'python']) {
    if (prior.host?.[key] !== current.host?.[key]) throw Error('Reuse host mismatch: ' + key)
  }
  if (current.worktreeDirty || prior.worktreeDirty || !prior.sourceStable || prior.quick) throw Error('Reuse requires stable clean full-workload evidence')
  const age = Date.now() - Date.parse(prior.finishedAt)
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) throw Error('Reuse evidence must be less than 24 hours old')
  if (JSON.stringify(prior.schedule?.localArchitectures) !== JSON.stringify(current.schedule?.localArchitectures)) throw Error('Reuse architecture mismatch')
  const names = [...reusableGates, ...(current.schedule.localArchitectures.includes('x64') ? ['desktop-download-x64', 'desktop-x64', 'x64-evidence'] : [])]
  const rows = names.map(name => {
    const matching = prior.gates.filter(row => row.name === name)
    if (matching.length !== 1 || matching[0].pass !== true || matching[0].status !== 'PASS') throw Error('Reuse requires passed gate: ' + name)
    const row = matching[0]
    if (row.logSha256 && digest(readFileSync(join(dirname(file), name + '.log'))) !== row.logSha256) throw Error('Reuse log changed: ' + name)
    return row
  })
  if (!prior.reuseOutputs?.length) throw Error('Reuse output proof missing')
  for (const output of prior.reuseOutputs) if (hash(output.path) !== output.fingerprint) throw Error('Reuse output changed: ' + output.path)
  return { prior, rows, receiptSha256: digest(readFileSync(file)) }
}
