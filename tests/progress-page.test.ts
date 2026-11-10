// /progress/ ("Since SingHacks"): the committed facts are complete, sourced and rendered.
// Offline: reads site/progress/data.json; never calls git history or gh.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
// @ts-expect-error dependency-free build script
import { cleanBullet, prTitle, parseChangelog, need, MissingFact, sgtDay, dayLabel } from '../scripts/build-progress-data.mjs'

const data = JSON.parse(readFileSync('site/progress/data.json', 'utf8'))
const html = readFileSync('site/progress/index.html', 'utf8')
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

describe('progress data', () => {
  it('is dated and tied to a commit', () => {
    expect(data.generated_at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/)
    expect(data.source_sha).toMatch(/^[0-9a-f]{40}$/)
    expect(data.as_of).toMatch(/^\d{4}-\d\d-\d\d$/)
    expect(data.since.date).toBe('2026-09-21')
  })
  it('has every headline number', () => {
    const h = data.headline
    for (const v of [h.days, h.prs, h.releases, h.transactions, h.heldout.n, h.heldout.N, h.heldout.offTopic.n, h.heldout.offTopic.N, h.try.seconds, h.try.limit, h.tests, h.commits]) expect(finite(v)).toBe(true)
    expect(h.transactions).toBe(JSON.parse(readFileSync('site/ledger/transactions.json', 'utf8')).rows.length)
    expect(h.heldout).toMatchObject({ n: 7, N: 20, offTopic: { n: 0, N: 10 } })
  })
  it('gives every rail stop shipped items, a proof link and a committed image or excerpt', () => {
    expect(data.rail.filter((r: { kind: string }) => r.kind === 'release')).toHaveLength(data.headline.releases)
    for (const r of data.rail) {
      expect(r.bullets.length, r.id).toBeGreaterThanOrEqual(1)
      expect(r.bullets.length, r.id).toBeLessThanOrEqual(3)
      expect(r.proofs.length, r.id).toBeGreaterThanOrEqual(1)
      for (const p of r.proofs) expect(p.url, r.id).toMatch(/^https:\/\//)
      expect(Boolean(r.image) || Boolean(r.snippet), r.id).toBe(true)
      if (r.image) {
        const file = `site/progress/${r.image.src}`
        expect(existsSync(file), file).toBe(true)
        expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(r.image.sha256)
        expect(r.image.alt.length).toBeGreaterThan(20)
      }
    }
    const days = data.rail.map((r: { day: string }) => r.day)
    expect([...days].sort()).toEqual(days)
  })
  it('keeps misses with a measured value and a source', () => {
    expect(data.misses.length).toBeGreaterThanOrEqual(5)
    for (const m of data.misses) { expect(m.measure).toMatch(/\d/); expect(m.source).toContain(data.source_sha) }
  })
  it('shows v5 as pending until its results are committed, without reading the bank', () => {
    const v5 = data.metrics.banks.find((b: { id: string }) => b.id === 'v5')
    const measured = existsSync('docs/evidence/v5-heldout/v5/results.json')
    expect(v5.status).toBe(measured ? 'measured' : 'pending')
    expect(readFileSync('scripts/build-progress-data.mjs', 'utf8')).not.toMatch(/read\([^)]*judge-xrpl\.v5/)
  })
  it('labels every ledger transaction with one plain operation name', () => {
    expect(data.metrics.transactions).toHaveLength(data.headline.transactions)
    for (const t of data.metrics.transactions) expect(t.kind).not.toBe('Other')
  })
})

describe('progress page', () => {
  it('is rendered from the committed data (render-progress --check)', () => {
    expect(() => execFileSync('node', ['scripts/render-progress.mjs', '--check'], { stdio: 'pipe' })).not.toThrow()
  })
  it('states the counted commit and the query definitions', () => {
    expect(html).toContain(data.source_sha.slice(0, 7))
    expect(html).toContain('id="method"')
    expect(html).toContain(`${data.headline.prs}`)
  })
  it('links the October archive and the ledger, and is linked from every page header', () => {
    expect(html).toContain('href="../evolution/"')
    expect(html).toContain('href="../ledger/"')
    for (const page of ['site/index.html', 'site/ledger/index.html', 'site/evolution/index.html']) expect(readFileSync(page, 'utf8')).toMatch(/<nav aria-label="Explainers">.*href="(\.\.\/)?progress\/"/)
    expect(readFileSync('site/index.html', 'utf8')).not.toContain('39 days')
  })
})

describe('progress builder helpers', () => {
  it('turns changelog bullets into one sentence and moves PR numbers to proofs', () => {
    expect(cleanBullet('MCP server: search writers and buy within caps. [#266](https://x/pull/266)')).toEqual({ text: 'MCP server: search writers and buy within caps.', prs: [266] })
    expect(cleanBullet('Signed fact menus regressed waste; the follow-up is #276. [#304](u)').text).toContain('follow-up is #276')
    expect(cleanBullet('Opt-in token escrow on the zero-clone MCP and the app (#384). More words here.').text).toBe('Opt-in token escrow on the zero-clone MCP and the app.')
  })
  it('reads both CHANGELOG heading styles', () => {
    const s = parseChangelog('## v1.0.2 — 8 Nov 2026\n\n### Fixed\n\n- Anchor pending is no longer a failure (#418).\n\n## [0.1.0] - 2026-11-02 · MCP\n\n- MCP server and tools for any agent. [#266](u)\n')
    expect(Object.keys(s)).toEqual(['v1.0.2', 'v0.1.0'])
    expect(s['v0.1.0'].bullets[0].prs).toEqual([266])
  })
  it('cleans PR titles and dates in Singapore time', () => {
    expect(prTitle('feat(brand): generate identity, icons (Refs #271)')).toBe('Generate identity, icons.')
    expect(sgtDay('2026-11-02T16:38:50Z')).toBe('2026-11-03')
    expect(dayLabel('2026-09-19')).toBe('19 Sep')
  })
  it('refuses a missing number', () => {
    expect(() => need(undefined, 'x')).toThrow(MissingFact)
    expect(() => need(Number.NaN, 'x')).toThrow(/missing x/)
    expect(need(0, 'zero is a number')).toBe(0)
  })
})
