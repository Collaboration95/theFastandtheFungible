import { appendFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const requiredJobs = ['verify', 'chaos', 'browser', 'python', 'artifacts']
export function admitted(changes, jobs) {
  return changes.result === 'success' && ['true', 'false'].includes(changes.full)
    && requiredJobs.every(job => jobs[job] === (changes.full === 'true' ? 'success' : 'skipped'))
}
export function hostedFull(event) { return event !== 'pull_request' }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'detect') appendFileSync(process.env.GITHUB_OUTPUT, 'full=' + hostedFull(process.env.GITHUB_EVENT_NAME) + '\n')
  else {
    const needs = JSON.parse(process.env.CI_NEEDS)
    if (!admitted({ result: needs.changes?.result, full: needs.changes?.outputs?.full },
      Object.fromEntries(requiredJobs.map(job => [job, needs[job]?.result])))) {
      console.error('Required verification did not complete successfully'); process.exitCode = 1
    }
  }
}
