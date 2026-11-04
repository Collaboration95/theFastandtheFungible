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
