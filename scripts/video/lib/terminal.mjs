// Terminal scenes: a REAL command session in tmux, sampled to a JSON transcript, then rendered to video.
// Nothing is mocked. The transcript holds every distinct screen the process produced (what tmux's own terminal
// emulator showed), with its time. Rendering turns each screen into a frame; timing is the real timing, and the
// assembler speeds waits up (with a real-time clock) rather than this file cutting anything.
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { FPS, PAPER, VIEWPORT, scratchDir, sleep } from '../config.mjs'
import { lineHtml, plain, redactLine, THEMES } from './ansi.mjs'
import { fontFaceCss } from './cards.mjs'
import { must, run } from './proc.mjs'

export const TERM = { cols: 112, rows: 28, font: 25, line: 31 }
const KEEP = ['PATH', 'HOME', 'USER', 'TMPDIR', 'LOGNAME']

/** The clean environment of a session: an allowlist plus the scene's own variables. No keys, no seeds. */
export function sessionEnv(extra = {}) {
  const env = { LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TERM: 'xterm-256color', COLORTERM: 'truecolor', PS1: '$ ', BASH_SILENCE_DEPRECATION_WARNING: '1' }
  for (const key of KEEP) if (process.env[key]) env[key] = process.env[key]
  return { ...env, ...extra }
}

/**
 * Run a scripted session. `script(t)` drives it with t.type / t.enter / t.key / t.waitFor / t.mark / t.sleep.
 * Writes <id>.transcript.json into outDir. Returns { frames, marks, durationMs }.
 */
export async function captureSession({ id, cwd, env, outDir, cols = TERM.cols, rows = TERM.rows, script, sampleMs = 90 }) {
  mkdirSync(outDir, { recursive: true })
  const work = scratchDir('tmux-')
  const sock = `ravid-${process.pid}-${id}`
  const conf = join(work, 'tmux.conf')
  writeFileSync(conf, ['set -g status off', 'set -g focus-events on', 'set -g escape-time 0', 'set -g history-limit 20000', 'set -g default-terminal "xterm-256color"', 'set -g exit-empty on'].join('\n') + '\n')
  const tmux = (...args) => run('tmux', ['-L', sock, '-f', conf, ...args])
  const pairs = Object.entries(sessionEnv(env)).map(([k, v]) => `${k}=${v}`)
  await must('tmux', ['-L', sock, '-f', conf, 'new-session', '-d', '-s', 'main', '-x', String(cols), '-y', String(rows), '-c', cwd, 'env', '-i', ...pairs, 'bash', '--noprofile', '--norc'])

  const frames = [], marks = {}
  const t0 = Date.now()
  let latest = { lines: [], plain: '' }, stop = false, lastKey = ''
  const sample = async () => {
    const { stdout, code } = await tmux('capture-pane', '-p', '-e', '-t', 'main', ';', 'display-message', '-p', '-t', 'main', '<<CUR>>#{cursor_x},#{cursor_y},#{cursor_flag}')
    if (code !== 0) return
    const parts = stdout.split('<<CUR>>')
    const [cx, cy, visible] = (parts[1] ?? '0,0,0').trim().split(',').map(Number)
    const lines = parts[0].replace(/\n$/, '').split('\n')
    while (lines.length < rows) lines.push('')
    const key = lines.join('\n') + `|${visible ? `${cx},${cy}` : 'x'}`
    latest = { lines, plain: lines.map(plain).join('\n') }
    if (key !== lastKey) { lastKey = key; frames.push({ t: Date.now() - t0, lines, cursor: visible ? { x: cx, y: cy } : null }) }
  }
  const sampler = (async () => { while (!stop) { await sample().catch(() => undefined); await sleep(sampleMs) } })()

  const t = {
    marks,
    mark: name => { marks[name] = Date.now() - t0; return marks[name] },
    sleep,
    screen: () => latest.plain,
    async key(...keys) { await must('tmux', ['-L', sock, '-f', conf, 'send-keys', '-t', 'main', ...keys]) },
    async enter() { await t.key('Enter') },
    /** Type at a steady, human pace (deterministic: 34 ms plus a small fixed wobble). */
    async type(text, { pace = 34 } = {}) {
      let i = 0
      for (const ch of text) { await must('tmux', ['-L', sock, '-f', conf, 'send-keys', '-t', 'main', '-l', ch]); await sleep(pace + (i++ % 5) * 6) }
    },
    /** Wait until the visible screen matches; `stableMs` also requires it to stop changing. Throws on timeout. */
    async waitFor(test, { timeout = 60_000, stableMs = 0, label = String(test), approve = [] } = {}) {
      const deadline = Date.now() + timeout
      let stableSince = 0, last = ''
      for (;;) {
        const screen = latest.plain
        for (const pattern of approve) if (pattern.test(screen)) { await t.enter(); await sleep(600) }
        const hit = typeof test === 'function' ? test(screen) : test.test(screen)
        if (hit) {
          if (!stableMs) return screen
          if (screen !== last) { last = screen; stableSince = Date.now() }
          else if (Date.now() - stableSince >= stableMs) return screen
        } else last = ''
        if (Date.now() > deadline) throw new Error(`${id}: timed out waiting for ${label}\n--- last screen ---\n${screen.split('\n').slice(-14).join('\n')}`)
        await sleep(200)
      }
    },
  }
  let failed
  try { await script(t); await sleep(1500); await sample() } catch (error) { failed = error } finally {
    stop = true; await sampler
    await run('tmux', ['-L', sock, '-f', conf, 'kill-server'])
    rmSync(work, { recursive: true, force: true })
  }
  const transcript = { id, cols, rows, durationMs: Date.now() - t0, frames, marks, ok: !failed, error: failed ? failed.message : undefined }
  writeFileSync(join(outDir, `${id}.transcript.json`), JSON.stringify(transcript))
  if (failed) throw Object.assign(failed, { transcript })
  return transcript
}

