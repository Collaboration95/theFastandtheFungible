// SITE contracts: public destinations, replay provenance and read-only issuer validation.
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
// @ts-expect-error jsdom is installed without declarations in this repository
import { JSDOM } from 'jsdom'
// @ts-expect-error browser-native ES module
import { ISSUERS, LOCKING_FLAG, parseAccountRoot } from '../site/builder-feedback/issuer-check.mjs'
// @ts-expect-error dependency-free build config
import { HOSTED_APP_URL } from '../scripts/site-config.mjs'
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
      expect(doc.querySelectorAll('.ra-hdr a').length, file).toBeGreaterThan(8)
      expect(doc.querySelector('.ra-hdr nav')?.getAttribute('tabindex'), file).toBe('0')
      expect(doc.querySelector('.ra-live')?.getAttribute('href'), file).toBe(HOSTED_APP_URL)
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
    const recorded = JSON.parse(read('demo/traces/UC3-key-reveal.json')).run.events[0].at
    expect(recorded).toMatch(/^2026-11-07/)
    expect(read('demo/index.html')).toContain('<title>Replay · 7 Nov 2026 · ResearchAgent</title>')
    const home = new JSDOM(read('site/index.html')).window.document
    expect(home.querySelector('.card[href="demo/?scenario=UC3-key-reveal"]')?.textContent).toContain('Start here')
    expect(home.body.textContent).toContain('live 13–19 Nov')
    expect(home.body.textContent).toContain('Replay · 7 Nov 2026')
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
