// The finals deck (docs/submission/deck/index.html) stays true: every number is a fact from
// facts.json, terminals are committed evidence, nothing is a placeholder, and each slide says
// which judging criteria it serves. The PDF itself is checked by export.mjs at export time.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { JSDOM } from 'jsdom'
// @ts-expect-error plain ESM script without types
import { build, fill, markedFiles } from '../scripts/facts.mjs'

const DECK = 'docs/submission/deck/index.html'
const html = readFileSync(DECK, 'utf8')
const doc = new JSDOM(html).window.document
const slides = [...doc.querySelectorAll('section.slide')]
const data = build() as { facts: Record<string, { value: string }>; links: Record<string, string | null> }
const fact = (key: string) => data.facts[key].value
const short = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-8)}`
const lines = (el: Element) => [...el.querySelectorAll(':scope > div')].map(d => d.textContent ?? '')

describe('finals deck', () => {
  it('fills every number from facts.json, like the README', () => {
    expect(markedFiles()).toContain(DECK)
    expect(fill(html, data.facts, DECK)).toBe(html)
  })

  it('has no placeholders, stale footers or retired claims', () => {
    const text = doc.body.textContent ?? ''
    expect(html).not.toContain('{{')
    expect(doc.querySelector('.ph, .todo')).toBeNull()
    for (const stale of [/no hosted instance/i, /approved every purchase/i, /human approved/i, /pending merge/i, /\b183\b/, /B01–B33/, /\b43\.8\b/, /\b177\b/, /spent S\$0\.70/, /Finished in 82\.0/, /nightly Testnet purchase in CI/i]) {
      expect(text, String(stale)).not.toMatch(stale)
    }
  })

  it('leads with the hosted sandbox, the replay and the try line on slides 1 and 8', () => {
    for (const url of html.match(/https:\/\/ra-front-[\w.-]+\.run\.app/g) ?? []) expect(url).toBe(data.links.hosted)
    const [one, eight] = [slides[0], slides[7]].map(s => s.textContent ?? '')
    expect(one).toContain(data.links.hosted)
    expect(one).toContain(fact('hosted'))
    expect(one).toContain('/theFastandtheFungible/demo/')
    expect(one).toContain(fact('try_line'))
    expect(eight).toContain(fact('hosted'))
    const tryLine = execFileSync(process.execPath, ['scripts/install-snippets.mjs', '--tag', fact('release'), '--try'], { encoding: 'utf8' }).trim()
    expect(fact('try_line')).toBe(tryLine)
  })

  it('shows the real committed try output on slide 3, links shortened to their hashes', () => {
    const term = slides[2].querySelector('.term[data-evidence]')!
    const source = term.getAttribute('data-evidence')!
    const evidence = readFileSync(source, 'utf8').trimEnd().split('\n')
    const url = /https:\/\/testnet\.xrpl\.org\/transactions\/([0-9A-F]{64})$/
    expect(lines(term)).toEqual(evidence.map(l => l.replace(url, (_, h) => short(h))))
    const hrefs = [...term.querySelectorAll('a')].map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(evidence.flatMap(l => l.match(url)?.[0] ?? []))
  })

  it('shows the committed Python verifier output on slide 7', () => {
    const term = slides[6].querySelector('.term[data-evidence]')!
    const evidence = readFileSync(term.getAttribute('data-evidence')!, 'utf8').trimEnd().split('\n')
    expect(lines(term).slice(-evidence.length)).toEqual(evidence)
  })

  it('links every Testnet hash to the explorer page of that exact hash', () => {
    for (const a of doc.querySelectorAll('a[href^="https://testnet.xrpl.org/transactions/"]')) {
      const hash = a.getAttribute('href')!.split('/').pop()!
      expect(hash).toMatch(/^[0-9A-F]{64}$/)
      const shown = (a.textContent ?? '').replace('…', '')
      expect(hash.startsWith(shown.slice(0, 8))).toBe(true)
    }
  })

  it('types no number that is not a fact (identifiers, dates, steps and sources aside)', () => {
    const clone = doc.body.cloneNode(true) as HTMLElement
    for (const el of clone.querySelectorAll('script, .notes, .src, .term, .cmdline, a, code, .tx, .mono')) el.remove()
    const text = (clone.innerHTML)
      .replace(/<!--f:\w+-->[\s\S]*?<!--\/f-->/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
    const month = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'
    const words = text
      .replace(new RegExp(`\\b\\d{1,2}(?:–\\d{1,2})? ${month}\\b`, 'g'), ' ')   // dates
      .replace(new RegExp(`\\b${month} \\d{4}\\b`, 'g'), ' ')
      .replace(/\b(?:x402|XLS-85|v\d+(?:\.\d+)*|sha256|SHA-256|AES-256-GCM|127\.0\.0\.1|1 KiB|402|2026)\b/g, ' ')
    const numbers = [...words.matchAll(/(?<![\w-])\d[\d,.]*(?![\w-])/g)].map(m => m[0].replace(/[.,]$/, ''))
    // What remains may only be step and rank numbers.
    expect(numbers.filter(n => !/^[1-7]$/.test(n))).toEqual([])
  })

  it('keeps 12–14 slides, each naming the judging criteria it serves in its speaker notes', () => {
    expect(slides.length).toBeGreaterThanOrEqual(12)
    expect(slides.length).toBeLessThanOrEqual(14)
    const criteria = /Reachability|Creativity|Feasibility|Technical depth|UX and design|Builder feedback/
    for (const [i, slide] of slides.entries()) {
      const notes = slide.querySelector('aside.notes')
      expect(notes, `slide ${i + 1} notes`).not.toBeNull()
      expect(notes!.textContent, `slide ${i + 1}`).toMatch(criteria)
    }
  })

  it('has the product shots on disk, with their capture manifest, and a matching PDF', () => {
    for (const img of doc.querySelectorAll('img')) expect(existsSync(`docs/submission/deck/${img.getAttribute('src')}`), img.getAttribute('src')!).toBe(true)
    const shots = JSON.parse(readFileSync('docs/submission/deck/assets/shots.json', 'utf8'))
    expect(shots.label).toMatch(/XRPL Testnet.*no real value/)
    expect(shots.deviceScaleFactor).toBe(2)
    const pdf = readFileSync('docs/submission/ResearchAgent-SFF-deck.pdf', 'latin1')
    expect(pdf.match(/\/Type\s*\/Page(?!s)/g)?.length).toBe(slides.length)
  })
})
