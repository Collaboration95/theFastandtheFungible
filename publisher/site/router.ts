// Server-rendered personal-blog sites for every publisher (#145-#148). Plain template strings, no scripts.
// Gate 1: a PAID article page renders abstract + badge only, never body or passages.
import { Router } from 'express'
import { articleUrl } from '../../shared/contracts/manifest.js'
import type { Article } from '../../shared/contracts/writers.js'
import type { PublisherEntry } from '../registry.js'
import { SITE_CSS } from './css.js'

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const sgd = (minor: number) => `S$${(minor / 100).toFixed(2)}`
const date = (iso: string) => esc(iso.slice(0, 10))
const CSP = "default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'"

const page = (title: string, nav: string, main: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="/w/site.css"></head>
<body>${nav}<main>${main}</main>
<footer><span>SYNTHETIC · fictional writer. Nothing here is real reporting.</span><a href="/w/">The web the engine searches</a></footer></body></html>
`

const navFor = ({ publisher }: PublisherEntry) => {
  const base = `/w/${esc(publisher.slug)}`
  return `<nav><a class="name" href="${base}/">${esc(publisher.name)}</a><div class="mid"><a href="${base}/">Blogs</a><a href="${base}/about">About</a></div><div class="right"><a href="${base}/contact">Contact</a></div></nav>`
}

const homePage = (entry: PublisherEntry) => {
  const { publisher, articles } = entry
  const rows = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map(a =>
    `<li><time datetime="${esc(a.publishedAt)}">${date(a.publishedAt)}</time><span><a href="${esc(articleUrl(a.publisherSlug, a.articleId))}">${esc(a.title)}</a>${a.tier === 'PAID' ? `<span class="tag">402 · ${sgd(a.priceMinor)}</span>` : ''}</span></li>`).join('')
  return page(publisher.name, navFor(entry), `<p class="hero">${esc(publisher.heroQuote)}</p><ul class="rows">${rows || '<li class="note">No posts yet.</li>'}</ul>`)
}

const paragraphs = (a: Article) => a.passages.map(p =>
  `${p.heading ? `<h2>${esc(p.heading)}</h2>` : ''}<p id="p-${esc(p.id)}">${esc(p.text)}</p>`).join('')

const articlePage = (entry: PublisherEntry, a: Article) => {
  const writer = entry.writers.find(w => w.slug === a.writerSlug)
  const head = `<div class="kicker">Latest Post</div><h1>${esc(a.title)}</h1><p class="by">By ${esc(writer?.name ?? a.writerSlug)} · <time datetime="${esc(a.publishedAt)}">${date(a.publishedAt)}</time></p>`
  const body = a.tier === 'FREE'
    ? paragraphs(a)
    : `<p class="abstract">${esc(a.abstract)}</p><div class="badge">402 · agents pay ${sgd(a.priceMinor)} · XRPL Testnet</div><p class="note">The full text is sold to agents, per article, over x402. This page shows the abstract only.</p>`
  return page(a.title, navFor(entry), head + body)
}

const aboutPage = (entry: PublisherEntry) => {
  const { publisher, writers } = entry
  const prices = Object.entries(publisher.prices).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${sgd(v)}</dd>`).join('')
  const wallet = publisher.wallet ? `<h2>Wallet</h2><p><a href="https://testnet.xrpl.org/accounts/${esc(publisher.wallet)}" rel="noopener">${esc(publisher.wallet)}</a><br><span class="note">XRPL Testnet, no real funds.</span></p>` : ''
  return page(`About · ${publisher.name}`, navFor(entry), `<h1>About</h1><p>${esc(publisher.bio)}</p><p class="note">${esc(publisher.domain)} · ${esc(publisher.kind)}</p>
<h2>Writers</h2><ul class="rows">${writers.map(w => `<li><strong>${esc(w.name)}</strong><span>${esc(w.bio)}</span></li>`).join('')}</ul>
<h2>Price list</h2>${prices ? `<dl>${prices}</dl>` : '<p class="note">Everything here is free.</p>'}
<h2>Licence</h2><p>${esc(publisher.licence)}</p>${wallet}`)
}

const contactPage = (entry: PublisherEntry) => page(`Contact · ${entry.publisher.name}`, navFor(entry), `<h1>Contact</h1><p class="note">This is a synthetic publication. There is no inbox behind this page.</p>`)

const indexPage = (entries: PublisherEntry[]) => page('The web the engine searches', `<nav><a class="name" href="/w/">The web the engine searches</a><div class="mid"></div><div class="right"></div></nav>`,
  `<h1>The web the engine searches</h1><p class="note">Every publisher the research agent can search. All fictional.</p><ul class="rows">${entries.map(({ publisher, writers, articles }) => {
    const lanes = [...new Set(articles.map(a => a.tier === 'PAID' ? 'paid' : 'free'))].sort().join(' + ') || 'none yet'
    return `<li><span><a href="/w/${esc(publisher.slug)}/">${esc(publisher.name)}</a><br><span class="note">${esc(publisher.domain)} · ${esc(publisher.kind)} · ${esc(lanes)} · ${writers.length} writer${writers.length === 1 ? '' : 's'}</span></span></li>`
  }).join('')}</ul>`)

/** Mounted once by routes.ts after the writer registry is ready. */
export function siteRouter(getRegistry: () => Map<string, PublisherEntry>) {
  const router = Router()
  router.use('/w', (_req, res, next) => { res.set('Content-Security-Policy', CSP); next() })
  router.get('/w/site.css', (_req, res) => { res.type('text/css').send(SITE_CSS) })
  router.get('/w', (_req, res) => { res.type('html').send(indexPage([...getRegistry().values()])) })
  const notFound = (res: import('express').Response) => res.status(404).type('html').send(page('Not found', '', '<h1>Not found</h1><p class="note">No such page.</p>'))
  const site = (render: (e: PublisherEntry) => string) => (req: import('express').Request, res: import('express').Response) => {
    const entry = getRegistry().get(String(req.params.slug))
    if (!entry) { notFound(res); return }
    res.type('html').send(render(entry))
  }
  router.get('/w/:slug', site(homePage))
  router.get('/w/:slug/about', site(aboutPage))
  router.get('/w/:slug/contact', site(contactPage))
  router.get('/w/:slug/blog/:articleId', (req, res) => {
    const entry = getRegistry().get(String(req.params.slug))
    const a = entry?.articles.find(x => x.articleId === String(req.params.articleId))
    if (!entry || !a) { notFound(res); return }
    res.type('html').send(articlePage(entry, a))
  })
  return router
}
