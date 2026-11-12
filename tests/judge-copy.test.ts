// Presentation rule: label each surface once, retain limits in their homes, and keep
// substitutions next to the evidence they describe. Immutable evidence and machine
// facts are not authored judge copy: changing those would erase provenance.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
const read = (p: string) => readFileSync(p, 'utf8')
const authored = readdirSync('docs/submission', { recursive: true }).map(String)
  .filter(p => !/^(evidence\/|deck\/assets\/|facts\.json$)/.test(p) && /\.(md|html|txt|srt|json|csv)$/.test(p))
  .map(p => `docs/submission/${p}`)
const files = ['docs/media/key-reveal.svg', 'README.md', ...authored, 'site/index.html', 'scripts/render-progress.mjs', 'scripts/progress-story.mjs', 'scripts/site-header.mjs']
// Explicit budgets, not an ever-growing exemption list: README top + stats scope;
// Q&A environment + TokenEscrow networks + locally qualified identity answer.
const environmentBudget: Record<string, number> = {
  'README.md': 2, 'docs/submission/short-description.md': 1,
  'docs/submission/qa-prep.md': 4, 'docs/submission/deck/index.html': 1,
  'docs/submission/video/shots.json': 1, 'site/index.html': 1, 'scripts/site-header.mjs': 1,
}
const codenames = /\b(?:HOSTED[-_]\d+|DEPLOY[-_](?:\d+|FIX)|UC[123]|X1[abc]|MJ\d+(?:-FIX)?|L12R?|P[1-5]|DOC-1|FIN-(?:FINAL|prep)|VID-[1-4]|UI-[ABC]|LABELS9)\b|(?<!&)#\d+\b/g
const prose = (s: string) => s.replace(/--testnet\b/g, '').replace(/<style>[^]*?<\/style>/g, '').replace(/\/Users\/[^\s]+/g, '').replace(/#[0-9A-Fa-f]{3,8}(?=[;}"', ])/g, '').replace(/```[\s\S]*?```/g, '').replace(/<!--[^]*?-->/g, '')
  .replace(/\[[^\]]*\]\([^)]*\)/g, m => m.slice(1, m.indexOf(']')))
  .replace(/https?:\/\/[^\s"'<>]+/g, '').replace(/<[^>]*>/g, '')
  .replace(/`[^`]*[/.][^`]*`/g, '')

describe('judge-facing presentation contract', () => {
  it.each(files)('%s keeps environment labels tight and internal lane names out of prose', file => {
    const text = prose(read(file))
    expect(text.match(codenames) ?? [], file).toEqual([])
    expect((text.match(/\bTestnet\b/gi) ?? []).length, file).toBeLessThanOrEqual(environmentBudget[file] ?? 0)
    expect((text.match(/no real value/gi) ?? []).length, file).toBeLessThanOrEqual(file === 'docs/submission/qa-prep.md' ? 1 : 0)
    expect(text, file).not.toMatch(/test funds/i)
  })

  it('states each delivery/traction limit once in each limits home and excludes it from the narrative', () => {
    const readme = read('README.md')
    const deck = read('docs/submission/deck/index.html')
    const qa = read('docs/submission/qa-prep.md')
    const phrases = [/No independent writers, customers, pilots or revenue/gi, /Signed submission can expose the key before validation/gi, /a real writer could refuse/gi]
    for (const text of [readme, deck, qa].map(t => t.replace(/\s+/g, ' '))) for (const phrase of phrases) expect(text.match(phrase)).toHaveLength(1)
    for (const phrase of phrases) {
      expect(readme.split('## Status and limits')[0]).not.toMatch(phrase)
      expect(deck.slice(0, deck.lastIndexOf('<section class="slide"'))).not.toMatch(phrase)
      for (const file of ['docs/submission/short-description.md', 'docs/submission/pitch-2min.md', 'docs/submission/video/voiceover.txt']) expect(read(file), file).not.toMatch(phrase)
    }
  })

  it('ties the feasibility facts to the unchanged cookieless snapshot and shows sample boundaries', () => {
    const stats = JSON.parse(read('docs/submission/evidence/hosted-stats-nov12/stats.json'))
    const facts = JSON.parse(read('docs/submission/facts.json')).facts
    expect(facts.live_questions.value).toBe(String(stats.questions))
    expect(facts.live_purchases.value).toBe(String(stats.purchasesSettled))
    expect(facts.live_model_usd.value).toBe(String(stats.medianModelUsd))
    expect(facts.live_median_s.value).toBe((stats.timing.medianMs / 1000).toFixed(3))
    expect(facts.live_p90_s.value).toBe((stats.timing.p90Ms / 1000).toFixed(3))
    expect(facts.live_audits.value).toBe(String(stats.audit.checked))
    expect(facts.live_audit_unavailable.value).toBe(String(stats.audit.unavailable))
    for (const file of ['README.md', 'docs/submission/deck/index.html']) {
      const text = read(file)
      for (const key of ['live_questions', 'live_purchases', 'live_median_s', 'live_p90_s', 'live_model_usd', 'live_violations', 'live_audits', 'live_asof', 'live_audit_unavailable']) expect(text, `${file} ${key}`).toContain(`<!--f:${key}-->`)
      expect(text).toMatch(/team test runs included/)
    }
  })

  it('keeps the QR payload, Pages redirect and video end card on the same short URL', () => {
    const url = 'https://collaboration95.github.io/theFastandtheFungible/try/'
    const qrcode = createRequire(import.meta.url)('qrcode-generator')
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make()
    expect(read('site/try/qr.svg').trim()).toBe(qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true, alt: 'Open ResearchAgent hosted demo' }))
    expect(read('site/try/index.html')).toContain('http-equiv="refresh" content="0;url=https://ra-front-651013803640.asia-southeast1.run.app"')
    expect(read('site/try/index.html')).toContain('<a href="https://ra-front-651013803640.asia-southeast1.run.app">')
    const spec = JSON.parse(read('docs/submission/video/shots.json'))
    expect(spec.endCard).toMatchObject({ url, qr: 'site/try/qr.svg' })
    expect(spec.shots.at(-1).vo).toContain('The key matches the payment lock.')
    expect(read('docs/submission/video/voiceover.txt')).not.toContain('a real writer could refuse')
  })
})
