import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const requiredJobs = ['verify', 'chaos', 'browser', 'python']
export function fullCheck(paths, knownBase = true) {
  if (!knownBase) return true
  return paths.some(file => /^(src|server|shared|publisher|data|tests|scripts|eval|docker|packages|sdk|mcp|desktop)\//.test(file)
    || file.startsWith('.github/workflows/') || !/\.(md|png|jpg|jpeg|gif|webp|ico)$/.test(file))
}
export function admitted(changes, jobs) {
  return changes.result === 'success' && ['true', 'false'].includes(changes.full)
    && requiredJobs.every(job => jobs[job] === (changes.full === 'true' ? 'success' : 'skipped'))
}
export function detect(base) {
  try {
    if (!base || /^0+$/.test(base)) return true
    try { execFileSync('git', ['cat-file', '-e', base + '^{commit}'], { stdio: 'ignore' }) }
    catch { execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', base], { stdio: 'ignore' }) }
    return fullCheck(execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', base, 'HEAD']).toString().split('\0').filter(Boolean))
  } catch { return true }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'detect') appendFileSync(process.env.GITHUB_OUTPUT, 'full=' + detect(process.env.BASE_SHA) + '\n')
  else {
    const needs = JSON.parse(process.env.CI_NEEDS)
    if (!admitted({ result: needs.changes?.result, full: needs.changes?.outputs?.full },
      Object.fromEntries(requiredJobs.map(job => [job, needs[job]?.result])))) {
      console.error('Required verification did not complete successfully'); process.exitCode = 1
    }
  }
}
