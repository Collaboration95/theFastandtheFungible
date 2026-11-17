// The standalone finals pitch deck is published at /slides/ by scripts/site-publish.py.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

const html = readFileSync('pitch/index.html', 'utf8')
const publish = readFileSync('scripts/site-publish.py', 'utf8')

describe('finals pitch deck publication', () => {
  it('is self-contained: no external src, stylesheet link, @import or CSS url()', () => {
    expect(html).not.toMatch(/\s(?:src|srcset|poster|data)\s*=\s*["']?(?:https?:)?\/\//i)
    expect(html).not.toMatch(/<link\b[^>]*\shref\s*=\s*["']?(?:https?:)?\/\//i)
    expect(html).not.toMatch(/@import/i)
    const urls = [...html.matchAll(/url\(\s*["']?([^"')]+)/gi)].map(m => m[1])
    expect(urls.filter(u => !/^(?:data:|#)/.test(u))).toEqual([])
  })
  it('points every site-publish EXTRA entry at an existing file', () => {
    const block = publish.match(/EXTRA = \{([\s\S]*?)\}/)![1]
    const pairs = [...block.matchAll(/'([^']+)':\s*'([^']+)'/g)]
    expect(pairs.map(p => p[1])).toEqual(['slides/index.html', 'slides/ResearchAgent-finals-pitch.pdf'])
    for (const [, , src] of pairs) expect(existsSync(src), src).toBe(true)
  })
  it('keeps the October talk deck at slides/october/', () => {
    expect(existsSync('site/slides/october/index.html')).toBe(true)
    expect(existsSync('site/slides/index.html')).toBe(false)
  })
})
