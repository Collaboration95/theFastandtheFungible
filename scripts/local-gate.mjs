// Offline local verification. GitHub access, when explicitly requested, is gh only.
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync, symlinkSync, realpathSync } from 'node:fs'
import { availableParallelism, release } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { heldOutBankPath } from './local-gate-banks.mjs'

export const SCHEMA = 'local-gate-v1'
export const MAX_CPUS = 10
const hash = value => createHash('sha256').update(value).digest('hex')
const json = value => JSON.stringify(value)
const split = value => value.split('\0').filter(Boolean)
const docs = file => /^(?:README|CHANGELOG)\.md$|^\.github\/(?:CONTRIBUTING|SECURITY|CODE_OF_CONDUCT)\.md$/.test(file) || /^docs\/.*\.md$/.test(file)
const product = /^(?:src|server|shared|publisher|sdk|mcp|data|eval|desktop|demo|packages|tests)\//
const browserScripts = /^scripts\/(?:demo(?:-ports)?\.mjs|prepare-e2e-store\.mjs)$/
const toolConfig = /^(?:package(?:-lock)?\.json|tsconfig[^/]*\.json|(?:vite|vitest|playwright|eslint)[^/]*\.[cm]?[jt]s|tests\/playwright\/|demo\/vite\.config\.ts|\.nvmrc|\.gitignore|\.github\/(?!(?:CONTRIBUTING|SECURITY|CODE_OF_CONDUCT)\.md$)|\.husky\/)/

export function parseArgs(argv) {
  const options = { base: 'origin/main', full: false, plan: false, publish: false, noCache: false }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--base') {
      if (!argv[i + 1] || argv[i + 1].startsWith('-')) throw Error('--base requires a ref')
      options.base = argv[++i]
    } else if (flag === '--publish') {
      options.publish = true
      if (argv[i + 1] && !argv[i + 1].startsWith('-')) options.target = argv[++i]
    } else if (flag === '--full') options.full = true
    else if (flag === '--plan') options.plan = true
    else if (flag === '--no-cache') options.noCache = true
    else throw Error(`Unknown option ${flag}`)
  }
  if (options.plan && options.publish) throw Error('--plan cannot publish a result')
  return options
}

const maxBuffer = 64 * 1024 * 1024
export function gh(root, args, env = {}) {
  return execFileSync('gh', args, { cwd: root, encoding: 'utf8', maxBuffer, timeout: 30000,
    stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GH_PROMPT_DISABLED: '1', ...env } })
}
export function git(root, args, env = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', ...env }, stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
}

