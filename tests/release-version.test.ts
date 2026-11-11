import { expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'

for (const [tag, version] of [['v1.1.0', '1.1.0'], ['v1.0.0-rc.2', '1.0.0rc2']]) {
  test(`${tag} installs the wheel with its PEP 440 filename`, () => {
    const output = execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', tag], { encoding: 'utf8' })
    expect(output).toContain(`/researchagent-${version}-py3-none-any.whl`)
    expect(output).toContain(`/researchagent-sdk-${tag.slice(1)}.tgz`)
    expect(output).toContain(`/researchagent-mcp-${tag.slice(1)}.tgz`)
  })
}
