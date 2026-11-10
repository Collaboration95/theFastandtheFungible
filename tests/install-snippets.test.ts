import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
it('documents generated v1.0.2 asset installs and registry status across guides', () => {
  const generate = (...flags: string[]) => execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', 'v1.0.2', ...flags], { encoding: 'utf8' }).trim()
  const lines = generate().split('\n')
  // README is the product page: it carries the try line, the MCP Testnet line and both SDK installs.
  // docs/install.md carries every variant and the registry status (moved from README on 11 Nov).
  const readme = readFileSync('README.md', 'utf8')
  for (const line of [generate('--try'), generate('--testnet'), lines[0], lines[1]]) expect(readme).toContain(line)
  const install = readFileSync('docs/install.md', 'utf8')
  for (const line of [...lines, generate('--try'), generate('--testnet'), generate('--app')]) expect(install).toContain(line)
  expect(install).toContain('release · not yet on npm/PyPI/MCP Registry')
  for (const text of [readme, install]) expect(text).not.toContain('from the next release candidate')
  const demo = readFileSync('demo/index.html', 'utf8')
  for (const line of [generate('--app'), generate('--testnet'), lines[1]]) expect(demo).toContain(line)
  expect(demo.indexOf(generate('--app'))).toBeLessThan(demo.indexOf(generate('--testnet')))
  expect(demo).not.toContain('v1.0.0-rc.1')
  expect(lines[1]).toContain('researchagent-1.0.2-py3-none-any.whl')
  for (const [file, line] of [['docs/sdk.md', lines[0]], ['docs/sdk-python.md', lines[1]], ['docs/mcp.md', lines[2]], ['docs/mcp.md', generate('--testnet')], ['docs/testnet.md', generate('--testnet')], ['docs/testnet.md', generate('--app')]]) expect(readFileSync(file, 'utf8')).toContain(line)
})
it('generates the labelled IOU opt-in without changing XRP installs', () => {
 const generate = (...flags: string[]) => execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', 'v1.0.2', ...flags], { encoding: 'utf8' }).trim()
 expect(generate('--testnet','--iou')).toBe(generate('--testnet')+' --iou')
 expect(generate('--app','--iou')).toBe(generate('--app')+' --iou')
 expect(readFileSync('docs/install.md','utf8')).toContain(generate('--testnet','--iou'))
})
it('keeps the complete empty-folder SDK and writer quickstarts generated', () => {
  execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', 'v1.0.2', '--check'])
  expect(readFileSync('docs/install.md', 'utf8')).toContain(execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', 'v1.0.2', '--writer'], { encoding: 'utf8' }).trim())
  const py = readFileSync('docs/sdk-python.md', 'utf8')
  expect(readFileSync('packages/sdk-python/README.md', 'utf8')).toBe(py)
  for (const file of ['docs/sdk.md', 'docs/sdk-python.md']) {
    const guide = readFileSync(file, 'utf8')
    for (const text of ['MCP_MAX_BUDGET_MINOR', 'MCP_DAILY_CAP_MINOR', 'PowerShell', 'SIMULATED', 'receipts.json', 'TOKEN_FILE']) expect(guide).toContain(text)
  }
})

it('generates Windows child-process wrapping without changing the POSIX entry', () => {
  const args = ['scripts/install-snippets.mjs', '--tag', 'v1.0.2', '--testnet']
  const posix = execFileSync(process.execPath, args, { encoding: 'utf8' }).trim()
  const windows = execFileSync(process.execPath, [...args, '--powershell'], { encoding: 'utf8' }).trim()
  expect(windows).toBe(posix.replace('-- npx ', '-- cmd /c npx '))
  expect(readFileSync('docs/mcp.md', 'utf8')).toContain(windows)
})
