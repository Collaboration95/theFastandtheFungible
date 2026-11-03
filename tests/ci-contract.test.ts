import { describe, expect, it } from 'vitest'
// @ts-expect-error Node CLI helper has no TS declarations
import { admitted, fullCheck, requiredJobs } from '../scripts/ci-contract.mjs'
import { readFileSync } from 'node:fs'
describe('required CI admission', () => {
  it.each(['shared/contracts/run.ts', 'packages/sdk-python/README.md', 'server/moved.md', '.github/workflows/ci.yml'])('runs every gate for %s', path => expect(fullCheck([path])).toBe(true))
  it('skips docs only but fails open to full verification on unknown history and code renames', () => {
    expect(fullCheck(['docs/running.md', 'docs/picture.png'])).toBe(false)
    expect(fullCheck(['docs/running.md'], false)).toBe(true)
    expect(fullCheck(['server/old.ts', 'docs/old.md'])).toBe(true)
  })
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
    expect(workflow).toContain('needs: [changes, verify, chaos, browser, python]')
    expect(workflow).toContain('node scripts/ci-contract.mjs aggregate')
    expect(workflow).toContain('node scripts/ci-contract.mjs detect')
    expect(workflow).toContain('python -m pytest packages/sdk-python')
    expect(workflow).toContain('npx playwright test tests/e2e.spec.ts tests/a11y.spec.ts')
  })
})
