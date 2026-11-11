// Every release link the public pack pins must resolve before `npm run site:publish` (scripts/check-release-urls.mjs).
// The network is faked: these tests read the real README and docs, but never leave the machine.
import { describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { withResourceScope } from '../shared/resource-scope.js'
// @ts-expect-error plain ESM script without types
import { check, collect, publicFiles } from '../scripts/check-release-urls.mjs'

const REPO = 'https://github.com/Collaboration95/theFastandtheFungible'
const answer = (status: number) => async () => ({ status }) as Response

describe('pinned release links', () => {
  it('finds the install, verify and raw-file links the README pins, and expands $REL', () => {
    const urls = [...collect().keys()] as string[]
    const tag = JSON.parse(readFileSync('package.json', 'utf8')).version as string
    expect(urls).toContain(`${REPO}/releases/download/v${tag}/researchagent-mcp-${tag}.tgz`)
    expect(urls).toContain(`${REPO}/releases/download/v${tag}/researchagent-${tag}-py3-none-any.whl`)
    expect(urls).toContain(`${REPO}/releases/tag/v${tag}`)
    expect(urls.some(u => u.startsWith('https://raw.githubusercontent.com/') && u.includes(`/v${tag}/docs/evidence/`))).toBe(true)
    expect(publicFiles()).toEqual(expect.arrayContaining(['README.md', 'docs/install.md', 'docs/submission/deck/index.html', 'site/developers/index.html']))
    expect(publicFiles().some((f: string) => f.startsWith('docs/evidence/'))).toBe(false)
  })

  it('reads a base folder without templates, elisions or trailing punctuation', () => withResourceScope(async scope => {
    const base = await scope.tempDir('release-urls-')
    mkdirSync(join(base, 'docs'))
    writeFileSync(join(base, 'README.md'), [
      `REL=${REPO}/releases/download/v9.9.9`,
      'npx -y $REL/tool-9.9.9.tgz try --testnet',
      `See ${REPO}/releases/tag/v9.9.9.`,
      `Template ${REPO}/releases/download/v\${tag}/x.tgz and ${REPO}/releases/download/v9.9.9/…`,
    ].join('\n'))
    const cited = collect(base) as Map<string, string[]>
    expect([...cited.keys()].sort()).toEqual([`${REPO}/releases/download/v9.9.9/tool-9.9.9.tgz`, `${REPO}/releases/tag/v9.9.9`])
    expect(cited.get(`${REPO}/releases/tag/v9.9.9`)).toEqual(['README.md'])
  }))

  it('reports a 404 (and any server error) with the URL, and passes when everything resolves', async () => {
    const urls = [`${REPO}/releases/tag/v9.9.9`, `${REPO}/releases/tag/v1.0.2`]
    const missing = await check(urls, { fetchImpl: async (u: string) => ({ status: u.endsWith('v9.9.9') ? 404 : 200 }) as Response })
    expect(missing).toEqual([{ url: urls[0], why: '404 not found' }])
    expect(await check(urls, { fetchImpl: answer(200) })).toEqual([])
    const broken = await check(urls.slice(0, 1), { fetchImpl: answer(503) })
    expect(broken).toEqual([{ url: urls[0], why: 'HTTP 503' }])
  })

  it('retries a host that refuses HEAD with a one-byte GET, and a flaky network once', async () => {
    const seen: string[] = []
    const refusing = async (_u: string, init: RequestInit) => { seen.push(String(init.method)); return { status: init.method === 'HEAD' ? 405 : 206 } as Response }
    expect(await check(['https://example.test/a'], { fetchImpl: refusing })).toEqual([])
    expect(seen).toEqual(['HEAD', 'GET'])
    let calls = 0
    const flaky = async () => { if (++calls === 1) throw new Error('socket hang up'); return { status: 200 } as Response }
    expect(await check(['https://example.test/b'], { fetchImpl: flaky })).toEqual([])
    const down = async () => { throw new Error('offline') }
    expect(await check(['https://example.test/c'], { fetchImpl: down })).toEqual([{ url: 'https://example.test/c', why: 'no answer (offline)' }])
  })
})
