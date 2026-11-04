import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
it('documents generated RC asset installs with an explicit registry status', () => {
  const readme = readFileSync('README.md', 'utf8')
  const snippets = execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', 'v1.0.0-rc.1'], { encoding: 'utf8' })
  for (const line of snippets.trim().split('\n')) expect(readme).toContain(line)
  expect(readme).toContain('Release candidate v1.0.0-rc.1')
  expect(readme).toContain('not yet on npm, PyPI or the MCP Registry')
})
it('keeps the pending Testnet MCP line generated and labelled as not yet released', () => {
  const readme = readFileSync('README.md', 'utf8')
  const tag = readme.match(/install-snippets\.mjs --tag (\S+) --testnet; pending release/)?.[1]
  expect(tag).toBeTruthy()
  const line = execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', tag!, '--testnet'], { encoding: 'utf8' }).trim()
  expect(line).toMatch(/^claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y \S+ --testnet$/)
  expect(readme).toContain(line)
  expect(readme).toMatch(/from the next release candidate \(not in rc\.1\)/)
})
it('keeps the pending zero-clone app line generated and labelled as not yet released', () => {
  const readme = readFileSync('README.md', 'utf8')
  const tag = readme.match(/install-snippets\.mjs --tag (\S+) --app; pending release/)?.[1]
  expect(tag).toBeTruthy()
  const line = execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', tag!, '--app'], { encoding: 'utf8' }).trim()
  expect(line).toMatch(/^npx -y \S+\.tgz app --testnet$/)
  expect(readme).toContain(line)
  expect(readme).toMatch(/also \*\*from the next release candidate, not in rc\.1\*\*/)
})