/** Render a transcript to <id>.mp4 (1920×1080, 30 fps). `redact` is passed to redactLine for every line. */
export async function renderTranscript({ transcriptPath, outFile, theme = 'dark', redact = {} }) {
  const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8'))
  const th = THEMES[theme]
  const frames = transcript.frames
  const work = scratchDir('render-')
  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 })).newPage()
  const cardW = Math.round(transcript.cols * TERM.font * 0.6) + 40, cardH = transcript.rows * TERM.line + 32
  const html = `<!doctype html><meta charset="utf-8"><style>${fontFaceCss()}
    html,body{margin:0;background:${PAPER};width:1920px;height:1080px;overflow:hidden}
    .card{position:absolute;left:${Math.round((1920 - cardW) / 2)}px;top:34px;width:${cardW}px;height:${cardH}px;background:${th.bg};border-radius:14px;box-shadow:0 0 0 1px rgba(30,27,24,.14),0 18px 48px rgba(30,27,24,.16);box-sizing:border-box;padding:16px 20px;overflow:hidden}
    pre{margin:0;font:${TERM.font}px/${TERM.line}px 'Geist Mono','SF Mono',Menlo,monospace;font-variant-ligatures:none;color:${th.fg};white-space:pre;letter-spacing:0}
  </style><div class="card"><pre id="t"></pre></div>`
  const pageFile = join(work, 'terminal.html')
  writeFileSync(pageFile, html)
  await page.goto(pathToFileURL(pageFile).href); await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => document.fonts.load("25px 'Geist Mono'"))
  const list = []
  let lastHtml = ''
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const body = frame.lines.slice(0, transcript.rows).map((line, row) => lineHtml(redactLine(line, redact), th, frame.cursor && frame.cursor.y === row ? frame.cursor.x : -1)).join('\n')
    const file = join(work, `f${String(i).padStart(6, '0')}.jpg`)
    if (body !== lastHtml) {
      await page.evaluate(h => { document.getElementById('t').innerHTML = h }, body)
      await page.screenshot({ path: file, type: 'jpeg', quality: 94 })
      lastHtml = body
    } else {
      // Identical after redaction: reuse the previous file.
      const prev = list.at(-1)?.file
      list.push({ file: prev, dur: 0 }); continue
    }
    list.push({ file, dur: 0 })
  }
  await browser.close()
  for (let i = 0; i < list.length; i++) list[i].dur = Math.max(0.04, ((frames[i + 1]?.t ?? transcript.durationMs) - frames[i].t) / 1000)
  // The clip starts at the first frame, t = 0 of the transcript (the first sample is at ≈ 0 ms).
  const lines = list.flatMap(({ file, dur }) => [`file '${file}'`, 'option framerate 1000', `duration ${dur.toFixed(3)}`])
  lines.push(`file '${list.at(-1).file}'`, 'option framerate 1000')
  writeFileSync(join(work, 'frames.txt'), lines.join('\n') + '\n')
  await must('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(work, 'frames.txt'), '-vf', `fps=${FPS},format=yuv420p`, '-t', (transcript.durationMs / 1000).toFixed(3), '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-movflags', '+faststart', outFile])
  rmSync(work, { recursive: true, force: true })
  return { frames: frames.length }
}
