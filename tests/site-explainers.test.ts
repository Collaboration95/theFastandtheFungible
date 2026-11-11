// SITE contracts: public destinations, replay provenance and read-only issuer validation.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
// @ts-expect-error jsdom is installed without declarations in this repository
import { JSDOM } from 'jsdom'
// @ts-expect-error browser-native ES module
import { ISSUERS, LOCKING_FLAG, parseAccountRoot } from '../site/builder-feedback/issuer-check.mjs'
// @ts-expect-error dependency-free build config
import { HOSTED_APP_URL, REPLAY_TRACE, replayDate } from '../scripts/site-config.mjs'
const read = (file: string) => readFileSync(file, 'utf8')

describe('explainer destinations and provenance', () => {
  it('gives each page its own preview and description, including the Replay shell', () => {
    const pages = readdirSync('site', { recursive: true }).map(String).filter(f => f.endsWith('.html') && !f.startsWith('demo/')).map(f => `site/${f}`).concat('demo/index.html')
    const images = new Set<string>()
    for (const file of pages) {
      const doc = new JSDOM(read(file)).window.document
      expect(doc.querySelector('meta[name=description]')?.getAttribute('content')?.length, file).toBeGreaterThan(30)
      const image = doc.querySelector('meta[property="og:image"]')!.getAttribute('content')!
      expect(images.has(image), file).toBe(false); images.add(image)
      expect(doc.querySelector('.ra-live')?.getAttribute('href'), file).toBe(HOSTED_APP_URL)
    }
  })
  it('keeps the header to six pages plus GitHub and "Try it live", with secondary pages in one footer (S10)', () => {
    const pages = readdirSync('site', { recursive: true }).map(String).filter(f => f.endsWith('.html') && !f.startsWith('demo/')).map(f => `site/${f}`).concat('demo/index.html')
    for (const file of pages) {
      const doc = new JSDOM(read(file)).window.document
      const nav = [...doc.querySelectorAll('.ra-hdr nav a')].map(a => a.textContent)
      expect(nav, file).toEqual(['Replay', 'How it works', 'Proof', 'Progress', 'Developers', 'Builder feedback'])
      const visible = [...doc.querySelectorAll('.ra-hdr a')].filter(a => !a.closest('.ra-hdr-menu') && !a.classList.contains('ra-hdr-brand'))
      expect(visible.map(a => a.textContent), file).toEqual([...nav, 'Try it live', 'GitHub'])
      expect(doc.querySelectorAll('.ra-live'), file).toHaveLength(1)
      expect(doc.querySelector('.ra-hdr')?.textContent, file).not.toContain('✓')
      // The narrow-screen menu repeats the same links; nothing scrolls sideways or clips.
      expect([...doc.querySelectorAll('.ra-hdr-menu a')].map(a => a.textContent), file).toEqual([...nav, 'GitHub'])
      const footer = doc.querySelector('footer.ra-ftr')
      if (/slides|notes|demo/.test(file)) { expect(footer, file).toBeNull(); continue }
      expect(footer?.querySelector('.ra-ftr-env')?.textContent, file).toBe('XRPL Testnet demo · no real value')
      expect([...footer!.querySelectorAll('a')].map(a => a.textContent), file).toEqual(['Testnet ledger', 'Archive', 'README', 'Releases'])
    }
  })
  it('keeps guide links to local fragments reachable', () => {
    const base = 'https://collaboration95.github.io/theFastandtheFungible/'
    for (const route of ['proof/', 'developers/', 'builder-feedback/']) {
      const doc = new JSDOM(read(`site/${route}index.html`)).window.document
      for (const link of doc.querySelectorAll('a[href]')) {
        const url = new URL(link.getAttribute('href')!, base + route)
        if (!url.href.startsWith(base) || !url.hash) continue
        const file = 'site/' + url.pathname.slice(new URL(base).pathname.length) + (url.pathname.endsWith('/') ? 'index.html' : '')
        const target = new JSDOM(read(file)).window.document
        expect(target.getElementById(decodeURIComponent(url.hash.slice(1))), `${route}: ${url.href}`).not.toBeNull()
      }
    }
  })
  it('labels Replay with the real default recording date and provides a live fallback', () => {
    const recorded = JSON.parse(read(REPLAY_TRACE)).run.events[0].at
    expect(recorded).toMatch(/^2026-11-10T20:/)
    expect(replayDate()).toBe('11 Nov 2026')
    expect(read('demo/index.html')).toContain(`<title>Replay · ${replayDate()} · ResearchAgent</title>`)
    const home = new JSDOM(read('site/index.html')).window.document
    expect(home.querySelector('.card[href="demo/"]')?.textContent).toContain('Start here')
    expect(home.body.textContent).toContain('live 13–19 Nov')
    expect(home.body.textContent).toContain(`Replay · ${replayDate()}`)
    expect(home.querySelector('.card[href="project-map/"]')).toBeNull()
    const archive = new JSDOM(read('site/evolution/index.html')).window.document
    for (const href of ['../project-map/', '../slides/']) expect(archive.querySelector(`#archive a[href="${href}"]`)).not.toBeNull()
    expect(home.body.textContent).not.toMatch(/\b7 Nov(ember)? 2026\b|the 7 November/)
    // One link row in the hero (S10); the AI Tinkerers card carries no keyboard shortcuts (S25).
    expect(home.querySelector('main > p a[href="developers/"]')).toBeNull()
    expect(home.querySelector('main kbd')).toBeNull()
    expect(home.querySelector('.env-pill')?.textContent).toBe('XRPL Testnet demo · no real value')
  })
  it('loads only self-hosted fonts on site pages, including the code font', () => {
    const pages = readdirSync('site', { recursive: true }).map(String).filter(f => f.endsWith('.html') && !f.startsWith('demo/'))
    for (const file of pages) {
      const html = read(`site/${file}`)
      expect(html, file).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/)
      expect(html, file).toContain('brand/fonts.css')
      expect(html, file).not.toContain('@font-face')
    }
    expect(read('site/brand/fonts.css')).toContain('geist-mono-latin-wght-normal.woff2')
    expect(read('site/brand/fonts.css')).toContain('font-weight:100 900')
    expect(read('site/brand/fonts.css').match(/font-display:swap/g)).toHaveLength(2)
    const replay = read('demo/index.html')
    expect(replay).not.toContain('@font-face')
    expect(replay).toContain('font:500 14px/1 "Geist Variable"')
  })
  it('opens "How it works" on key reveal, with the October run under its own heading (S23)', () => {
    const talk = new JSDOM(read('site/talk/index.html')).window.document
    const sections = [...talk.querySelectorAll('main > section')].map(s => s.id)
    expect(sections.slice(0, 3)).toEqual(['top', 'key-reveal', 'october'])
    expect(talk.querySelector('#top #w-run')).toBeNull()
    expect(talk.querySelector('#october #w-run')).not.toBeNull()
    expect(talk.querySelector('#key-reveal img')?.getAttribute('src')).toBe('key-reveal.svg')
    expect(read('site/talk/key-reveal.svg')).toBe(read('docs/media/key-reveal.svg'))
    expect(talk.querySelector('#top .lede strong')?.textContent).not.toBe('the article it needs')
    expect(talk.body.innerHTML).not.toMatch(/>▶ play<|'❚❚ pause'|↻ replay</)
  })
})

describe('official RLUSD AccountRoot preflight', () => {
  const result = (Flags: number, extra = {}) => ({ validated: true, ledger_index: 123, account_data: { Account: ISSUERS[0].account, Flags }, ...extra })
  it('uses the AccountRoot locking bit, distinct from clawback', () => {
    expect(LOCKING_FLAG).toBe(1073741824)
    expect(parseAccountRoot(result(0x80000000), ISSUERS[0].account).enabled).toBe(false)
    expect(parseAccountRoot(result(0xc0000000), ISSUERS[0].account).enabled).toBe(true)
  })
  it('refuses unvalidated, missing, malformed and different-account data', () => {
    for (const value of [result(0, { validated: false }), result(-1), result(0x100000000), result(1.2), result(0, { ledger_index: null }), {}]) expect(() => parseAccountRoot(value, ISSUERS[0].account)).toThrow()
    expect(() => parseAccountRoot(result(0), ISSUERS[1].account)).toThrow()
  })
})
