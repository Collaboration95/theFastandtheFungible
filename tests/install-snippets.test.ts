import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
it('documents generated v1.0.0 asset installs and registry status across guides', () => {
  const generate = (...flags: string[]) => execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', 'v1.0.0', ...flags], { encoding: 'utf8' }).trim()
  const lines = generate().split('\n')
  const readme = readFileSync('README.md', 'utf8')
  for (const line of [...lines, generate('--testnet'), generate('--app')]) expect(readme).toContain(line)
  expect(readme).toContain('release · not yet on npm/PyPI/MCP Registry')
  expect(readme).not.toContain('from the next release candidate')
  const demo = readFileSync('demo/index.html', 'utf8')
  for (const line of [generate('--app'), generate('--testnet'), lines[1]]) expect(demo).toContain(line)
  expect(demo.indexOf(generate('--app'))).toBeLessThan(demo.indexOf(generate('--testnet')))
  expect(demo).not.toContain('v1.0.0-rc.1')
  expect(lines[1]).toContain('researchagent-1.0.0-py3-none-any.whl')
  for (const [file, line] of [['docs/sdk.md', lines[0]], ['docs/sdk-python.md', lines[1]], ['docs/mcp.md', lines[2]], ['docs/mcp.md', generate('--testnet')], ['docs/testnet.md', generate('--testnet')], ['docs/testnet.md', generate('--app')]]) expect(readFileSync(file, 'utf8')).toContain(line)
})
it('generates the labelled IOU opt-in without changing XRP installs', () => {
 const generate = (...flags: string[]) => execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', 'v1.0.0', ...flags], { encoding: 'utf8' }).trim()
 expect(generate('--testnet','--iou')).toBe(generate('--testnet')+' --iou')
 expect(generate('--app','--iou')).toBe(generate('--app')+' --iou')
 expect(readFileSync('README.md','utf8')).toContain(generate('--testnet','--iou'))
})
