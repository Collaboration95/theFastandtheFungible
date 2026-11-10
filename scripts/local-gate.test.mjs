import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync, symlinkSync, chmodSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { MAX_CPUS, parseArgs, classify, makeSteps, inputsFor, stepKey, scriptClosure, cacheEntry, changes, snapshot, sameSource,
  publishStatus, originRepo, runGraph, command, fixtureEnv, newScope, git, gh, SCHEMA, main, checkout } from './local-gate.mjs'
import { loaderPrefix, buildPrefix } from './local-gate-smoke.mjs'

async function fixture(run) {
  const scope = await newScope(), root = scope.tempDir('ra-local-gate-test-')
  const write = (file, value) => { mkdirSync(resolve(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), value) }
  const commit = () => { git(root, ['add', '--all']); git(root, ['-c', 'user.name=Gate Fixture', '-c', 'user.email=gate@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '--allow-empty', '-m', 'synthetic gate fixture']) }
  try { git(root, ['init', '--quiet']); write('README.md', '# Fixture\n'); write('.gitignore', '.env\nnode_modules/\n'); commit(); return await run({ scope, root, write, commit }) }
  finally { await scope.close(); assert.equal(existsSync(root), false) }
}

test('development-only captured checkout omits synthetic held-out content but retains existence metadata', async () => fixture(async ({ root, scope, write, commit }) => {
  const bank = 'eval/questions/judge-xrpl.v5.json'
  write(bank, 'synthetic fixture content, not a real bank'); commit()
  const old = process.env.RA_DEV_BANKS_ONLY
  try {
    process.env.RA_DEV_BANKS_ONLY = '1'
    const work = checkout(root, snapshot(root, scope), scope)
    assert.equal(existsSync(join(work, bank)), true)
    assert.equal(readFileSync(join(work, bank), 'utf8'), '')
  } finally { if (old === undefined) delete process.env.RA_DEV_BANKS_ONLY; else process.env.RA_DEV_BANKS_ONLY = old }
}))

test('strict options include cold verification, optional exact target, and plan cannot publish', () => {
  assert.deepEqual(parseArgs(['--base', 'HEAD^', '--full', '--no-cache', '--publish', 'a'.repeat(40)]), { base: 'HEAD^', full: true, plan: false, publish: true, noCache: true, target: 'a'.repeat(40) })
  for (const args of [['--base'], ['--base', '--full'], ['--bogus'], ['--plan', '--publish']]) assert.throws(() => parseArgs(args))
})

test('only allowlisted Markdown can select docs checks; README checks follow their inputs', () => {
  const plain = classify(['docs/contracts/new.md'])
  assert.equal(plain.mode, 'docs'); assert.deepEqual(makeSteps(plain).map(step => step.id), ['hygiene'])
  assert.deepEqual(makeSteps(classify(['README.md'])).map(step => step.id), ['hygiene', 'readme'])
  for (const paths of [['docs/hidden.ts'], ['docs/hidden.json'], ['new-code.ts'], ['Makefile'], ['AGENTS.md'], []]) {
    const route = classify(paths); assert.equal(route.all, true, paths.join(',')); assert.ok(makeSteps(route).some(step => step.id === 'browser-demo'))
  }
})

test('unknown base, every script, workflows, package and build/test configs select full', () => {
  assert.equal(classify(['README.md'], { knownBase: false }).all, true)
  assert.equal(classify(['docs/note.md'], { full: true }).all, true)
  for (const path of ['scripts/demo-defaults.mjs', 'scripts/release.mjs', 'scripts/local-gate.mjs', '.github/workflows/ci.yml', 'package.json', 'package-lock.json', 'tsconfig.json', 'playwright.config.ts', 'vitest.config.ts', 'vite.config.ts', 'eslint.config.js', '.nvmrc']) {
    assert.equal(classify([path]).all, true, path)
  }
})

test('every product path keeps the entire unit suite, chaos and key-reveal guarantees blocking', () => {
  for (const root of ['src', 'server', 'shared', 'publisher', 'sdk', 'mcp', 'data', 'eval', 'desktop', 'demo', 'packages', 'tests']) {
    const steps = makeSteps(classify([`${root}/example.ts`]))
    const unit = steps.find(step => step.id === 'unit')
    assert.ok(unit, root); assert.deepEqual(unit.args.slice(0, 2), ['node_modules/vitest/vitest.mjs', 'run'])
    for (const id of ['hygiene', 'lint', 'typecheck', 'chaos', 'key-reveal', 'gate-tests']) assert.ok(steps.some(step => step.id === id), `${root}: ${id}`)
  }
  const server = classify(['server/purchases.ts'])
  assert.equal(server.app, true); assert.equal(server.replay, false); assert.equal(server.python, true); assert.equal(server.desktop, true)
  const full = makeSteps(classify([], { full: true }))
  const outputs = full.filter(step => step.id.startsWith('browser-')).map(step => step.args.find(arg => arg.startsWith('--output=')))
  assert.equal(new Set(outputs).size, 6)
  assert.deepEqual(full.find(step => step.id === 'browser-hosted').deps, ['browser-perf'])
  assert.ok(full.find(step => step.id === 'browser-hosted').args.includes('playwright.hosted.config.ts'))
  const perf = full.find(step => step.id === 'browser-perf')
  assert.equal(perf.cpus, MAX_CPUS); assert.deepEqual(perf.deps, ['browser-app'])
  assert.ok(full.find(step => step.id === 'browser-app').args.includes('--grep-invert'))
  assert.deepEqual(full.find(step => step.id === 'desktop-build').deps, ['browser-app'])
})

test('actual rename retains old executable path, unstaged/untracked paths and unknown base', async () => fixture(async ({ root, write, commit }) => {
  write('server/old.ts', 'export const old = 1\n'); commit()
  const before = git(root, ['rev-parse', 'HEAD'])
  git(root, ['mv', 'server/old.ts', 'server/new.ts']); write('docs/new.md', '# Doc\n'); git(root, ['add', '--all']); commit()
  const renamed = changes(root, before)
  assert.ok(renamed.paths.includes('server/old.ts')); assert.ok(renamed.paths.includes('server/new.ts'))
  write('README.md', '# Dirty\n'); write('docs/new-helper.mjs', 'export {}\n')
  const state = changes(root, 'not-a-real-ref')
  assert.equal(state.dirty, true); assert.ok(state.baseError); assert.ok(state.paths.includes('docs/new-helper.mjs'))
  assert.equal(classify(state.paths, { knownBase: !state.baseError }).all, true)
  // Specifically prevent moving code into the Markdown allowlist.
  git(root, ['mv', 'server/new.ts', 'docs/moved.md'])
  const moved = changes(root, 'HEAD')
  assert.ok(moved.paths.includes('server/new.ts')); assert.ok(moved.paths.includes('docs/moved.md'))
  assert.notEqual(classify(moved.paths).mode, 'docs')
}))

test('actual tree capture includes staged/unstaged/untracked bytes, preserves real index, ignores .env', async () => fixture(async ({ scope, root, write }) => {
  const clean = snapshot(root, scope)
  assert.equal(clean.dirty, false); assert.equal(clean.tree, clean.headTree)
  write('.env', 'private ignored canary')
  assert.equal(snapshot(root, scope).tree, clean.tree)
  write('README.md', '# Staged\n'); git(root, ['add', 'README.md'])
  const indexBefore = readFileSync(join(root, '.git/index'))
  write('README.md', '# Worktree wins\n'); write('untracked.bin', Buffer.from([0xff, 0x00, 0xfe]))
  const dirty = snapshot(root, scope)
  assert.equal(dirty.dirty, true); assert.notEqual(dirty.tree, clean.tree)
  assert.equal(git(root, ['show', `${dirty.tree}:README.md`]), '# Worktree wins')
  assert.deepEqual(readFileSync(join(root, '.git/index')), indexBefore)
  assert.throws(() => sameSource(clean, dirty), /changed/)
  assert.throws(() => sameSource(dirty, dirty, true), /clean/)
  assert.throws(() => git(root, ['show', `${dirty.tree}:.env`]))
}))

const source = { head: 'a'.repeat(40), headTree: 'b'.repeat(40), tree: 'b'.repeat(40), dirty: false }
const mockGh = (calls, transform = value => value) => async args => {
  calls.push(args)
  return JSON.stringify(transform(args.includes('GET') ? { sha: source.head, commit: { tree: { sha: source.tree } } } : { state: args.find(arg => arg.startsWith('state=')).slice(6), context: 'local-gate' }))
}

test('Git and gh publication accept busy-main responses larger than the default exec buffer', async () => fixture(async ({ root, write, commit }) => {
  const large = 'x'.repeat(2 * 1024 * 1024)
  write('large.txt', large); commit()
  assert.equal(git(root, ['show', 'HEAD:large.txt']), large)
  write('bin/gh', `#!${process.execPath}
const args=process.argv.slice(2)
console.log(JSON.stringify(args.includes('GET')
 ? {sha:${JSON.stringify(source.head)},commit:{tree:{sha:${JSON.stringify(source.tree)}}},files:[{patch:'x'.repeat(2*1024*1024)}]}
 : {state:args.find(a=>a.startsWith('state=')).slice(6),context:'local-gate'}))
`)
  chmodSync(join(root, 'bin/gh'), 0o755)
  for (const state of ['pending', 'success', 'failure']) {
    const result = await publishStatus({ source, repo: 'owner/repo', state, current: async () => source,
      gh: args => gh(root, args, { PATH: join(root, 'bin') + ':' + process.env.PATH }), description: 'large fixture response' })
    assert.equal(result.state, state)
  }
}))

test('pending, success and failure use gh only on exact clean target; repository override is not inferred', async () => {
  for (const state of ['pending', 'failure', 'success']) {
    const calls = []
    const result = await publishStatus({ source, repo: 'owner/repo', state, current: async () => source, gh: mockGh(calls), description: 'fixture verification' })
    assert.equal(result.sha, source.head); assert.equal(result.state, state); assert.equal(calls.length, 2)
    assert.ok(calls[1].includes(`repos/owner/repo/statuses/${source.head}`)); assert.ok(calls[1].includes('context=local-gate'))
  }
  for (const url of ['https://github.com/owner/repo.git', 'git@github.com:owner/repo.git', 'ssh://git@github.com/owner/repo']) assert.equal(originRepo(url), 'owner/repo')
  for (const url of ['https://example.com/owner/repo', 'https://github.com/owner/repo/extra', 'https://user:secret@github.com/owner/repo']) assert.throws(() => originRepo(url))
})

test('publication rejects dirty, changed source/head, wrong SHA, wrong remote tree and all gh errors', async () => {
  for (const override of [{ source: { ...source, dirty: true } }, { target: 'c'.repeat(40) }, { current: async () => ({ ...source, tree: 'c'.repeat(40) }) }, { current: async () => ({ ...source, head: 'c'.repeat(40) }) }]) {
    const calls = []
    await assert.rejects(publishStatus({ source, repo: 'owner/repo', state: 'success', current: async () => source, gh: mockGh(calls), description: 'fixture', ...override }))
    assert.equal(calls.length, 0)
  }
  for (const phase of ['GET', 'POST']) {
    const calls = []
    await assert.rejects(publishStatus({ source, repo: 'owner/repo', state: 'success', current: async () => source,
      gh: async args => { if (args.includes(phase)) throw Error('injected gh outage'); return mockGh(calls)(args) }, description: 'fixture' }), /gh outage/)
  }
  for (const remote of [{ sha: 'c'.repeat(40), commit: { tree: { sha: source.tree } } }, { sha: source.head, commit: { tree: { sha: 'c'.repeat(40) } } }]) {
    const calls = []
    await assert.rejects(publishStatus({ source, repo: 'owner/repo', state: 'success', current: async () => source, gh: mockGh(calls, () => remote), description: 'fixture' }), /Remote target/)
    assert.equal(calls.length, 1)
  }
  let captures = 0
  const calls = []
  await assert.rejects(publishStatus({ source, repo: 'owner/repo', state: 'success', current: async () => ++captures === 1 ? source : { ...source, dirty: true }, gh: mockGh(calls), description: 'fixture' }))
  assert.equal(calls.length, 1) // No POST after a race during the remote lookup.
})

test('per-step hashes isolate helpers, follow references and cover binary bytes, modes, runtime and runner config', () => {
  const data = new Map(Object.entries({ 'package.json': '{"scripts":{}}', 'server/a.ts': 'export const a = 1', 'tests/a.test.ts': "import '../scripts/tested.mjs'", 'scripts/tested.mjs': 'export const a = 1', 'scripts/unrelated.mjs': 'export const a = 1', 'site/image.png': Buffer.from([0xff]) }))
  const files = [...data.keys()], read = file => Buffer.from(data.get(file))
  const unit = { id: 'unit', command: 'node', args: ['vitest'], cpus: 5, timeoutMs: 1000 }, browser = { ...unit, id: 'browser-app' }
  const key = (step, runtime = 'node22', runner = 'v1') => stepKey(step, files, read, runtime, runner).key
  const initial = key(unit), initialBrowser = key(browser)
  data.set('scripts/unrelated.mjs', 'export const a = 2')
  assert.equal(key(unit), initial); assert.equal(key(browser), initialBrowser)
  data.set('scripts/tested.mjs', 'export const a = 2')
  assert.notEqual(key(unit), initial); assert.equal(key(browser), initialBrowser)
  assert.ok(scriptClosure(files, read, ['tests/a.test.ts']).includes('scripts/tested.mjs'))
  assert.ok(inputsFor('unit', files, read).includes('scripts/tested.mjs'))
  const beforeBinary = key({ ...unit, id: 'hygiene' })
  data.set('site/image.png', Buffer.from([0xfe])) // Both would decode as the same replacement character.
  assert.notEqual(key({ ...unit, id: 'hygiene' }), beforeBinary)
  assert.notEqual(key(unit, 'node24'), key(unit)); assert.notEqual(key(unit, 'node22', 'v2'), key(unit))
  assert.notEqual(key({ ...unit, timeoutMs: 999 }), key(unit))
  const identity = new Map(files.map(file => [file, '100644:abc']))
  const beforeMode = stepKey(unit, files, read, 'node22', 'v1', false, identity).key
  identity.set('server/a.ts', '100755:abc')
  assert.notEqual(stepKey(unit, files, read, 'node22', 'v1', false, identity).key, beforeMode)
  const beforeCreators = key(unit)
  data.set('scripts/unrelated.mjs', 'export const a = fs.' + ['mkd', 'tempSync'].join('') + '("bad")')
  assert.notEqual(key(unit), beforeCreators)
})

test('cache accepts successes only, --no-cache forces a miss, and same-tree commit IDs do not enter step keys', async () => fixture(async ({ scope, root, write, commit }) => {
  const before = snapshot(root, scope), file = join(root, 'cached.json')
  const entry = { schema: SCHEMA, key: 'abc', state: 'success', durationMs: 12, source: before }
  writeFileSync(file, JSON.stringify(entry)); assert.equal(cacheEntry(file, 'abc').durationMs, 12)
  assert.equal(cacheEntry(file, 'abc', true), null); assert.equal(cacheEntry(file, 'different'), null)
  for (const state of ['pending', 'failure', 'skipped']) { writeFileSync(file, JSON.stringify({ ...entry, state })); assert.equal(cacheEntry(file, 'abc'), null) }
  writeFileSync(file, '{corrupt'); assert.equal(cacheEntry(file, 'abc'), null)
  // Commit identities differ while the captured source content stays identical.
  write('cached.json', 'stable'); commit(); const first = snapshot(root, scope)
  commit(); const second = snapshot(root, scope)
  assert.notEqual(first.head, second.head); assert.equal(first.tree, second.tree)
}))

test('bounded graph retains failures, blocks dependents, continues independent checks, rejects cycles', async () => {
  const steps = [{ id: 'a', cpus: 6, deps: [] }, { id: 'b', cpus: 5, deps: [] }, { id: 'c', cpus: 4, deps: [] }, { id: 'blocked', cpus: 1, deps: ['b'] }]
  let used = 0, maximum = 0
  const results = await runGraph(steps, async step => {
    used += step.cpus; maximum = Math.max(maximum, used)
    await new Promise(done => setTimeout(done, 5)); used -= step.cpus
    if (step.id === 'b') throw Error('injected failed guarantee')
    return { id: step.id, state: 'success' }
  })
  assert.equal(maximum, 10); assert.equal(results[1].state, 'failure'); assert.equal(results[3].state, 'skipped'); assert.equal(results[2].state, 'success')
  await assert.rejects(runGraph([{ id: 'x', cpus: 1, deps: ['x'] }], async () => ({})), /cycle/)
  await assert.rejects(runGraph([{ id: 'x', cpus: 11, deps: [] }], async () => ({})), /Invalid/)
})

test('command timeout and spawn failure clean owned groups and scratch; credentials are not inherited', async () => {
  const scope = await newScope(), scratch = scope.tempDir('ra-local-gate-timeout-')
  try {
    const env = fixtureEnv(scratch)
    assert.equal(env.DOTENV_CONFIG_PATH, '/dev/null'); assert.equal(env.NODE_OPTIONS, undefined); assert.equal(env.GH_TOKEN, undefined)
    const result = await command(scope, process.execPath, ['-e', 'setInterval(()=>{},1000)'], { env, timeoutMs: 40 })
    assert.equal(result.timedOut, true); assert.notEqual(result.code, 0); assert.ok(result.durationMs < 5500)
    await assert.rejects(command(scope, '/nonexistent/local-gate-command', [], { env, timeoutMs: 100 }))
  } finally { await scope.close() }
  assert.equal(existsSync(scratch), false)
})

test('real plain-node loader bootstrap passes; injected #395 registration fails before side effects', async () => {
  const scope = await newScope(), root = scope.tempDir('ra-local-gate-loader-test-')
  try {
    mkdirSync(join(root, 'desktop')); symlinkSync(resolve('shared'), join(root, 'shared'), 'dir'); symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir')
    const current = readFileSync('desktop/smoke.mjs', 'utf8')
    assert.ok(!loaderPrefix(current).includes('electron.launch'))
    const path = join(root, 'desktop/probe.mjs')
    writeFileSync(path, loaderPrefix(current))
    const good = await command(scope, process.execPath, [path], { env: fixtureEnv(root), timeoutMs: 10000 })
    assert.equal(good.code, 0, good.tail)
    const broken = "import { register } from 'node:module'\n" + ['register(', JSON.stringify('tsx/esm'), ', import.meta.url)\n'].join('') + "const { ResourceScope } = await import('../shared/resource-scope.ts')\nthrow Error('native side effect reached')"
    writeFileSync(path, loaderPrefix(broken))
    const bad = await command(scope, process.execPath, [path], { env: fixtureEnv(root), timeoutMs: 10000 })
    assert.notEqual(bad.code, 0); assert.match(bad.tail, /must be loaded with --import/); assert.doesNotMatch(bad.tail, /native side effect reached/)
    assert.throws(() => loaderPrefix('unrecognized bootstrap'), /review/)
    assert.throws(() => buildPrefix('unrecognized build'), /review/)
    const prefix = buildPrefix(readFileSync('desktop/build.mjs', 'utf8'))
    assert.ok(prefix.includes("'shared'")); assert.ok(!prefix.includes("'ci', '--omit=dev'"))
    chmodSync(path, 0o700)
  } finally { await scope.close() }
})

test('complete synthetic docs run records actual source, reuses successes, bypasses cache cold and rejects concurrent source edits', async () => fixture(async ({ root, write, commit }) => {
  write('package.json', JSON.stringify({ type: 'module', scripts: { hygiene: 'node check.mjs', 'readme:check': 'node check.mjs' } }))
  write('check.mjs', "import{existsSync}from'node:fs';if(existsSync('.env'))throw Error('ignored env leaked');if(process.env.LLM_PROVIDER!=='fixture')throw Error('fixture required');\n")
  write('node_modules/.package-lock.json', '{}'); commit(); write('README.md', '# Changed docs\n')
  const prior = process.cwd()
  process.chdir(root)
  try {
    assert.equal(await main(['--base', 'HEAD']), 0)
    let receipt = JSON.parse(readFileSync(join(root, '.git/local-gate/latest.json')))
    assert.equal(receipt.state, 'success'); assert.equal(receipt.source.dirty, true)
    assert.notEqual(receipt.source.tree, receipt.source.headTree)
    assert.equal(receipt.steps.length, 2); assert.ok(receipt.steps.every(step => step.state === 'success' && !step.cacheHit))
    assert.equal(await main(['--base', 'HEAD']), 0)
    receipt = JSON.parse(readFileSync(join(root, '.git/local-gate/latest.json')))
    assert.ok(receipt.steps.every(step => step.cacheHit))
    assert.equal(await main(['--base', 'HEAD', '--no-cache']), 0)
    receipt = JSON.parse(readFileSync(join(root, '.git/local-gate/latest.json')))
    assert.ok(receipt.steps.every(step => !step.cacheHit))
    // The child mutates only this test's owned source fixture, never the checkout.
    write('check.mjs', `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(join(root, 'README.md'))},'# Concurrent source edit\\n');`)
    commit(); write('README.md', '# Planned docs\n')
    assert.equal(await main(['--base', 'HEAD']), 1)
    receipt = JSON.parse(readFileSync(join(root, '.git/local-gate/latest.json')))
    assert.equal(receipt.state, 'failure'); assert.match(receipt.error, /Source HEAD\/tree/)
  } finally { process.chdir(prior) }
}))

test('entry HTML and packed SDK paths route to consumers; unit proof has built UI and trace inputs', () => {
  const entry=classify(['index.html']); assert.equal(entry.app,true);assert.equal(entry.desktop,true)
  assert.equal(classify(['packages/sdk/package.json']).python,true)
  const steps=makeSteps(classify(['server/store.ts']));assert.ok(steps.find(step=>step.id==='unit').deps.includes('app-build'))
  assert.ok(inputsFor('unit',['demo/traces/UC3.json'],()=>Buffer.from('{}')).includes('demo/traces/UC3.json'))
})

test('development-only bank access is explicit in the fixture environment and cache identity', () => {
  const old = process.env.RA_DEV_BANKS_ONLY
  try {
    process.env.RA_DEV_BANKS_ONLY = '1'
    assert.equal(fixtureEnv('/tmp/synthetic-k4').RA_DEV_BANKS_ONLY, '1')
    const bank = 'eval/questions/judge-xrpl.v5.json'
    const identities = new Map([[bank, '100644:synthetic-bank-identity']])
    const neverRead = () => { throw Error('Bank content must not be read') }
    assert.deepEqual(scriptClosure([bank], neverRead, [bank]), [bank])
    assert.deepEqual(stepKey({ id: 'unit' }, [bank], neverRead, {}, 'runner', false, identities).inputs, [bank])
    const step = { id: 'unit', command: 'node', args: [] }
    const files = ['vitest.config.ts']
    const read = () => 'synthetic config'
    assert.notEqual(stepKey(step, files, read, { bankAccess: 'development-only; held-out schema tests excluded' }, 'runner').key,
      stepKey(step, files, read, { bankAccess: 'all-schema-checks' }, 'runner').key)
    delete process.env.RA_DEV_BANKS_ONLY
    assert.equal(fixtureEnv('/tmp/synthetic-k4').RA_DEV_BANKS_ONLY, undefined)
  } finally { if (old === undefined) delete process.env.RA_DEV_BANKS_ONLY; else process.env.RA_DEV_BANKS_ONLY = old }
})
