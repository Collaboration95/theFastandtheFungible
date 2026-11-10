// One header for the explainers site (#272). Run: node scripts/site-header.mjs [--check]
// Writes the same self-contained header block (markup + scoped CSS) between
// <!-- site-header:start --> and <!-- site-header:end --> right after <body> on each page.
// --check exits 1 if any page is out of date (used by repo-hygiene). Offline, no dependencies.
// Presentation tools reserve 52 px for the same header.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

import { HOSTED_APP_URL } from './site-config.mjs'
const REPO = 'https://github.com/Collaboration95/theFastandtheFungible'
// Discover every page, including future verify pages, instead of silently skipping new routes.
const siteRoot = join(import.meta.dirname, '..', 'site')
const keys = { 'notes/index.html': 'notes', 'index.html': 'home', 'progress/index.html': 'progress', 'talk/index.html': 'talk', 'slides/index.html': 'slides', 'project-map/index.html': 'map', 'evolution/index.html': 'build', 'ledger/index.html': 'ledger', 'proof/index.html': 'proof', 'developers/index.html': 'developers', 'builder-feedback/index.html': 'feedback' }
const PAGES = readdirSync(siteRoot, { recursive: true }).filter(file => file.endsWith('.html') && !file.startsWith('demo/')).map(file => ({ file, key: keys[file] ?? 'none' })).concat([{ file: '../demo/index.html', key: 'demo' }])

// Six pages plus GitHub and "Try it live" (S10); the brand mark is the way home. Secondary pages live in the footer.
const NAV = [
  ['demo', 'demo/', 'Replay'], ['talk', 'talk/#key-reveal', 'How it works'],
  ['proof', 'proof/', 'Proof'], ['progress', 'progress/', 'Progress'],
  ['developers', 'developers/', 'Developers'], ['feedback', 'builder-feedback/', 'Builder feedback'],
]
const MORE = [
  ['ledger', 'ledger/', 'Testnet ledger'], ['map', 'project-map/', 'Project map'],
  ['build', 'evolution/', 'October build log'], ['slides', 'slides/', 'October talk slides'],
]
// Presentation and app pages fill the viewport; they keep the header but get no footer.
const NO_FOOTER = new Set(['demo', 'slides', 'notes'])
const ENVIRONMENT = 'Testnet · test funds'
const START = '<!-- site-header:start -->'
const END = '<!-- site-header:end -->'
const FOOT_START = '<!-- site-footer:start -->'
const FOOT_END = '<!-- site-footer:end -->'

const CSS = `@font-face{font-family:Geist;src:url("__UP__brand/geist-latin-wght-normal.woff2")}
.ra-hdr{box-sizing:border-box;height:52px;position:sticky;top:0;z-index:50;background:rgba(251,248,242,.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:1px solid #E8E2D8;font:500 14px/1 Geist,system-ui,-apple-system,"Segoe UI",sans-serif;color:#24211E}
.ra-hdr *{box-sizing:border-box}
.ra-hdr-in{max-width:1180px;margin:0 auto;padding:0 16px;height:51px;display:flex;align-items:center;gap:20px}
.ra-hdr a{color:inherit;text-decoration:none}
.ra-hdr-brand{display:flex;align-items:center;gap:9px;font-weight:600;font-size:15px;letter-spacing:-.01em;flex:none}
.ra-hdr-brand svg{width:22px;height:22px;display:block}
.ra-hdr nav{display:flex;gap:2px;flex:1;min-width:0}
.ra-hdr nav a{padding:8px 10px;border-radius:6px;color:#655D55;white-space:nowrap}
.ra-hdr nav a:hover{color:#24211E;background:rgba(36,33,30,.06)}
.ra-hdr nav a[aria-current=page]{color:#24211E;box-shadow:inset 0 -2px 0 #24211E;border-radius:0}
.ra-hdr-end{display:flex;align-items:center;gap:14px;flex:none;color:#655D55;font-size:13px}
.ra-hdr-end a:hover{color:#24211E}
.ra-hdr-note{font-family:Geist,system-ui,sans-serif;font-size:12px;color:#655D55;white-space:nowrap}
.ra-hdr-note kbd{font:600 12px Geist,system-ui,sans-serif;border:1px solid #C9BFB2;border-bottom-width:2px;border-radius:6px;padding:1px 5px;background:#fff;color:#24211E}
.ra-hdr nav:focus-visible,.ra-hdr a:focus-visible{outline:2px solid #24211E;outline-offset:2px}
.ra-hdr .ra-live{background:#24211E;color:#fff;padding:9px;border-radius:6px} body{font-family:Geist,system-ui,sans-serif} [tabindex="0"]:focus-visible{outline:2px solid #24211E;outline-offset:2px}
.ra-hdr-menu{display:none;position:relative}
.ra-hdr-menu summary{list-style:none;cursor:pointer;padding:8px 10px;border:1px solid #C9BFB2;border-radius:6px;color:#24211E;background:#fff}
.ra-hdr-menu summary::-webkit-details-marker{display:none}
.ra-hdr-menu div{position:absolute;right:0;top:calc(100% + 8px);min-width:220px;display:grid;padding:8px;background:#FBF8F2;border:1px solid #E8E2D8;border-radius:8px;box-shadow:0 12px 32px -16px rgba(36,33,30,.35)}
.ra-hdr-menu div a{padding:10px 12px;border-radius:6px;color:#24211E}
.ra-hdr-menu div a[aria-current=page]{background:rgba(36,33,30,.06)}
@media(max-width:860px){.ra-hdr-note{display:none}}
@media(max-width:940px){.ra-hdr nav,.ra-hdr-end .ra-hdr-gh{display:none}.ra-hdr-menu{display:block}.ra-hdr-end{margin-left:auto}}
@media(max-width:600px){.ra-hdr-in{gap:10px}.ra-hdr-brand span{display:none}}
@media print{.ra-hdr{display:none}}`

