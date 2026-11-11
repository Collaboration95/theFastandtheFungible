#!/usr/bin/env node
// Record the demo video's scenes, each as its own clip in video-out/vid-3/clips (outside git).
//
//   node scripts/video/record.mjs                    every enabled local scene; hosted-URL scenes are deferred
//   node scripts/video/record.mjs --scenes ledger,try-testnet
//   node scripts/video/record.mjs --target local     never touch the hosted demo (HOSTED=1 stack on ephemeral ports)
//   Hosted-URL scenes are intentionally deferred until after redeploy.
//
// A pass asks the hosted demo at most 4 questions (VIDEO_MAX_LIVE_QUESTIONS lowers it). Each clip gets a sidecar
// <id>.json naming where its footage came from (hosted, local stack, replay…), so captions never overclaim.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLIPS, FPS, SCRATCH, scratchDir } from './config.mjs'
import { renderHtml } from './lib/cards.mjs'
import { must } from './lib/proc.mjs'
import { recordScene } from './lib/browser.mjs'
import { startLocalStack, startReplay } from './lib/stack.mjs'
import { captureSession, renderTranscript } from './lib/terminal.mjs'
import { checkVideoPins } from './lib/release-pins.mjs'
import { SCENES, claudeCwd, terminalEnv } from './scenes.mjs'

const args = process.argv.slice(2)
const flag = name => args.includes(`--${name}`)
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
if (flag('help')) { console.log(readHelp()); process.exit(0) }
function readHelp() { return 'usage: node scripts/video/record.mjs [--scenes a,b|all] [--target local] [--keep-going] [--render-only] [--list]' }

const ORDER = ['judges-corner', 'key-check', 'writer-credentials', 'title-card', 'close-card', 'replay-key-reveal', 'ledger', 'builder-feedback', 'python-verify', 'try-testnet', 'claude-mcp', 'hosted-ask', 'hosted-decline']
if (flag('list')) { for (const id of ORDER) console.log(id); process.exit(0) }
const wanted = option('scenes', 'all') === 'all' ? ORDER : option('scenes').split(',').map(s => s.trim())
for (const id of wanted) if (!SCENES.some(s => s.id === id)) { console.error(`unknown scene: ${id}`); process.exit(2) }
const targetMode = option('target', 'local')
if (targetMode !== 'local') throw new Error('VID-3 records local scenes only; hosted footage: record after redeploy')
await checkVideoPins()
mkdirSync(CLIPS, { recursive: true })
rmSync(join(SCRATCH, 'tmp'), { recursive: true, force: true }) // folders a crashed earlier take left behind

let local = null, replay = null, liveUsed = 0
const pass = { startedAt: new Date().toISOString(), targetMode, scenes: [] }

async function resolveTarget() {
  if (!local) { console.log('starting the local HOSTED=1 stack (no hosted probe)'); local = await startLocalStack() }
  return { kind: 'local', base: local.url }
}

