// Caption overlays as transparent PNGs, rendered with the app's own Geist fonts: the label bar (what is real),
// the voice-over subtitle, the real-time clock for sped-up footage, and the recording cues. Cached by content.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { fontFaceCss } from './cards.mjs'

const esc = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const CSS = `${fontFaceCss()}
  html,body{margin:0;background:transparent;font-family:'Geist',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .box{display:inline-block;box-sizing:border-box}
  .bar{display:inline-flex;align-items:center;gap:12px;max-width:1500px;padding:11px 22px 11px 18px;border-radius:14px;background:rgba(255,255,255,.95);border:1px solid rgba(30,27,24,.16);box-shadow:0 6px 22px rgba(30,27,24,.14);color:#1d1b19;font-size:24px;line-height:1.3;font-weight:500;letter-spacing:-.005em}
  .bar i{flex:none;width:10px;height:10px;border-radius:50%;background:#2f7a3a}
  .sub{max-width:1280px;padding:12px 28px;border-radius:12px;background:rgba(24,22,20,.82);color:#fff;font-size:35px;line-height:1.28;font-weight:500;text-align:center;letter-spacing:-.005em}
  .clock{display:inline-flex;align-items:center;gap:12px;padding:10px 20px;border-radius:14px;background:rgba(24,22,20,.86);color:#fff;font:600 26px 'Geist Mono',monospace;letter-spacing:.01em}
  .clock span{font:500 20px 'Geist',sans-serif;opacity:.78;letter-spacing:0}
  .cue{max-width:1500px;padding:14px 26px;border-radius:14px;background:rgba(24,22,20,.88);color:#fff;font-size:27px;line-height:1.4;white-space:pre-line}
  .cue b{display:block;font:600 21px 'Geist Mono',monospace;color:#9fd6a8;margin-bottom:6px;letter-spacing:.02em}
  .tc{display:inline-block;padding:8px 16px;border-radius:12px;background:rgba(24,22,20,.86);color:#fff;font:600 24px 'Geist Mono',monospace}`

export async function overlayRenderer(dir) {
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage()
  const shell = join(dir, 'shell.html')
  writeFileSync(shell, `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div id="root" style="position:absolute;left:0;top:0"></div>`)
  await page.goto(pathToFileURL(shell).href)
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => Promise.all([document.fonts.load("500 24px 'Geist'"), document.fonts.load("600 26px 'Geist Mono'")]))
  const render = async (html, key) => {
    const file = join(dir, `${createHash('sha1').update(key + html).digest('hex').slice(0, 14)}.png`)
    if (existsSync(file)) return file
    await page.evaluate(h => { document.getElementById('root').innerHTML = h }, html)
    await page.locator('#root > *').first().screenshot({ path: file, omitBackground: true })
    return file
  }
  const size = async file => { const { width, height } = await page.evaluate(src => new Promise(done => { const i = new Image(); i.onload = () => done({ width: i.naturalWidth, height: i.naturalHeight }); i.src = src }), pathToFileURL(file).href); return { w: width, h: height } }
  const tagged = async (file) => ({ file, ...(await size(file)) })
  return {
    bar: async text => tagged(await render(`<div class="box bar"><i></i><span>${esc(text)}</span></div>`, 'bar')),
    subtitle: async lines => tagged(await render(`<div class="box sub">${lines.map(esc).join('<br>')}</div>`, 'sub')),
    clock: async text => tagged(await render(`<div class="box clock"><span>real time</span>${esc(text)}</div>`, 'clock')),
    cue: async (head, text) => tagged(await render(`<div class="box cue"><b>${esc(head)}</b>${esc(text)}</div>`, 'cue')),
    timecode: async text => tagged(await render(`<div class="box tc">${esc(text)}</div>`, 'tc')),
    close: () => browser.close(),
  }
}
