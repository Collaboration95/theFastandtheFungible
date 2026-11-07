import { mkdtempSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn, execFileSync } from 'node:child_process'

export function checkCreators() {
  const limits = JSON.parse(readFileSync(new URL('../docs/evidence/refactor-a/raw-creators.json', import.meta.url), 'utf8'))
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n')
  for (const file of files) {
    if (!/^(tests|scripts|desktop|shared|mcp)\/.*\.(ts|tsx|mjs|js)$/.test(file)) continue
    const count = (readFileSync(file, 'utf8').match(/\bmkdtemp(?:Sync)?\s*\(/g) ?? []).length
    if (count > (limits[file] ?? 0)) throw Error(`Unscoped temp creator in ${file}; use ResourceScope`)
  }
}
export function beginResources() {
  checkCreators()
  const root = mkdtempSync(join(tmpdir(), 'ra-test-invocation-'))
  const scratch = join(root, 'tmp'), registry = join(root, 'groups')
  mkdirSync(scratch, { mode: 0o700 }); mkdirSync(registry, { mode: 0o700 })
  // These two known compiler caches are invocation-owned scratch, not test leaks.
  const caches = [join(scratch, 'node-compile-cache'), join(scratch, `tsx-${process.getuid?.() ?? 0}`)]
  for (const cache of caches) mkdirSync(cache, { mode: 0o700 })
  const old = Object.fromEntries(['TMPDIR', 'TMP', 'TEMP', 'RA_RESOURCE_REGISTRY', 'RA_RESOURCE_INVOCATION'].map(k => [k, process.env[k]]))
  Object.assign(process.env, { TMPDIR: scratch, TMP: scratch, TEMP: scratch, RA_RESOURCE_REGISTRY: registry, RA_RESOURCE_INVOCATION: root })
  return async () => {
    try {
    for (const cache of caches) await rm(cache, { recursive: true, force: true })
    const dirs = readdirSync(scratch)
    const owned = readdirSync(registry).map(f => JSON.parse(readFileSync(join(registry, f), 'utf8')).group)
    const live = () => {
      const rows = execFileSync('ps', ['-axo', 'pgid=,stat='], { encoding: 'utf8' }).trim().split('\n').map(l => l.trim().split(/\s+/))
      return owned.filter(g => rows.some(([group, state]) => Number(group) === g && !state.startsWith('Z')))
    }
    const groups = live()
      // Report first, then emergency cleanup of exact registered groups only.
      if (dirs.length || groups.length) {
        for (const group of groups) { try { process.kill(-group, 'SIGKILL') } catch { /* checked below */ } }
        throw Error(`Resource leak: ${dirs.length} entries (${dirs.join(', ')}); ${groups.length} owned groups (${groups.join(', ')})`)
      }
      console.log('Resource check: 0 unexpected temp entries; 0 live owned groups')
    } finally {
      for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
      await rm(root, { recursive: true, force: true })
    }
  }
}
// Vitest global setup also covers direct `vitest run` and coverage invocations.
export default function setup() { if (!process.env.RA_RESOURCE_INVOCATION) return beginResources() }
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const finish = beginResources()
  let child
  const shutdown = signal => { if (child?.pid) { try { process.kill(-child.pid, signal) } catch { /* already exited */ } } }
  const interrupted = () => shutdown('SIGTERM')
  process.once('SIGTERM', interrupted); process.once('SIGINT', interrupted)
  let timer
  try {
    const [command = process.execPath, ...args] = process.argv.slice(2)
    child = spawn(command, args.length ? args : ['node_modules/vitest/vitest.mjs', 'run'], { stdio: 'inherit', env: process.env, detached: true })
    if (child.pid) {
      const { writeFileSync } = await import('node:fs')
      writeFileSync(join(process.env.RA_RESOURCE_REGISTRY, `${child.pid}.json`), JSON.stringify({ group: child.pid }))
    }
    const timeout = Number(process.env.RA_TEST_TIMEOUT_MS || 600000)
    timer = setTimeout(() => { process.exitCode = 1; shutdown('SIGKILL') }, timeout)
    const code = await new Promise((done, fail) => { child.once('error', fail); child.once('exit', done) })
    process.exitCode ||= code ?? 1
  } finally {
    clearTimeout(timer)
    process.off('SIGTERM', interrupted); process.off('SIGINT', interrupted)
    await finish()
  }
}
