// Build the finals pitch deck into ONE self-contained HTML file that opens by double-click (file://).
//   node scripts/pitch-build.mjs                 → pitch/src/** → pitch/index.html
//   node scripts/pitch-build.mjs pitch      → same, explicit deck dir
//   node scripts/pitch-build.mjs --watch         → rebuild on every change under src/
//
// Sources (see pitch/src/SYSTEM.md):
//   src/base.css        tokens + shared components (url() relative to src/)
//   src/deck.js         runtime: stage, navigation, steps, markers, print
//   src/icons.svg       icon sprite, injected at the top of <body>
//   src/slides/NN-*.html one file per slide: one <section class="slide" id="sNN-as-number">, plus optional
//                       <style> (every selector scoped to #sN) and <script> (wrapped in its own function scope)
// Every <img src>, CSS url() and <img data-inline src="x.svg"> (replaced by the SVG markup itself) is resolved
// relative to the file that references it and inlined, so the output makes no requests at all.
import { readFileSync, writeFileSync, readdirSync, existsSync, watch } from 'node:fs'
import { dirname, extname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const deckDir = resolve(args.find(a => !a.startsWith('--')) ?? join(root, 'pitch'))
const src = join(deckDir, 'src')
const out = join(deckDir, 'index.html')

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' }

export function build() {
  const errors = [], warnings = []
  const dataUri = (ref, fromDir, where) => {
    if (/^(data:|#|https?:)/.test(ref)) { if (/^https?:/.test(ref)) errors.push(`${where}: external reference ${ref}`); return ref }
    const file = resolve(fromDir, ref)
    if (!existsSync(file)) { errors.push(`${where}: missing asset ${ref} (${relative(root, file)})`); return ref }
    const type = MIME[extname(file).toLowerCase()]
    if (!type) { errors.push(`${where}: unknown asset type ${ref}`); return ref }
    return `data:${type};base64,${readFileSync(file).toString('base64')}`
  }
  const inlineCss = (css, fromDir, where) => css.replace(/url\((['"]?)([^'")]+)\1\)/g, (_, q, ref) => `url("${dataUri(ref.trim(), fromDir, where)}")`)
  const inlineHtml = (html, fromDir, where) => html
    .replace(/<img\b([^>]*?)\bdata-inline\b([^>]*?)>/g, (_, a, b) => {
      const attrs = a + b, ref = attrs.match(/\bsrc="([^"]+)"/)?.[1]
      const file = ref && resolve(fromDir, ref)
      if (!file || !existsSync(file)) { errors.push(`${where}: missing inline svg ${ref}`); return '' }
      const cls = attrs.match(/\bclass="([^"]*)"/)?.[1]
      let svg = readFileSync(file, 'utf8').replace(/<\?xml[^>]*>\s*/, '').trim()
      svg = svg.replace(/\s(role|aria-label)="[^"]*"/g, '').replace(/^<svg\b/, `<svg aria-hidden="true"${cls ? ` class="${cls}"` : ''}`)
      return svg
    })
    .replace(/(<img\b[^>]*?\bsrc=")([^"]+)"/g, (_, pre, ref) => `${pre}${dataUri(ref, fromDir, where)}"`)
    .replace(/style="([^"]*url\([^"]*)"/g, (_, s) => `style="${inlineCss(s.replace(/&quot;/g, '"'), fromDir, where).replace(/"/g, "'")}"`)

  // a light scope check: every selector in a slide's <style> must mention its own #sN
  const checkScope = (css, id, where) => {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
    let depth = 0, buf = '', inKeyframes = 0
    for (const ch of clean) {
      if (ch === '{') {
        const sel = buf.trim(); buf = ''
        if (sel.startsWith('@')) { if (/^@(-webkit-)?keyframes/.test(sel)) inKeyframes = depth + 1 }
        else if (!(inKeyframes && depth >= inKeyframes)) {
          for (const s of sel.split(',')) if (!s.includes(`#${id}`)) warnings.push(`${where}: selector "${s.trim()}" is not scoped to #${id}`)
        }
        depth++
      } else if (ch === '}') { depth--; if (inKeyframes && depth < inKeyframes) inKeyframes = 0; buf = '' }
      else if (ch === ';' && depth > 0) buf = ''
      else buf += ch
    }
  }

  const files = readdirSync(join(src, 'slides')).filter(f => /^\d\d-.+\.html$/.test(f)).sort()
  if (!files.length) errors.push('no slides in src/slides/')
  const styles = [], sections = [], scripts = [], seen = new Set()
  for (const f of files) {
    const where = `slides/${f}`, dir = join(src, 'slides')
    let html = readFileSync(join(dir, f), 'utf8')
    const id = `s${parseInt(f, 10)}`
    if (seen.has(id)) errors.push(`${where}: duplicate slide number`)
    seen.add(id)
    html = html.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => { checkScope(css, id, where); styles.push(`/* ${f} */\n${inlineCss(css.trim(), dir, where)}`); return '' })
    html = html.replace(/<script>([\s\S]*?)<\/script>/g, (_, js) => { scripts.push(`/* ${f} */\n;(() => {\n${js.trim()}\n})()`); return '' })
    html = html.trim()
    const secs = html.match(/<section\b[^>]*\bclass="[^"]*\bslide\b[^"]*"[^>]*>/g) ?? []
    if (secs.length !== 1) errors.push(`${where}: needs exactly one <section class="slide">, found ${secs.length}`)
    else if (!new RegExp(`\\bid="${id}"`).test(secs[0])) errors.push(`${where}: the section's id must be "${id}" (from the file number)`)
    sections.push(inlineHtml(html, dir, where))
  }

  const base = inlineCss(readFileSync(join(src, 'base.css'), 'utf8'), src, 'base.css')
  const icons = readFileSync(join(src, 'icons.svg'), 'utf8').replace(/<!--[\s\S]*?-->\s*/, '').trim()
  const deck = readFileSync(join(src, 'deck.js'), 'utf8')
  const html = `<!doctype html>
<!-- Built by scripts/pitch-build.mjs from pitch/src/. Do not edit this file; edit the sources and rebuild. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ResearchAgent · Finals</title>
<style>
${base.trim()}

${styles.join('\n\n')}
</style>
</head>
<body>
${icons}
<div id="stage">

${sections.join('\n\n')}

</div>
<script>
${deck.trim()}

${scripts.join('\n\n')}

Deck.start()
</script>
</body>
</html>
`
  // nothing in the output may reach the network
  for (const m of html.matchAll(/(?:\bsrc=|\bhref=|url\()["']?(https?:[^"')\s]+)/g)) errors.push(`output references ${m[1]}`)
  return { html, errors, warnings, slides: files.length }
}

function run() {
  const { html, errors, warnings, slides } = build()
  for (const w of warnings) console.warn(`pitch-build: warning: ${w}`)
  if (errors.length) { console.error(`pitch-build: failed:\n  ${errors.join('\n  ')}`); return false }
  writeFileSync(out, html)
  console.log(`pitch-build: ${slides} slides → ${relative(process.cwd(), out)} (${(html.length / 1024).toFixed(0)} KB, self-contained)`)
  return true
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ok = run()
  if (args.includes('--watch')) {
    let t
    watch(src, { recursive: true }, () => { clearTimeout(t); t = setTimeout(run, 80) })
    console.log(`pitch-build: watching ${relative(process.cwd(), src)}/`)
  } else if (!ok) process.exitCode = 1
}