export function changes(root, base) {
  const head = git(root, ['rev-parse', 'HEAD'])
  const headTree = git(root, ['rev-parse', 'HEAD^{tree}'])
  const status = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  const paths = new Set([...split(git(root, ['diff', '--no-renames', '--name-only', '-z', 'HEAD', '--'])),
    ...split(git(root, ['ls-files', '--others', '--exclude-standard', '-z']))])
  let baseCommit, mergeBase, baseError
  try {
    baseCommit = git(root, ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`])
    mergeBase = git(root, ['merge-base', head, baseCommit])
    // Both sides of a rename are retained: executable code cannot hide as docs.
    for (const file of split(git(root, ['diff', '--no-renames', '--name-only', '-z', mergeBase, head, '--']))) paths.add(file)
  } catch { baseError = 'Base absent or unrelated; no fetch attempted' }
  return { head, headTree, dirty: Boolean(status), paths: [...paths].sort(), base, baseCommit, mergeBase, baseError }
}

export function classify(paths, { knownBase = true, full = false } = {}) {
  const unknown = paths.filter(file => !docs(file) && !product.test(file) && !/^scripts\/[^\0]+\.(?:mjs|[jt]s|py)$/.test(file) && !toolConfig.test(file) && !/^(?:index\.html|site\/|design\/)/.test(file))
  const all = full || !knownBase || !paths.length || unknown.length > 0 || paths.some(file => toolConfig.test(file) || file.startsWith('scripts/'))
  const code = all || paths.some(file => !docs(file))
  return {
    mode: code ? (all ? 'full' : 'code') : 'docs', all, unknown,
    reason: full ? 'Explicit --full' : !knownBase ? 'Unknown base' : !paths.length ? 'Empty diff requires full verification (including a merged SHA)' : unknown.length ? 'Unknown paths' : all ? 'Build, dependency or gate configuration changed' : code ? 'Known code paths' : 'Documentation only',
    // Every code plan retains the complete unit suite and seeded chaos invariants.
    app: all || paths.some(file => file === 'index.html' || /^(?:src|server|shared|publisher|data|sdk|mcp|eval|site)\//.test(file) || browserScripts.test(file) || /^tests\/(?!browser-demo|judge-path|ledger-viewer).*\.spec\.ts$/.test(file)),
    replay: all || paths.some(file => /^(?:src|shared|demo|site|design)\//.test(file) || /^tests\/(?:browser-demo|judge-path|ledger-viewer|ledger-sockets)/.test(file)),
    python: all || paths.some(file => /^(?:packages\/sdk(?:-python)?|server|shared|publisher|sdk|mcp|data|eval\/decisions|tests\/fixtures)\//.test(file)),
    desktop: all || paths.some(file => file === 'index.html' || /^(?:desktop|src|server|shared|publisher|sdk|mcp|data|eval\/decisions)\//.test(file) || /^scripts\/(?:record|mcp-demo)\.mjs$/.test(file)),
    readme: code || paths.some(file => ['README.md', 'docs/contracts/ARCHITECTURE.md', 'docs/numbers.md', 'docs/install.md'].includes(file) || file.startsWith('docs/media/')),
  }
}

export function makeSteps(route, cpuBudget = MAX_CPUS) {
  const steps = []
  const add = (id, command, args, cpus = 1, deps = [], timeoutMs = 600000) => steps.push({ id, command, args, cpus: Math.min(cpus, cpuBudget), deps, timeoutMs })
  const npm = (id, script, cpus = 1, deps = []) => add(id, 'npm', ['run', script], cpus, deps)
  npm('hygiene', 'hygiene')
  if (route.readme) npm('readme', 'readme:check')
  if (route.mode === 'docs') return steps
  npm('lint', 'lint')
  npm('typecheck', 'typecheck')
  add('gate-tests', process.execPath, ['--import', 'tsx', '--test', 'scripts/local-gate.test.mjs'])
  npm('app-build', 'build', 2)
  add('unit', process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--maxWorkers', String(Math.max(1, Math.min(4, cpuBudget - 1)))], Math.min(5, cpuBudget), ['app-build'])
  add('chaos', process.execPath, ['scripts/chaos.mjs', '--runs', '20', '--seed', '279', '--output', 'scratch/local-gate-chaos.json'], 2)
  add('key-reveal', process.execPath, ['--import', 'tsx', 'scripts/chaos/key-reveal.ts'], 2)
  if (route.app) {
    add('browser-app', process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--grep-invert', '@perf', '--workers=1', '--reporter=line', '--output=scratch/local-gate-results/app'], 2, ['unit'], 900000)
    // Timing budgets (CLS, input → paint) need an idle host: claim every CPU slot so nothing runs beside it.
    add('browser-perf', process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--grep', '@perf', '--workers=1', '--reporter=line', '--output=scratch/local-gate-results/perf'], cpuBudget, ['browser-app'], 600000)
    // The hosted judge UI (HOSTED=1) rebuilds dist/, so it waits until the other app suites stop serving it.
    add('browser-hosted', process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/playwright/hosted.config.ts', '--workers=1', '--reporter=line', '--output=scratch/local-gate-results/hosted'], 2, ['browser-perf'], 600000)
  }
  if (route.replay) {
    npm('demo-build', 'build:demo', 2, ['lint'])
    add('browser-demo', process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/playwright/demo.config.ts', '--workers=2', '--reporter=line', '--output=scratch/local-gate-results/demo'], 3, ['demo-build'], 900000)
    add('browser-judge', process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/playwright/judge.config.ts', '--workers=1', '--reporter=line', '--output=scratch/local-gate-results/judge'], 2, ['demo-build'], 900000)
    add('browser-ledger', process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/playwright/ledger.config.ts', '--workers=1', '--reporter=line', '--output=scratch/local-gate-results/ledger'], 2, [], 900000)
  }
  if (route.python) {
    add('python', 'python3', ['-m', 'pytest', 'packages/sdk-python', '-p', 'no:cacheprovider'], 2)
    npm('sdk-package', 'test:sdk:package', 2, ['unit'])
  }
  if (route.desktop) {
    add('desktop-loader', process.execPath, ['scripts/local-gate-smoke.mjs', 'loader'])
    add('desktop-build', process.execPath, ['scripts/local-gate-smoke.mjs', 'build'], 2, route.app ? ['browser-hosted'] : ['unit'], 600000)
  }
  return steps
}

// Integration tests can read fixtures and launch helpers. Keep broad data/source
// roots, and close over literal helper references (including .js -> .ts sources).
// New/unknown path families use the entire tree instead of this optimisation.
export function scriptClosure(files, read, seeds) {
  const scripts = files.filter(file => file.startsWith('scripts/'))
  const included = new Set(seeds), queue = [...seeds]
  while (queue.length) {
    const file = queue.pop()
    if (heldOutContent(file)) continue
    if (!/\.(?:[cm]?[jt]sx?|json|py|ya?ml)$/.test(file) || file === 'package.json' || file === 'package-lock.json') continue
    const content = read(file).toString()
    for (const script of scripts) {
      const name = basename(script), js = name.replace(/\.ts$/, '.js')
      if (!included.has(script) && (content.includes(script) || content.includes(name) || content.includes(js))) {
        included.add(script); queue.push(script)
      }
    }
    // Match literal npm script invocations such as the MCP package test's prepack.
    for (const match of content.matchAll(/['"](?:run|prepack)['"]\s*,\s*['"]([^'"]+)['"]/g)) {
      const pkg = JSON.parse(read('package.json'))
      for (const script of scripts) if ((pkg.scripts?.[match[1]] ?? '').includes(script) && !included.has(script)) { included.add(script); queue.push(script) }
    }
  }
  return [...included].sort()
}

// Only a bank that has not been measured yet is held-out; v1–v5 are used development data (scripts/local-gate-banks.mjs).
const heldOutContent = file => process.env.RA_DEV_BANKS_ONLY === '1' && heldOutBankPath(file)

export function inputsFor(id, files, read, unknown = false) {
  if (unknown || id === 'hygiene') return files
  const common = file => /^(?:package(?:-lock)?\.json|\.nvmrc|tsconfig[^/]*\.json|\.gitignore)$/.test(file)
  let match
  if (id === 'readme') match = file => /^(?:README\.md|docs\/(?:numbers|install)\.md|scripts\/readme-|scripts\/install-snippets\.mjs|docs\/media\/(?:architecture|key-reveal)\.svg|eval\/scorecard\/latest\.json)/.test(file)
  else if (id === 'gate-tests') match = file => /^scripts\/local-gate|^shared\/resource-scope\.ts$/.test(file)
  else if (id === 'lint') match = file => /\.(?:[cm]?[jt]sx?)$/.test(file) || /^eslint/.test(file)
  else if (id === 'typecheck') match = file => /^(?:src|server|shared|publisher|sdk|mcp|examples|tests|eval|demo)\//.test(file) || /^(?:scripts\/.*\.ts|(?:vite|playwright|vitest).*\.ts)$/.test(file)
  else if (id === 'app-build') match = file => /^(?:src|server|shared|publisher|sdk|mcp|examples|tests|eval|demo|data|design)\//.test(file) || /^(?:index\.html|vite\.config|scripts\/bundle-budget\.)/.test(file)
  else if (id === 'unit') match = file => /^(?:src|server|shared|publisher|sdk|mcp|tests|eval|desktop|packages|data|demo|docs|site|design|examples|\.github|\.devcontainer)\//.test(file) || /^vitest\.config/.test(file)
  else if (['chaos', 'key-reveal'].includes(id)) match = file => /^(?:server|shared|publisher|sdk|mcp|data|eval\/decisions|tests\/fixtures|scripts\/chaos(?:\/|\.mjs))/.test(file)
  else if (id === 'python') match = file => /^(?:packages\/sdk(?:-python)?|server|shared|publisher|sdk|mcp|data|eval\/decisions|tests\/fixtures)\//.test(file)
  else if (id === 'sdk-package') match = file => /^(?:sdk|shared|packages\/sdk)\/|^scripts\/(?:build-sdk|check-sdk-package)\.mjs$|^docs\/sdk\.md$|^LICENSE$/.test(file)
  else if (id === 'desktop-loader') match = file => /^desktop\/(?:smoke|recovery-smoke|accept)\.mjs$|^scripts\/(?:record|mcp-demo|local-gate-smoke)\.mjs$|^shared\/resource-scope\.ts$/.test(file)
  else if (id === 'desktop-build') match = file => /^(?:src|server|shared|publisher|sdk|mcp|data|eval\/decisions|desktop)\/|^index\.html$|^vite\.config|^scripts\/local-gate-smoke/.test(file)
  // The app browser suite also renders site pages for the one-product guard.
  else if (id === 'browser-app' || id === 'browser-perf') match = file => id === 'browser-app' && file.startsWith('site/') || /^(?:src|server|shared|publisher|sdk|mcp|data|eval\/decisions|tests\/fixtures|design\/cast)\/|^index\.html$|^vite\.config|^playwright\.config|^tests\/.*\.spec\.ts$|^scripts\/(?:demo(?:-ports)?|prepare-e2e-store)\.mjs$/.test(file)
  else if (id === 'browser-hosted') match = file => /^(?:src|server|shared|publisher|sdk|data|public|tests\/fixtures|tests\/helpers)\/|^index\.html$|^vite\.config|^tests\/playwright\/(?:paths|hosted)\.|^tests\/(?:hosted-ui\.spec|proof-of-refusal\.spec|evidence-path)\.ts$|^scripts\/demo-ports\.mjs$/.test(file)
  else match = file => /^(?:src|shared|demo|site|design|docs\/evidence)\/|^demo\/vite\.config|^tests\/playwright\/(?:paths|demo|judge|ledger)\.|^tests\/(?:browser-demo|judge-path|ledger-viewer|ledger-sockets)/.test(file)
  const selected = files.filter(file => common(file) || match(file))
  return scriptClosure(files, read, selected)
}

export function stepKey(step, files, read, runtime, runnerHash, unknown = false, identities) {
  const inputs = inputsFor(step.id, files, read, unknown)
  const rows = inputs.map(file => [file, identities?.get(file) ?? hash(read(file))])
  // The resource global setup checks creator counts across *all* helpers.
  // Changes to unused helper bodies need not rerun unit tests; added creators do.
  const creators = step.id === 'unit' ? files.filter(file => /^(?:scripts|tests|desktop|shared|mcp)\/.*\.(?:ts|tsx|mjs|js)$/.test(file))
    .map(file => [file, (read(file).toString().match(/\bmkdtemp(?:Sync)?\s*\(/g) ?? []).length]) : []
  const inputHash = hash(json({ rows, creators }))
  return { key: hash(json({ schema: SCHEMA, step, inputHash, runtime, runnerHash })), inputHash, inputs }
}

export function cacheEntry(path, key, noCache = false) {
  if (noCache) return null
  try { const value = JSON.parse(readFileSync(path, 'utf8')); return value.schema === SCHEMA && value.key === key && value.state === 'success' && Number.isFinite(value.durationMs) && value.source?.tree ? value : null }
  catch { return null }
}

export async function runGraph(steps, run, budget = MAX_CPUS) {
  if (!Number.isInteger(budget) || budget < 1 || budget > MAX_CPUS) throw Error('Invalid CPU budget')
  if (new Set(steps.map(step => step.id)).size !== steps.length || steps.some(step => !Number.isInteger(step.cpus) || step.cpus < 1 || step.cpus > budget || step.deps.some(dep => !steps.some(value => value.id === dep)))) throw Error('Invalid step graph')
  const pending = [...steps], results = new Map(), active = new Map()
  let used = 0
  while (pending.length || active.size) {
    for (let i = 0; i < pending.length;) {
      const step = pending[i]
      if (step.deps.some(dep => results.has(dep) && results.get(dep).state !== 'success')) {
        results.set(step.id, { id: step.id, state: 'skipped', durationMs: 0, cacheHit: false, error: 'Required predecessor failed' }); pending.splice(i, 1); continue
      }
      if (step.deps.every(dep => results.has(dep)) && used + step.cpus <= budget) {
        pending.splice(i, 1); used += step.cpus
        const promise = Promise.resolve().then(() => run(step)).catch(error => ({ id: step.id, state: 'failure', error: String(error), durationMs: 0, cacheHit: false }))
          .then(result => { results.set(step.id, result); used -= step.cpus; active.delete(step.id) })
        active.set(step.id, promise)
      } else i++
    }
    if (active.size) await Promise.race(active.values())
    else if (pending.length) throw Error('Step graph has a cycle')
  }
  return steps.map(step => results.get(step.id))
}

export function sameSource(before, after, clean = false) {
  if (before.head !== after.head || before.headTree !== after.headTree || before.tree !== after.tree || before.dirty !== after.dirty || before.repository !== after.repository) throw Error('Source HEAD/tree or repository changed during verification')
  if (clean && (before.dirty || after.dirty || before.tree !== before.headTree)) throw Error('Publishing requires a clean worktree matching HEAD')
}

export function originRepo(url) {
  const match = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/.exec(url)
  if (!match) throw Error('Publishing requires an unambiguous github.com origin')
  return match[1]
}

export async function publishStatus({ source, target = source.head, repo, state, current, gh, description }) {
  if (!['pending', 'failure', 'success'].includes(state)) throw Error('Invalid status state')
  if (target !== source.head || !/^[a-f0-9]{40,64}$/.test(target)) throw Error('Publish target must be the exact captured HEAD SHA')
  sameSource(source, await current(), true)
  const commit = JSON.parse(await gh(['api', '--hostname', 'github.com', '--method', 'GET', `repos/${repo}/commits/${target}`]))
  if (commit.sha !== target || commit.commit?.tree?.sha !== source.tree) throw Error('Remote target HEAD/tree does not match verified source')
  sameSource(source, await current(), true)
  const result = JSON.parse(await gh(['api', '--hostname', 'github.com', '--method', 'POST', `repos/${repo}/statuses/${target}`, '-f', `state=${state}`, '-f', 'context=local-gate', '-f', `description=${description.slice(0, 140)}`]))
  if (result.state !== state || result.context !== 'local-gate') throw Error('gh did not confirm the requested local-gate status')
  return { state, context: 'local-gate', sha: target, repo, at: new Date().toISOString() }
}

export async function newScope() {
  const { register } = await import('tsx/esm/api')
  register()
  const { ResourceScope } = await import('../shared/resource-scope.ts')
  return new ResourceScope()
}

export function snapshot(root, scope) {
  const files = split(git(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']))
  if (files.some(file => /(?:^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example'))) throw Error('Refusing a source tree containing a private environment file')
  const before = changes(root, 'HEAD')
  const index = join(scope.tempDir('ra-local-gate-index-'), 'index')
  const env = { GIT_INDEX_FILE: index }
  git(root, ['read-tree', 'HEAD'], env)
  git(root, ['add', '--all', '--', '.'], env)
  const tree = git(root, ['write-tree'], env)
  const after = changes(root, 'HEAD')
  if (before.head !== after.head || before.headTree !== after.headTree || before.dirty !== after.dirty) throw Error('Source changed while capturing tree')
  return { head: before.head, headTree: before.headTree, tree, dirty: before.dirty }
}

export function fixtureEnv(scratch, cpus = MAX_CPUS) {
  const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'SYSTEMROOT'].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]))
  return { ...env, ...(process.env.RA_DEV_BANKS_ONLY === '1' ? { RA_DEV_BANKS_ONLY: '1' } : {}), TMPDIR: scratch, TMP: scratch, TEMP: scratch, DOTENV_CONFIG_PATH: '/dev/null', LANGFUSE_ENABLED: '0',
    LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SETTLEMENT_RAIL: 'simulated', SEARCH_EMBEDDINGS: 'off',
    ELECTRON_SKIP_BINARY_DOWNLOAD: '1', npm_config_offline: 'true', npm_config_audit: 'false', npm_config_fund: 'false',
    PYTHONDONTWRITEBYTECODE: '1', PYTEST_DISABLE_PLUGIN_AUTOLOAD: '1', RA_TEST_WORKERS: String(Math.max(1, Math.min(4, cpus - 1))),
    UV_THREADPOOL_SIZE: '1', OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1' }
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temp = `${path}.${randomUUID()}.tmp`
  writeFileSync(temp, json(value) + '\n', { mode: 0o600 }); renameSync(temp, path)
}

export async function command(scope, command, args, { cwd, env, timeoutMs = 600000, log } = {}) {
  const start = performance.now(), child = scope.spawn(command, args, { cwd, env })
  let tail = '', timer, timedOut = false
  const capture = chunk => { tail = (tail + chunk).slice(-8000); if (log) log(chunk) }
  child.stdout.on('data', capture); child.stderr.on('data', capture)
  try {
    return await new Promise((done, fail) => {
      child.once('error', fail)
      child.once('close', (code, signal) => done({ code, signal, tail, timedOut, durationMs: Math.round(performance.now() - start) }))
      timer = setTimeout(async () => {
        timedOut = true
        try { const { stopProcess } = await import('../shared/resource-scope.ts'); await stopProcess(child) }
        catch (error) { fail(error) }
      }, timeoutMs)
    })
  } finally { clearTimeout(timer) }
}

function runtimeInfo(root, steps) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const versions = Object.fromEntries(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).sort().map(name => {
    const path = join(root, 'node_modules', name, 'package.json')
    if (!existsSync(path)) throw Error(`Missing installed dependency ${name}; run npm ci first`)
    return [name, JSON.parse(readFileSync(path, 'utf8')).version]
  }))
  const info = { bankAccess: process.env.RA_DEV_BANKS_ONLY === '1' ? 'development-only; held-out questions/results omitted; schema tests excluded; published fact aggregates only' : 'all-schema-checks', node: process.version, execPath: process.execPath, platform: process.platform, arch: process.arch, os: release(), versions,
    installedLock: hash(readFileSync(join(root, 'node_modules/.package-lock.json'))),
    npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(), git: git(root, ['--version']) }
  if (steps.some(step => step.id === 'python' || step.id.startsWith('browser-'))) info.python = execFileSync('python3', ['-c',
    'import sys,json,importlib.metadata as m; print(json.dumps({"version":sys.version,"packages":sorted((d.metadata["Name"],d.version) for d in m.distributions())}))'], { encoding: 'utf8' }).trim()
  return info
}

export function checkout(root, source, scope) {
  const path = join(scope.tempDir('ra-local-gate-checkout-'), 'tree')
  git(root, ['clone', '--quiet', '--shared', '--no-checkout', '--', root, path])
  git(path, ['update-ref', '--no-deref', 'HEAD', source.head])
  git(path, ['read-tree', source.tree])
  if (process.env.RA_DEV_BANKS_ONLY === '1') {
    const files = split(git(path, ['ls-files', '-z']))
    const paths = files.filter(file => !heldOutContent(file))
    execFileSync('git', ['checkout-index', '--force', '--stdin', '-z'], { cwd: path, input: paths.join('\0') + '\0' })
    // Preserve existence metadata for progress checks, without materialising questions.
    for (const file of files.filter(heldOutContent)) {
      mkdirSync(dirname(join(path, file)), { recursive: true })
      writeFileSync(join(path, file), '')
    }
  } else git(path, ['checkout-index', '--all', '--force'])
  symlinkSync(resolve(root, 'node_modules'), join(path, 'node_modules'), 'dir')
  return path
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv), root = git(process.cwd(), ['rev-parse', '--show-toplevel'])
  const sourceChanges = changes(root, options.base)
  const route = classify(sourceChanges.paths, { knownBase: !sourceChanges.baseError, full: options.full })
  const cpus = Math.max(1, Math.min(MAX_CPUS, availableParallelism())), steps = makeSteps(route, cpus)
  if (options.plan) { console.log(JSON.stringify({ schema: SCHEMA, source: sourceChanges, route, cpuBudget: cpus, noCache: options.noCache, steps }, null, 2)); return 0 }
  const scope = await newScope(), start = performance.now()
  const store = resolve(root, git(root, ['rev-parse', '--git-common-dir']), 'local-gate')
  const receiptPath = join(store, 'runs', `${Date.now()}-${process.pid}-${randomUUID()}.json`)
  const receipt = { schema: SCHEMA, state: 'failure', startedAt: new Date().toISOString(), source: null, route, changes: sourceChanges, cpuBudget: cpus, noCache: options.noCache, steps: [], statuses: [], label: 'Offline local fixtures and simulated settlement; not release, Testnet or native DMG acceptance' }
  let repo, work, runtime, runnerHash, keys, interrupted = false
  const capture = owner => {
    const value = snapshot(root, owner)
    if (options.publish) value.repository = originRepo(git(root, ['remote', 'get-url', 'origin']))
    return value
  }
  const interrupt = () => { interrupted = true; void scope.close() }
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt)
  try {
    receipt.source = capture(scope)
    const capturedChanges = changes(root, options.base)
    if (json(capturedChanges) !== json(sourceChanges)) throw Error('Changed paths or HEAD changed while planning')
    const current = async () => capture(scope)
    const github = args => gh(root, args)
    const publish = async state => {
      const result = await publishStatus({ source: receipt.source, target: options.target, repo, state, current, gh: github,
        description: state === 'pending' ? 'Local verification in progress' : state === 'success' ? `Verified tree ${receipt.source.tree.slice(0, 12)}; ${receipt.steps.filter(step => step.cacheHit).length}/${steps.length} cached` : 'Local verification failed; inspect local gate receipt' })
      receipt.statuses.push(result)
    }
    if (options.publish) {
      repo = receipt.source.repository
      await publish('pending')
    }
    // Even a fully cached run requires the installed tools/dependencies to match.
    runtime = runtimeInfo(root, steps); receipt.runtime = runtime
    const entries = split(git(root, ['ls-tree', '-r', '-z', receipt.source.tree])).map(row => {
      const tab = row.indexOf('\t'), [mode, type, oid] = row.slice(0, tab).split(' ')
      if (type !== 'blob') throw Error('Submodules require explicit verification; refusing cached local admission')
      return [row.slice(tab + 1), `${mode}:${oid}`]
    })
    const identities = new Map(entries), files = entries.map(([file]) => file)
    // One owned checkout avoids spawning git once per input, and contains no ignored .env.
    work = checkout(root, receipt.source, scope)
    const hasSymlinks = entries.some(([file, identity]) => {
      if (!identity.startsWith('120000:')) return false
      const target = realpathSync(join(work, file))
      if (!target.startsWith(work + '/')) throw Error('Source symlink escapes the captured checkout')
      return true
    })
    const blobs = new Map()
    const read = file => {
      if (heldOutContent(file)) throw Error('Held-out content is forbidden in a development-only gate')
      if (!blobs.has(file)) blobs.set(file, readFileSync(join(work, file)))
      return blobs.get(file)
    }
    runnerHash = hash(json(files.filter(file => /^scripts\/local-gate/.test(file)).map(file => [file, identities.get(file)])))
    keys = new Map(steps.map(step => [step.id, stepKey(step, files, read, runtime, runnerHash, route.unknown.length > 0 || Boolean(sourceChanges.baseError) || hasSymlinks, identities)]))
    receipt.steps = await runGraph(steps, async step => {
      if (interrupted) throw Error('Gate interrupted')
      const { key, inputHash, inputs } = keys.get(step.id), cachePath = join(store, 'cache', `${key}.json`)
      // A cached build has no output in this new checkout. Materialize it when
      // a browser consumer must actually execute; cached consumers need no files.
      const unitNeedsBuild = step.id === 'app-build' && !cacheEntry(join(store, 'cache', `${keys.get('unit').key}.json`), keys.get('unit').key, options.noCache)
      const materialize = unitNeedsBuild || step.id === 'demo-build' && ['browser-demo', 'browser-judge'].some(id => keys.has(id)
        && !cacheEntry(join(store, 'cache', `${keys.get(id).key}.json`), keys.get(id).key, options.noCache))
      const cached = !materialize && cacheEntry(cachePath, key, options.noCache)
      if (cached) {
        console.log(`local-gate: ${step.id} cache hit (${cached.durationMs} ms originally)`)
        return { ...step, state: 'success', cacheHit: true, durationMs: 0, cachedDurationMs: cached.durationMs, cachedSource: cached.source, key, inputHash, inputCount: inputs.length }
      }
      work ??= checkout(root, receipt.source, scope)
      const scratch = scope.tempDir(`ra-local-gate-${step.id}-`), env = fixtureEnv(scratch, cpus)
      if (step.id === 'unit') env.RA_TEST_WORKERS = String(Math.max(1, step.cpus - 1))
      const logPath = join(store, 'logs', `${basename(receiptPath, '.json')}-${step.id}.log`)
      mkdirSync(dirname(logPath), { recursive: true })
      // No inherited credentials enter children; their complete fixture output is retained.
      const chunks = []
      console.log(`local-gate: ${step.id} starting (${step.cpus} CPU slots)`)
      const result = await command(scope, step.command, step.args, { cwd: work, env, timeoutMs: step.timeoutMs, log: chunk => chunks.push(chunk) })
      writeFileSync(logPath, Buffer.concat(chunks), { mode: 0o600 })
      const state = result.code === 0 && !result.signal && !result.timedOut ? 'success' : 'failure'
      console.log(`local-gate: ${step.id} ${state} ${result.durationMs} ms`)
      return { ...step, ...result, state, cacheHit: false, key, inputHash, inputCount: inputs.length, logPath }
    }, cpus)
    receipt.finalSource = await current(); sameSource(receipt.source, receipt.finalSource)
    await scope.close() // Cleanup failures must block cache admission and publication.
    for (const step of receipt.steps.filter(step => step.state === 'success' && !step.cacheHit)) atomicJson(join(store, 'cache', `${step.key}.json`), { schema: SCHEMA, state: 'success', key: step.key, inputHash: step.inputHash, durationMs: step.durationMs, source: receipt.source, completedAt: new Date().toISOString() })
    if (interrupted || receipt.steps.some(step => step.state !== 'success')) throw Error(interrupted ? 'Gate interrupted' : 'Required local checks failed')
    if (options.publish) {
      // A fresh scope is needed for the last capture after resources were closed.
      const finalScope = await newScope()
      try {
        const result = await publishStatus({ source: receipt.source, target: options.target, repo, state: 'success', current: async () => capture(finalScope), gh: github,
          description: `Verified tree ${receipt.source.tree.slice(0, 12)}; ${receipt.steps.filter(step => step.cacheHit).length}/${steps.length} cached` })
        receipt.statuses.push(result)
      } finally { await finalScope.close() }
    }
    receipt.state = 'success'
  } catch (error) {
    receipt.error = String(error)
    if (options.publish && repo && receipt.source) {
      const failureScope = await newScope()
      try {
        const result = await publishStatus({ source: receipt.source, target: options.target, repo, state: 'failure', current: async () => capture(failureScope),
          gh: args => gh(root, args), description: 'Local verification failed; inspect local gate receipt' })
        receipt.statuses.push(result)
      } catch (failure) { receipt.publishError = String(failure) }
      finally { await failureScope.close() }
    }
  } finally {
    try { await scope.close() } catch (error) { receipt.state = 'failure'; receipt.cleanupError = String(error) }
    process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt)
    receipt.durationMs = Math.round(performance.now() - start); receipt.completedAt = new Date().toISOString()
    atomicJson(receiptPath, receipt); atomicJson(join(store, 'latest.json'), receipt)
    console.log(`local-gate: ${receipt.state}; receipt ${receiptPath}`)
    if (receipt.error) console.error(receipt.error)
  }
  return receipt.state === 'success' ? 0 : 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code }).catch(error => { console.error(String(error)); process.exitCode = 1 })
}