async function recordCard(scene) {
  const png = join(CLIPS, `${scene.id}.png`)
  await renderHtml({ html: scene.html(), out: png })
  await must('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', String(FPS), '-i', png, '-t', String(scene.seconds), '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), join(CLIPS, `${scene.id}.mp4`)])
  const sidecar = { id: scene.id, source: 'card', durationMs: scene.seconds * 1000, fps: FPS, marks: scene.marks ?? {}, labels: scene.labels?.() ?? { env: 'XRPL Testnet · no real value', backend: 'card' }, ok: true }
  writeFileSync(join(CLIPS, `${scene.id}.json`), JSON.stringify(sidecar, null, 2) + '\n')
  return sidecar
}

async function recordTerminal(scene) {
  const fresh = scratchDir('fresh-')
  const claude = scene.cwd === 'claude' ? claudeCwd() : null
  const cwd = claude ? claude.dir : fresh
  try {
    if (scene.kind === 'terminal' && !flag('render-only') && ['claude-mcp', 'python-verify', 'try-testnet'].includes(scene.id)) {
      await must('gh', ['release', 'download', 'v1.1.1', '--repo', 'Collaboration95/theFastandtheFungible', '--pattern', scene.id === 'python-verify' ? 'researchagent-1.1.1-py3-none-any.whl' : 'researchagent-mcp-1.1.1.tgz', '--dir', fresh])
    }
    if (scene.prepare && !flag('render-only')) await scene.prepare(cwd)
    const transcript = flag('render-only')
      ? JSON.parse(readFileSync(join(CLIPS, `${scene.id}.transcript.json`), 'utf8'))
      : await captureSession({ id: scene.id, cwd, env: terminalEnv(fresh), outDir: CLIPS, script: t => scene.run(t) })
    await renderTranscript({ transcriptPath: join(CLIPS, `${scene.id}.transcript.json`), outFile: join(CLIPS, `${scene.id}.mp4`), theme: scene.theme, redact: scene.redact?.() ?? {} })
    const sidecar = { id: scene.id, source: 'terminal', durationMs: transcript.durationMs, fps: FPS, marks: transcript.marks, labels: scene.labels(), ok: true, frames: transcript.frames.length }
    writeFileSync(join(CLIPS, `${scene.id}.json`), JSON.stringify(sidecar, null, 2) + '\n')
    return sidecar
  } finally {
    if (scene.cleanup) await scene.cleanup(cwd).catch(() => undefined)
    if (claude?.created) rmSync(claude.dir, { recursive: true, force: true })
    rmSync(fresh, { recursive: true, force: true })
  }
}

async function recordBrowser(scene) {
  if (scene.localReplay && !replay) replay = await startReplay()
  const target = scene.localReplay ? { kind: 'local-replay', base: replay.url } : scene.local ? await resolveTarget() : scene.hosted ? await resolveTarget() : { kind: scene.source ?? 'site' }
  const labels = { ...scene.labels(target) }
  if (target.kind === 'hosted') { liveUsed += scene.liveQuestions; labels.hostedLabels = target.status.labels; labels.hostedState = target.status.state }
  const options = typeof scene.contextOptions === 'function' ? scene.contextOptions(target) : {}
  const source = scene.local ? 'local-hosted-stack' : scene.localReplay ? 'local-replay' : scene.hosted ? (target.kind === 'hosted' ? 'hosted' : 'local-hosted-stack') : scene.source
  return recordScene({ id: scene.id, source, labels, contextOptions: options, run: rec => scene.run(rec, target) })
}

let failures = 0
try {
  for (const id of wanted) {
    const scene = SCENES.find(s => s.id === id)
    if (scene.defer) { console.log(`↷ ${id}: record after redeploy`); pass.scenes.push({ id, deferred: 'record after redeploy' }); continue }
    const t0 = Date.now()
    let outcome
    for (let attempt = 1; attempt <= (scene.hosted ? 2 : 1); attempt++) {
      try {
        console.log(`▶ ${id}${attempt > 1 ? ` (attempt ${attempt})` : ''}`)
        const sidecar = scene.kind === 'card' ? await recordCard(scene) : scene.kind === 'terminal' ? await recordTerminal(scene) : await recordBrowser(scene)
        outcome = { id, ok: true, source: sidecar.source, seconds: Math.round((Date.now() - t0) / 1000), durationMs: sidecar.durationMs }
        break
      } catch (error) {
        outcome = { id, ok: false, error: String(error.message ?? error).split('\n').slice(0, 6).join('\n') }
        console.error(`✗ ${id}: ${outcome.error}`)
      }
    }
    pass.scenes.push(outcome)
    if (!outcome.ok) { failures++; if (!flag('keep-going')) break }
  }
} finally {
  if (replay) await replay.close()
  if (local) await local.close().catch(() => undefined)
  pass.hostedQuestionsAsked = liveUsed
  pass.finishedAt = new Date().toISOString()
  writeFileSync(join(CLIPS, 'last-pass.json'), JSON.stringify(pass, null, 2) + '\n')
  if (existsSync(join(CLIPS, 'last-pass.json'))) console.log(`pass summary: ${join(CLIPS, 'last-pass.json')} (hosted questions asked: ${liveUsed})`)
}
for (const s of pass.scenes) console.log(`${s.deferred ? '↷' : s.ok ? '✓' : '✗'} ${s.id}${s.ok ? ` · ${s.source} · ${(s.durationMs / 1000).toFixed(1)} s clip · ${s.seconds} s wall` : ''}`)
process.exit(failures ? 1 : 0)