// The mark: 24-unit grid, 1.5 stroke (design/brand/mark.svg).
const MARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v16h5M15 4h5v16h-5M9 15l6-6" fill="none" stroke="#24211E" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"/></svg>'

function block(page) {
  const depth = page.key === 'demo' ? 1 : page.file.split('/').length - 1
  const up = '../'.repeat(depth)
  // One navigation on every page, including the ledger (F-10).
  const links = NAV.map(([key, href, label]) =>
    `<a href="${up}${href}"${key === page.key ? ' aria-current="page"' : ''}>${label}</a>`).join('')
  const note = page.note ? `<span class="ra-hdr-note">${page.note}</span>` : ''
  return `${START}
<style>${CSS.replaceAll('__UP__', up)}</style>
<div class="ra-hdr" role="${page.key === 'demo' ? 'region' : 'banner'}"${page.key === 'demo' ? ' aria-label="Site navigation"' : ''}><div class="ra-hdr-in">
<a class="ra-hdr-brand" href="${up}index.html" aria-label="ResearchAgent explainers home">${MARK}<span>ResearchAgent</span></a>
<nav aria-label="Explainers">${links}</nav>
<div class="ra-hdr-end">${note}<a class="ra-live" href="${HOSTED_APP_URL}">Try it live</a><a class="ra-hdr-gh" href="${REPO}">GitHub</a><details class="ra-hdr-menu"><summary>Menu</summary><div>${links}<a href="${REPO}">GitHub</a></div></details></div>
</div></div>
${END}`
}

function footer(page) {
  const up = '../'.repeat(page.file.split('/').length - 1)
  const more = MORE.map(([key, href, label]) => `<a href="${up}${href}"${key === page.key ? ' aria-current="page"' : ''}>${label}</a>`)
    // No blob/main links here: the ledger page allows only commit-pinned evidence links (the deck has its own home card).
    .concat([`<a href="${REPO}#readme">README</a>`, `<a href="${REPO}/releases">Releases</a>`]).join('')
  return `${FOOT_START}
<style>.ra-ftr{border-top:1px solid #E8E2D8;margin-top:48px;font:400 14px/1.5 Geist,system-ui,-apple-system,"Segoe UI",sans-serif;color:#655D55}
.ra-ftr-in{max-width:1180px;margin:0 auto;padding:28px 16px 40px;display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px}
.ra-ftr-env{display:inline-flex;align-items:center;gap:8px;padding:4px 12px;border:1px solid #C9BFB2;border-radius:999px;color:#24211E;background:#fff;white-space:nowrap}
.ra-ftr-env::before{content:"";width:8px;height:8px;border-radius:50%;background:#C98500}
.ra-ftr nav{display:flex;flex-wrap:wrap;gap:4px 18px}
.ra-ftr a{color:inherit;text-decoration:none}.ra-ftr a:hover,.ra-ftr a[aria-current=page]{color:#24211E;text-decoration:underline;text-underline-offset:4px}
.ra-ftr a:focus-visible{outline:2px solid #24211E;outline-offset:2px}
@media print{.ra-ftr{display:none}}</style>
<footer class="ra-ftr"><div class="ra-ftr-in"><span class="ra-ftr-env">${ENVIRONMENT}</span><nav aria-label="More pages">${more}</nav></div></footer>
${FOOT_END}`
}

const check = process.argv.includes('--check')
const root = join(import.meta.dirname, '..', 'site')
let stale = 0
for (const page of PAGES) {
  const path = join(root, page.file)
  const html = readFileSync(path, 'utf8')
  const wanted = block(page)
  let next
  if (html.includes(START)) {
    next = html.slice(0, html.indexOf(START)) + wanted + html.slice(html.indexOf(END) + END.length)
  } else {
    const m = html.match(/<body[^>]*>/)
    if (!m) throw new Error(`${page.file}: no <body>`)
    next = html.slice(0, m.index + m[0].length) + '\n' + wanted + html.slice(m.index + m[0].length)
  }
  // The secondary pages and the environment pill, once, just before </body>.
  if (next.includes(FOOT_START)) next = next.slice(0, next.indexOf(FOOT_START)) + next.slice(next.indexOf(FOOT_END) + FOOT_END.length + 1)
  if (!NO_FOOTER.has(page.key)) next = next.replace(/<\/body>/i, `${footer(page)}\n</body>`)
  // Brand metadata is checked for every discovered page.
  for (const token of ['brand/favicon.svg', 'property="og:image"', 'property="og:url"']) {
    if (!next.includes(token)) throw new Error(`${page.file}: missing ${token}; update brand metadata`)
  }
  if (next === html) continue
  stale++
  if (check) console.error(`site-header: ${page.file} is out of date; run node scripts/site-header.mjs`)
  else writeFileSync(path, next)
}
if (check && stale) process.exit(1)
console.log(check ? 'site-header: ok' : `site-header: updated ${stale} page${stale === 1 ? '' : 's'}`)

if (check) execFileSync(process.execPath, [join(import.meta.dirname, 'site-meta.mjs'), '--check'], { stdio: 'inherit' })
