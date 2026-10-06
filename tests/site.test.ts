// Blog sites (#145-#148): snapshots, escaping, anchors, index. No ports 5100/8788/8790.
import { describe, expect, it } from 'vitest'
import { miniCorpus } from './fixtures/corpus-mini/index.js'
import { articleUrl } from '../shared/contracts/manifest.js'

import { serve } from './site-serve.js'
const get = async (url: string) => { const r = await fetch(url); return { status: r.status, type: r.headers.get('content-type') ?? '', text: await r.text() } }
const free = miniCorpus.articles.find(a => a.tier === 'FREE' && a.publisherSlug === 'load-factor')!
const paid = miniCorpus.articles.find(a => a.tier === 'PAID')!

describe('blog pages', () => {
  it('renders home, free article, paid article, about, contact and index (snapshots)', async () => {
    const base = await serve(miniCorpus)
    const pages = {
      home: `/w/load-factor/`, free: articleUrl('load-factor', free.articleId), paid: articleUrl(paid.publisherSlug, paid.articleId),
      about: `/w/load-factor/about`, contact: `/w/load-factor/contact`, index: `/w/`,
    }
    for (const [name, path] of Object.entries(pages)) {
      const { status, type, text } = await get(base + path)
      expect(status, name).toBe(200)
      expect(type).toContain('text/html')
      expect(text).toContain('SYNTHETIC · fictional writer')
      expect(text).not.toMatch(/<script/i)
      expect(text).toMatchSnapshot(name)
    }
  })
  it('serves one stylesheet, fluid (no fixed pixel widths)', async () => {
    const css = await get(`${await serve(miniCorpus)}/w/site.css`)
    expect(css.type).toContain('text/css')
    expect(css.text).not.toMatch(/(?<!max-)width:\d+px/)
  })
  it('404s unknown publishers and articles as HTML; the agent JSON route is untouched', async () => {
    const base = await serve(miniCorpus)
    expect((await get(`${base}/w/nobody/`)).status).toBe(404)
    expect((await get(`${base}/w/load-factor/blog/nope`)).status).toBe(404)
    const json = await fetch(`${base}/w/load-factor/articles/${free.articleId}`)
    expect(json.headers.get('content-type')).toContain('application/json')
    const x402 = await fetch(`${base}/w/${paid.publisherSlug}/articles/${paid.articleId}`)
    expect(x402.status).toBe(402)
  })
  it('renders the roster with zero articles', async () => {
    const base = await serve({ ...miniCorpus, articles: [] })
    for (const p of miniCorpus.publishers) expect((await get(`${base}/w/${p.slug}/`)).status).toBe(200)
    expect((await get(`${base}/w/`)).text).toContain('none yet')
  })
  it('escapes all corpus text', async () => {
    const evil = '<img src=x onerror=alert(1)>"&'
    const publisher = { ...miniCorpus.publishers[0], name: evil, heroQuote: evil, bio: evil }
    const article = { ...free, title: evil, passages: free.passages.map((p, i) => i ? p : { ...p, heading: evil, text: evil }) }
    const base = await serve({ ...miniCorpus, publishers: [publisher, ...miniCorpus.publishers.slice(1)], articles: [article, ...miniCorpus.articles.filter(a => a !== free)] })
    for (const path of ['/w/load-factor/', `/w/load-factor/blog/${free.articleId}`, '/w/load-factor/about', '/w/']) {
      const { text } = await get(base + path)
      expect(text, path).not.toContain('<img')
      expect(text, path).toContain('&lt;img src=x onerror=alert(1)&gt;&quot;&amp;')
    }
  })
})

describe('passage anchors (#147)', () => {
  it('articleUrl builds the human path', () => {
    expect(articleUrl('a', 'b')).toBe('/w/a/blog/b')
    expect(articleUrl('a', 'b', 'p1')).toBe('/w/a/blog/b#p-p1')
  })
  it('every FREE passage has its anchor on the page', async () => {
    const base = await serve(miniCorpus)
    for (const a of miniCorpus.articles.filter(x => x.tier === 'FREE')) {
      const { text } = await get(base + articleUrl(a.publisherSlug, a.articleId))
      for (const p of a.passages) expect(text, `${a.articleId} ${p.id}`).toContain(`id="p-${p.id}"`)
    }
  })
})

describe('/w index (#148)', () => {
  it('lists every publisher with domain, kind, lanes and writer count', async () => {
    const { text } = await get(`${await serve(miniCorpus)}/w/`)
    for (const p of miniCorpus.publishers) {
      expect(text).toContain(`href="/w/${p.slug}/"`)
      expect(text).toContain(p.domain)
    }
    expect(text).toMatch(/writers?/)
  })
  it('is linked from every blog footer', async () => {
    const { text } = await get(`${await serve(miniCorpus)}/w/load-factor/contact`)
    expect(text).toContain('<a href="/w/">')
  })
})
