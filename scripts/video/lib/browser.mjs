// Records one browser scene at 1920×1080, 30 fps, from Playwright's screencast frames (JPEG, near-lossless).
// Frames are resampled to a constant frame rate by wall clock and piped to ffmpeg, so a clip's time axis is
// real time: the sidecar's `marks` (ms from the first frame) line up with the video for the assembler.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { CLIPS, FPS, VIEWPORT, sleep } from '../config.mjs'

// A visible pointer: Playwright's video never draws one. Drawn in the page, so it is part of every frame.
const CURSOR = `(() => {
  const mount = () => {
    if (document.getElementById('__ra_cursor')) return
    const el = document.createElement('div'); el.id = '__ra_cursor'
    el.style.cssText = 'position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-80px,-80px);will-change:transform'
    el.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"><path d="M3 2l17 8.5-7 2.1-2.6 7.2z" fill="#1d1b19" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    const ring = document.createElement('div')
    ring.style.cssText = 'position:absolute;left:-12px;top:-12px;width:24px;height:24px;border-radius:50%;border:2px solid rgba(29,27,25,.55);opacity:0;transition:opacity .25s,transform .25s;transform:scale(.6)'
    el.appendChild(ring); document.documentElement.appendChild(el)
    addEventListener('mousemove', e => { el.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)' }, true)
    addEventListener('mousedown', () => { ring.style.opacity = '1'; ring.style.transform = 'scale(1)' }, true)
    addEventListener('mouseup', () => { ring.style.opacity = '0'; ring.style.transform = 'scale(.6)' }, true)
  }
  if (document.documentElement) mount(); else addEventListener('DOMContentLoaded', mount)
})()`

const ease = k => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2

/**
 * Record `run(rec)` as clip `<id>.mp4` plus `<id>.json` (marks, labels, notes) in the clips folder.
 * `rec` offers gentle, deterministic interaction helpers; every wait is on a condition, never on luck.
 */
export async function recordScene({ id, contextOptions = {}, source, labels = {}, run, outDir = CLIPS }) {
  mkdirSync(outDir, { recursive: true })
  const file = join(outDir, `${id}.mp4`)
  const browser = await chromium.launch({ headless: true, args: ['--hide-scrollbars', '--disable-features=Translate'] })
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, colorScheme: 'light', locale: 'en-SG', timezoneId: 'Asia/Singapore', ...contextOptions })
  await context.addInitScript(CURSOR)
  const page = await context.newPage()

  const ffmpeg = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-an',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', file], { stdio: ['pipe', 'ignore', 'pipe'] })
  let ffmpegError = ''
  ffmpeg.stderr.on('data', d => { ffmpegError += d })
  const ffmpegDone = new Promise(done => ffmpeg.on('close', done))

  let latest, written = 0, t0 = 0, ticker
  const pump = () => {
    if (!latest || ffmpeg.stdin.writableNeedDrain) return
    const due = Math.floor((Date.now() - t0) * FPS / 1000) + 1
    while (written < due) { ffmpeg.stdin.write(latest); written++ }
  }
  const marks = {}, notes = []
  const pos = { x: 960, y: 540 }
  const rec = {
    page, marks, notes, labels,
    now: () => Date.now() - t0,
    mark(name) { marks[name] = Date.now() - t0; return marks[name] },
    note(text) { notes.push(text); console.log(`  [${id}] ${text}`) },
    hold: ms => sleep(ms),
    /** Glide the pointer to a point with ease-in-out, ~60 events a second. */
    async glide(x, y, ms = 900) {
      const from = { ...pos }, steps = Math.max(8, Math.round(ms / 16))
      for (let i = 1; i <= steps; i++) {
        const e = ease(i / steps)
        await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e)
        await sleep(ms / steps)
      }
      pos.x = x; pos.y = y
    },
    async glideTo(locator, ms = 900, anchor = { x: 0.5, y: 0.5 }) {
      await locator.scrollIntoViewIfNeeded()
      const box = await locator.boundingBox()
      if (!box) throw new Error('target has no box')
      await rec.glide(box.x + box.width * anchor.x, box.y + box.height * anchor.y, ms)
    },
    async click(locator, ms = 900) {
      await rec.glideTo(locator, ms)
      await sleep(180)
      await page.mouse.down(); await sleep(90); await page.mouse.up()
      await sleep(250)
    },
    /** Type like a person in a hurry: steady 28 ms keystrokes. */
    async type(locator, text, delay = 28) {
      await locator.focus()
      await page.keyboard.type(text, { delay })
    },
    /** Scroll the page (or an element's scroll container) to `top` with easing. */
    async scrollTo(top, ms = 1400) {
      await page.evaluate(({ top, ms }) => new Promise(done => {
        const el = document.scrollingElement, from = el.scrollTop, t = performance.now()
        const step = now => { const k = Math.min(1, (now - t) / ms); const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; el.scrollTop = from + (top - from) * e; k < 1 ? requestAnimationFrame(step) : done() }
        requestAnimationFrame(step)
      }), { top, ms })
    },
    /** Bring an element to `offset` px below the top of its nearest scrollable container, gently. */
    async scrollIntoView(locator, ms = 1200, offset = 200) {
      await locator.evaluate((el, { ms, offset }) => new Promise(done => {
        const scrollable = start => { for (let n = start; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) return n } return document.scrollingElement }
        const box = scrollable(el), page = box === document.scrollingElement
        const gap = el.getBoundingClientRect().top - (page ? 0 : box.getBoundingClientRect().top)
        const from = box.scrollTop, to = Math.max(0, from + gap - offset), t = performance.now()
        const step = now => { const k = Math.min(1, (now - t) / ms); const e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; box.scrollTop = from + (to - from) * e; k < 1 ? requestAnimationFrame(step) : done() }
        requestAnimationFrame(step)
      }), { ms, offset })
    },
  }

  let failed
  await page.screencast.start({ size: VIEWPORT, quality: 95, onFrame: f => {
    latest = f.data
    if (!t0) { t0 = Date.now(); ticker = setInterval(pump, 8) }
  } })
  try {
    // The first frame defines t = 0, so marks and clip agree.
    for (let i = 0; i < 200 && !t0; i++) { await page.evaluate(() => { document.documentElement.dataset.raTick = String(Math.random()) }).catch(() => undefined); await sleep(25) }
    await run(rec)
    await sleep(400)
  } catch (error) {
    failed = error
    // Keep what the page showed, so a failed take can be diagnosed without re-running it.
    await page.screenshot({ path: join(outDir, `${id}.failed.png`) }).catch(() => undefined)
    notes.push(`page at failure: ${page.url()}`)
  } finally {
    clearInterval(ticker); pump()
    await page.screencast.stop().catch(() => undefined)
    ffmpeg.stdin.end()
    await ffmpegDone
    await browser.close()
  }
  const durationMs = Date.now() - t0
  const sidecar = { id, source, durationMs, fps: FPS, marks, notes, labels, ok: !failed, error: failed ? String(failed.message ?? failed) : undefined }
  writeFileSync(join(outDir, `${id}.json`), JSON.stringify(sidecar, null, 2) + '\n')
  if (failed) throw Object.assign(new Error(`${id}: ${failed.message ?? failed}${ffmpegError ? `\n${ffmpegError}` : ''}`), { sidecar })
  return sidecar
}
