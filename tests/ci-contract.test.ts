import { describe, expect, it } from 'vitest'
// @ts-expect-error Node CLI helper has no TS declarations
import { admitted, requiredJobs, hostedFull } from '../scripts/ci-contract.mjs'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
describe('required CI admission', () => {
  const green = Object.fromEntries(requiredJobs.map((job: string) => [job, 'success']))
  it('admits all-success and intentional docs skips only', () => {
    expect(admitted({ result: 'success', full: 'true' }, green)).toBe(true)
    expect(admitted({ result: 'success', full: 'false' }, Object.fromEntries(requiredJobs.map((job: string) => [job, 'skipped'])))).toBe(true)
    for (const result of ['failure', 'cancelled', 'skipped']) expect(admitted({ result, full: 'false' }, green)).toBe(false)
    expect(admitted({ result: 'success' }, green)).toBe(false)
  })
  for (const job of requiredJobs) it.each(['failure', 'cancelled', 'skipped', undefined])(`blocks ${job} reporting %s`, result => {
    expect(admitted({ result: 'success', full: 'true' }, { ...green, [job]: result })).toBe(false)
  })
  it('wires the tested evaluator to an always-reporting aggregate and each required dependency', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
    expect(workflow).toContain('if: always()')
    expect(workflow).toContain('needs: [changes, verify, chaos, browser, python, artifacts]')
    expect(workflow).toContain('node scripts/ci-contract.mjs aggregate')
    expect(workflow).toContain('node scripts/ci-contract.mjs detect')
    expect(workflow).toContain('python -m pytest packages/sdk-python')
    expect(workflow).toContain('npx playwright test --output=test-results/app')
  })
})

// The in-process table above exhausts every job × failure state. Exercise each
// distinct CLI serialization/exit path once instead of spawning that matrix twice.
it.each([['verify','failure'], ['browser','cancelled'], ['python','skipped'], ['artifacts',undefined]] as const)('hosted aggregate rejects %s = %s', (failed, state) => {
  const needs: Record<string, { result: string | undefined; outputs?: { full: string } }> = Object.fromEntries(requiredJobs.map((job: string) => [job, { result: job === failed ? state : 'success' }]))
  needs.changes = { result: 'success', outputs: { full: 'true' } }
  const result = spawnSync(process.execPath, ['scripts/ci-contract.mjs', 'aggregate'], { env: { ...process.env, CI_NEEDS: JSON.stringify(needs) }, encoding: 'utf8' })
  expect(result.status).toBe(1)
  expect(result.stderr).toContain('Required verification did not complete successfully')
})

it.each(['true','false'])('hosted aggregate admits intended full=%s', full => {
  const needs: Record<string,{result:string;outputs?:{full:string}}> = Object.fromEntries(requiredJobs.map((job: string) => [job,{result:full==='true'?'success':'skipped'}]))
  needs.changes = {result:'success',outputs:{full}}
  expect(spawnSync(process.execPath,['scripts/ci-contract.mjs','aggregate'],{env:{...process.env,CI_NEEDS:JSON.stringify(needs)}}).status).toBe(0)
})

it.each(['none', 'app', 'demo', 'judge'])('browser group failure reaches aggregate: %s', failed => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
  const block = workflow.split('      - name: Independent browser groups (all required)')[1].split('      - uses:')[0].split('        run: |\n')[1].replace(/^ {10}/gm, '')
  const mock = `sha256sum() { return 0; }
npx() { case "$*" in *config.ts*) group=judge;; *demo.config.ts*) group=demo;; *) group=app;; esac; [ "$group" != "${failed}" ]; }
`
  // Put demo before the broader config suffix in the mock dispatch.
  const script = mock.replace('*config.ts*) group=judge;; *demo.config.ts*) group=demo;;', '*demo.config.ts*) group=demo;; *judge.config.ts*) group=judge;;') + block
  expect(spawnSync('bash', ['-e', '-c', script]).status).toBe(failed === 'none' ? 0 : 1)
  expect(workflow.match(/npm run build:demo/g)).toHaveLength(1)
})

// Hosted admission remains full for releases, nightly and explicit dispatch.
it('uses local admission on PRs and keeps full hosted release verification', () => {
  expect(hostedFull('pull_request')).toBe(false)
  for (const event of ['push','schedule','workflow_dispatch','workflow_call',undefined]) expect(hostedFull(event)).toBe(true)
  const workflow = readFileSync('.github/workflows/ci.yml','utf8')
  expect(workflow).not.toContain('branches: [main]')
  expect(workflow).toContain('schedule:')
  expect(workflow).toContain('cancel-in-progress: true')
  expect(workflow).toContain('npm run chaos -- --runs 200 --seed 279')
})
