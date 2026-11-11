// The hosted demo's budget kill switch (docker/hosted/budget-stop): only actual spend at or over the budget stops the VM.
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const { overBudget } = createRequire(import.meta.url)('../docker/hosted/budget-stop/decide.js') as { overBudget: (s: unknown) => boolean }

describe('budget kill switch', () => {
  it('stops only when actual spend reaches the budget', () => {
    expect(overBudget({ costAmount: 12.5, budgetAmount: 40 })).toBe(false)
    expect(overBudget({ costAmount: 40, budgetAmount: 40 })).toBe(true)
    expect(overBudget({ costAmount: 41.2, budgetAmount: 40 })).toBe(true)
  })
  it('never acts on malformed or empty status', () => {
    for (const s of [{}, null, { costAmount: 'x', budgetAmount: 40 }, { costAmount: 5, budgetAmount: 0 }, { costAmount: 50 }]) expect(overBudget(s)).toBe(false)
  })
  it('honours dry runs and only ever stops (never deletes) the one VM', () => {
    const src = readFileSync('docker/hosted/budget-stop/index.js', 'utf8')
    expect(src).toContain("message.attributes?.dryRun === 'true'")
    expect(src).toMatch(/\/stop`, \{ method: 'POST'/)
    expect(src).not.toMatch(/method: 'DELETE'/)
  })
})
