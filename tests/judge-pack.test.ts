// The judge pack tells one true story (README, docs/submission, the site's hand-written pages).
// These checks do not depend on which release is latest, so they hold before and after a publish:
// no old release is named as current, the writer and held-out wording match the data, and no private
// review notes or scores appear in a public file. The numbers themselves come from facts.json (deck.test.ts).
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(path, 'utf8')
/** Every file under a folder whose name matches, sorted. */
const walk = (dir: string, match: RegExp): string[] =>
  readdirSync(dir).sort().flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path, match) : match.test(name) ? [path] : []
  })

const submission = walk('docs/submission', /\.(md|html|json|txt|srt|csv)$/).filter(f => !f.includes('/deck/assets/'))
// Hand-written site pages. /progress/ and /evolution/ are generated from history and may name old releases.
const sitePages = ['index.html', 'developers/index.html', 'builder-feedback/index.html', 'proof/index.html', 'talk/index.html', 'ledger/index.html'].map(p => `site/${p}`)
const publicFiles = ['README.md', ...submission, ...sitePages]

describe('judge pack: one true story', () => {
  it('names no old release as current (v1.0.x appears only to say it cannot verify new exports)', () => {
    const found: string[] = []
    for (const file of publicFiles) {
      const text = file.endsWith('facts.json') ? '' : read(file) // facts.json is checked against the latest published release by `npm run hygiene`
      for (const line of text.split('\n')) {
        for (const match of line.matchAll(/\bv?1\.0\.[0-9]+\b/g)) if (!/cannot recompute|v1\.0\.2 wheel/.test(line)) found.push(`${file}: ${match[0]}`)
      }
    }
    expect(found).toEqual([])
  })

  it('keeps private review notes and scores out of public files', () => {
    const leaks: string[] = []
    for (const file of publicFiles) {
      for (const [i, line] of read(file).split('\n').entries()) {
        if (/\bmock[- ]judges?\b|\bH[0-9]-[0-9]{2}\b|\b[0-9]{2}(?:\.[0-9]+)? ?\/ ?105\b/i.test(line)) leaks.push(`${file}:${i + 1}`)
      }
    }
    expect(leaks).toEqual([])
  })

  it('keeps the overclaims the story review found out of every public surface, video words included', () => {
    const retired: [RegExp, string][] = [
      [/A model recommends/i, 'the live sandbox buys by fixed rules: no model recommends there'],
      [/\ban open market\b/i, 'there are no independent writers yet'],
      [/keeps (?:everyone|them) honest/i, 'the ledger enforces delivery, not quality'],
      [/Every claim has a Testnet hash/i, 'every payment has one; the quality numbers used simulated payments'],
      [/two independent (?:receipt )?verifiers/i, 'one team wrote both, separately'],
      [/verifier that isn.t ours/i, 'both verifiers are ours'],
      [/buys only the articles that fill the gap/i, 'it buys an article only when policy judges it fills a gap'],
      [/seven of twenty/i, 'that was the v4 bank; v5 is sixteen of twenty (use the fact markers)'],
    ]
    const hits: string[] = []
    for (const file of publicFiles) {
      const text = read(file)
      for (const [pattern, why] of retired) if (pattern.test(text)) hits.push(`${file}: ${pattern} (${why})`)
    }
    expect(hits).toEqual([])
    // The video words live in shots.json (the source) and are copied into the generated files; they must agree.
    const spec = JSON.parse(read('docs/submission/video/shots.json')) as { shots: { id: string; vo: string }[] }
    const voiceover = read('docs/submission/video/voiceover.txt')
    for (const shot of spec.shots) if (shot.vo) expect(voiceover, shot.id).toContain(shot.vo)
  })

  it('counts the team-authored writers the corpus really has', () => {
    const team = readdirSync('data/writers').filter(f => /^team-.*\.json$/.test(f))
    expect(team).toHaveLength(2)
    expect(read('README.md')).toMatch(/Two team-authored writers/)
    expect(read('docs/submission/short-description.md')).toMatch(/two team-authored writers/i)
    expect(read('docs/submission/qa-prep.md')).toMatch(/two team-authored writers/i)
    // The old "one team-authored writer" wording must not come back.
    for (const file of publicFiles) expect(read(file), file).not.toMatch(/\bone team-authored writer\b|\bA team-authored writer is\b/i)
  })

  it('states the held-out scope everywhere it quotes the v5 numbers: fixture models, answers written offline, Testnet', () => {
    const scope = /fixture research and decision models/
    for (const file of ['README.md', 'docs/submission/short-description.md', 'docs/submission/qa-prep.md', 'docs/submission/pitch-2min.md']) {
      expect(read(file), file).toMatch(scope)
    }
    expect(read('docs/submission/qa-prep.md')).toMatch(/answers written offline/)
    // The held-out claim links the packet it comes from (v5), and the Q&A cites the commit v5 actually ran on.
    for (const file of ['docs/submission/pitch-2min.md', 'docs/submission/qa-prep.md', 'docs/submission/short-description.md']) {
      expect(read(file), file).toContain('evidence/v5-heldout/README.md')
    }
    const ran = read('docs/evidence/v5-heldout/README.md').match(/on `main` at `([0-9a-f]{40})`/)?.[1]
    expect(ran).toBeTruthy()
    expect(read('docs/submission/qa-prep.md')).toContain(`\`${ran!.slice(0, 8)}\``)
  })

  it('describes the purchase rule and the sandbox honestly on the hand-written site pages', () => {
    const talk = read('site/talk/index.html')
    expect(talk).toMatch(/buys at most one article per round, up to three rounds/)
    expect(talk).not.toMatch(/buy the article it needs/)
    // The October replay keeps its own labels; the page footer no longer calls today's writers all synthetic.
    expect(talk).toContain('October replay: writers and articles SYNTHETIC')
    const home = read('site/index.html')
    expect(home).toContain('Live sandbox: live answers · rule-based buying · team-authored writers. Recorded replay: fixture models · fictional writers.')
  })

  it('has a release-note title for the latest CHANGELOG release, so /progress/ builds the day it is published', () => {
    const latest = read('CHANGELOG.md').match(/^## v(\d+\.\d+\.\d+) — /m)?.[1]
    expect(latest).toBeTruthy()
    expect(read('scripts/progress-story.mjs')).toContain(`'v${latest}': {`)
    expect(existsSync('docs/submission/deck/index.html')).toBe(true)
  })
})
