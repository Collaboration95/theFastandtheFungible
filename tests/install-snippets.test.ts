import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
it('keeps unpublished release asset URLs out of README, including code blocks', () => {
  expect(readFileSync('README.md', 'utf8')).not.toMatch(/releases\/download\/[^\s)]+\.(?:tgz|whl|mcpb)/)
  const snippets = execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', 'v1.0.0'], {encoding:'utf8'})
  expect(snippets).toContain('researchagent-mcp-1.0.0.tgz')
  expect(snippets).toContain('researchagent-1.0.0-py3-none-any.whl')
})
