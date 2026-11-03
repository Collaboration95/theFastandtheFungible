// Export the SingHacks finals deck to PDF, plus one PNG per slide for a visual check.
//   node docs/submission/deck/export.mjs            → docs/submission/ResearchAgent-SFF-deck.pdf
//                                                     and scratch/deck-png/slide-NN.png (ignored)
//   node docs/submission/deck/export.mjs --no-png   → PDF only
// Offline: fonts come from node_modules (@fontsource-variable), images from the repo.
// Fails if any slide's content overflows its 1920 × 1080 frame.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')
const pdfPath = join(root, 'docs/submission/ResearchAgent-SFF-deck.pdf')
const pngDir = join(root, 'scratch/deck-png')
const wantPng = !process.argv.includes('--no-png')

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(here, 'index.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)

  const overflow = await page.$$eval('.slide', slides => slides.flatMap((s, i) => {
    const box = s.getBoundingClientRect()
    const bad = [...s.querySelectorAll('*')].filter(el => {
      if (el.closest('.src')) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && (r.bottom > box.bottom - 70 || r.right > box.right + 1)
    })
    return bad.length ? [`slide ${i + 1}: ${bad.length} element(s) overflow, e.g. <${bad[0].tagName.toLowerCase()}> "${bad[0].textContent.trim().slice(0, 60)}"`] : []
  }))
  const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family))
  if (!fonts.some(f => f.includes('Geist'))) console.warn('warning: Geist did not load; run npm ci first')

  if (wantPng) {
    mkdirSync(pngDir, { recursive: true })
    const slides = await page.$$('.slide')
    for (const [i, el] of slides.entries()) {
      await el.screenshot({ path: join(pngDir, `slide-${String(i + 1).padStart(2, '0')}.png`) })
    }
    console.log(`${slides.length} PNGs → ${pngDir}`)
  }

  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: pdfPath, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true })
  console.log(`PDF → ${pdfPath}`)

  if (overflow.length) {
    console.error(overflow.join('\n'))
    process.exitCode = 1
  }
} finally {
  await browser.close()
}
