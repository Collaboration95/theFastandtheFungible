import { expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'

const runbook = readFileSync('docs/judge-week-runbook.md', 'utf8')

it('keeps every runbook node command pointed at a repository script', () => {
  // Include the TypeScript commands using `node --import tsx scripts/…` too.
  const commands = [...runbook.matchAll(/\bnode(?:[ \t]+--import[ \t]+tsx)?[ \t]+(scripts\/[\w./-]+)/g)]
  expect(commands.length).toBeGreaterThan(0)
  for (const [command, script] of commands) {
    expect(statSync(script, { throwIfNoEntry: false })?.isFile(), command).toBe(true)
  }
})

it('keeps every runbook make command pointed at a declared Makefile target', () => {
  const commands = [...runbook.matchAll(/\bmake[ \t]+([\w-]+)/g)]
  const targets = new Set([...readFileSync('Makefile', 'utf8').matchAll(/^([\w-]+(?:[ \t]+[\w-]+)*)[ \t]*:(?!=)/gm)]
    .flatMap(([, names]) => names.split(/[ \t]+/)))
  expect(commands.length).toBeGreaterThan(0)
  for (const [command, target] of commands) expect(targets.has(target), command).toBe(true)
})
