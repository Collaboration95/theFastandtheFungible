// @vitest-environment jsdom
// P2 · front door for builders: three lines to copy under the examples, pinned to a release that is already PUBLISHED.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { execFileSync } from 'node:child_process'
import { builderLines, type Hosted } from '../src/hosted'
import { HostedFooter } from '../src/components/hosted/HostedHome'
import { isPublishedRelease, PUBLISHED_RELEASES, RELEASE_TAG, releaseBase } from '../shared/links'
import pkg from '../package.json'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const hosted = (proof = ''): Hosted => ({ status: {
  questionCapMinor: 200, state: 'ready', csrfToken: 't', queue: [],
  capabilities: { ask: true, scope: true, history: true, receipts: true, pdf: false, settings: false, faultControls: false },
  remaining: { questions: 5, minor: 1000 }, labels: { models: 'live models', rail: 'Shared XRPL Testnet demo · no real value' },
  links: { repo: 'https://github.com/example/repo', deck: '', video: '', progress: '', replay: '', proof },
} })
const snippet = (...flags: string[]) => execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', RELEASE_TAG, ...flags], { encoding: 'utf8' }).trim()

describe('the pinned release', () => {
  it('is one that has been published (bump `release` and `publishedReleases` together, after the release exists)', () => {
    expect(RELEASE_TAG).toMatch(/^v\d+\.\d+\.\d+$/)
    expect(RELEASE_TAG).toBe(`v${pkg.version}`)
    expect(PUBLISHED_RELEASES, `${RELEASE_TAG} is not in shared/links.json publishedReleases; pin the latest PUBLISHED tag, never an unpublished one`).toContain(RELEASE_TAG)
    expect(PUBLISHED_RELEASES.every(tag => /^v\d+\.\d+\.\d+$/.test(tag))).toBe(true)
  })
  it('refuses a tag that is not in the published list', () => {
    expect(isPublishedRelease('v9.9.9')).toBe(false)
    expect(isPublishedRelease(RELEASE_TAG)).toBe(true)
  })
  // The tag is published for real, not only listed: HEAD the pinned assets. Opt in (CHECK_RELEASE_URLS=1); the stage kit runs the same check.
  it.runIf(process.env.CHECK_RELEASE_URLS === '1')('exists on GitHub: every pinned asset answers', async () => {
    const v = RELEASE_TAG.slice(1)
    for (const asset of [`researchagent-mcp-${v}.tgz`, `researchagent-${v}-py3-none-any.whl`]) {
      const assets = JSON.parse(execFileSync('gh', ['release', 'view', RELEASE_TAG, '--repo', 'Collaboration95/theFastandtheFungible', '--json', 'assets'], { encoding: 'utf8' })).assets as { name: string; apiUrl: string }[]
      const url = assets.find(row => row.name === asset)?.apiUrl
      expect(url, asset).toBeTruthy()
      execFileSync('gh', ['api', '--method', 'HEAD', '-H', 'Accept: application/octet-stream', url!])
    }
  }, 30_000)
})

describe('the three lines', () => {
  const lines = builderLines()
  it('are exactly the generated install commands for the pinned tag', () => {
    expect(lines.tag).toBe(RELEASE_TAG)
    expect(lines.claude).toBe(snippet('--testnet'))
    expect(lines.try).toBe(snippet('--try'))
    expect(lines.verify).toBe(`npx -y ${releaseBase()}/researchagent-mcp-${RELEASE_TAG.slice(1)}.tgz verify receipts.json --ledger`)
  })
  it('all point at the pinned release asset and nothing else', () => {
    for (const line of [lines.claude, lines.try, lines.verify]) {
      const urls = line.match(/https:\/\/\S+/g) ?? []
      expect(urls).toEqual([`${releaseBase()}/researchagent-mcp-${RELEASE_TAG.slice(1)}.tgz`])
    }
  })
})

describe('the row', () => {
  it('sits in the footer area, collapsed, with three copy buttons', () => {
    render(<HostedFooter hosted={hosted()} />)
    const row = document.querySelector('details.ra-hbuild') as HTMLDetailsElement
    expect(row.open).toBe(false)
    expect(within(row).getByText('Use it from your own agent')).toBeTruthy()
    expect(within(row).getAllByRole('button', { name: /^Copy: / })).toHaveLength(3)
    expect(row.textContent).toContain('RESULT PASS')
    expect(row.textContent).toContain('84.2 seconds; 2 of 4 cold runs exceeded 90 seconds (one Mac, 7 Nov)')
    expect(row.textContent).not.toContain('75 seconds')
    expect(row.textContent).not.toContain('no real value')
    expect(row.textContent).toContain('Needs Node 22.13 or later')
    expect(screen.getByRole('navigation', { name: 'Project links' })).toBeTruthy()
  })
  it('copies each line exactly, then says it did', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<HostedFooter hosted={hosted()} />)
    const lines = builderLines()
    for (const [name, text] of [['Add it to Claude Code', lines.claude], ['Run the whole money path once', lines.try], ['Verify a receipts.json', lines.verify]] as const) {
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: `Copy: ${name}` })) })
      expect(writeText).toHaveBeenLastCalledWith(text)
      expect(screen.getByRole('button', { name: `Copy: ${name}` }).textContent).toBe('Copied')
    }
    expect(writeText).toHaveBeenCalledTimes(3)
  })
  it('stays quiet if the browser refuses the clipboard: the line is still on screen to select', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(async () => { throw new Error('denied') }) } })
    render(<HostedFooter hosted={hosted()} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy: Run the whole money path once' })) })
    expect(screen.getByRole('button', { name: 'Copy: Run the whole money path once' }).textContent).toBe('Copy')
    expect(document.body.textContent).toContain(builderLines().try)
  })
  it('adds the proof-of-refusal link only when one is configured', () => {
    render(<HostedFooter hosted={hosted()} />)
    expect(screen.queryByText(/See a real proof of refusal/)).toBeNull()
    cleanup()
    render(<HostedFooter hosted={hosted('https://ra-front.example/proof/' + 'd'.repeat(32))} />)
    expect(screen.getByRole('link', { name: /See a real proof of refusal/ }).getAttribute('href')).toContain('/proof/')
  })
  it('names the replay target as a writer never reveals, money back', () => {
    render(<HostedFooter hosted={hosted()} />)
    expect(screen.getByRole('link', { name: /^Recorded walkthrough: writer never reveals, money back/ }).getAttribute('href')).toMatch(/\?scenario=UC-key-reveal$/)
  })
})
