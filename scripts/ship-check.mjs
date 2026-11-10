import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function shipPlan({ mode = 'change', base = 'origin/main', publish = false } = {}) {
  if (!['change', 'release', 'breaking'].includes(mode)) throw Error('SHIP_MODE must be change, release or breaking')
  if (!base || base.startsWith('-')) throw Error('SHIP_BASE requires a ref')
  const full = mode !== 'change'
  const gate = ['run', 'gate', '--', '--base', base, ...(full ? ['--full'] : [])]
  return [['npm', gate], ...(full ? [[process.execPath, ['scripts/final-acceptance.mjs', '--all-arch']]] : []), ...(publish ? [['npm', [...gate, '--publish']]] : [])]
}
export function sourceIdentity() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
  if (git('status', '--porcelain', '--untracked-files=all')) throw Error('Shipping requires a clean worktree')
  return { sha: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}') }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = {}, argv = process.argv.slice(2)
  while (argv.length) {
    const flag = argv.shift()
    if (flag === '--publish') options.publish = true
    else if (['--mode', '--base'].includes(flag) && argv[0] && !argv[0].startsWith('-')) options[flag.slice(2)] = argv.shift()
    else throw Error('Unknown or incomplete ship-check option: ' + flag)
  }
  const plan = shipPlan(options), initial = options.publish || (options.mode && options.mode !== 'change') ? sourceIdentity() : null
  for (const [cmd, args] of plan) {
    if (initial && JSON.stringify(sourceIdentity()) !== JSON.stringify(initial)) throw Error('Source changed during ship-check')
    execFileSync(cmd, args, { stdio: 'inherit' })
  }
  if (initial && JSON.stringify(sourceIdentity()) !== JSON.stringify(initial)) throw Error('Source changed during ship-check')
}
