#!/usr/bin/env node
// Record the demo video's scenes, each as its own clip in scratch/video/clips (gitignored).
//
//   node scripts/video/record.mjs                    every scene, hosted demo if it is ready (else the local stack)
//   node scripts/video/record.mjs --scenes ledger,try-testnet
//   node scripts/video/record.mjs --target local     never touch the hosted demo (HOSTED=1 stack on ephemeral ports)
//   node scripts/video/record.mjs --target hosted --wait-hosted   wait for state "ready" first
//
// A pass asks the hosted demo at most 4 questions (VIDEO_MAX_LIVE_QUESTIONS lowers it). Each clip gets a sidecar
// <id>.json naming where its footage came from (hosted, local stack, replay…), so captions never overclaim.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLIPS, FPS, HOSTED_URL, MAX_LIVE_QUESTIONS, SCRATCH, scratchDir } from './config.mjs'
import { renderHtml } from './lib/cards.mjs'
import { must } from './lib/proc.mjs'
import { recordScene } from './lib/browser.mjs'
import { probeHosted, startLocalStack } from './lib/stack.mjs'
import { captureSession, renderTranscript } from './lib/terminal.mjs'
import { SCENES, claudeCwd, terminalEnv } from './scenes.mjs'

const args = process.argv.slice(2)
const flag = name => args.includes(`--${name}`)
const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback }
if (flag('help')) { console.log(readHelp()); process.exit(0) }
function readHelp() { return 'usage: node scripts/video/record.mjs [--scenes a,b|all] [--target auto|hosted|local] [--wait-hosted] [--keep-going] [--render-only] [--list]' }

const ORDER = ['title-card', 'close-card', 'replay-key-reveal', 'ledger', 'builder-feedback', 'python-verify', 'try-testnet', 'claude-mcp', 'hosted-ask', 'hosted-decline']
if (flag('list')) { for (const id of ORDER) console.log(id); process.exit(0) }
const wanted = option('scenes', 'all') === 'all' ? ORDER : option('scenes').split(',').map(s => s.trim())
for (const id of wanted) if (!SCENES.some(s => s.id === id)) { console.error(`unknown scene: ${id}`); process.exit(2) }
const targetMode = option('target', 'auto')
mkdirSync(CLIPS, { recursive: true })
rmSync(join(SCRATCH, 'tmp'), { recursive: true, force: true }) // folders a crashed earlier take left behind

let local = null, liveUsed = 0
const pass = { startedAt: new Date().toISOString(), targetMode, scenes: [] }

async function resolveTarget(scene) {
  // Probe before every hosted scene: "busy" (someone else's question holds the queue) clears by itself, so wait for it.
  let status = await probeHosted()
  if (targetMode !== 'local') {
    const deadline = Date.now() + (flag('wait-hosted') ? 3_600_000 : 600_000)
    while (status.state !== 'ready' && (status.state === 'busy' || flag('wait-hosted')) && Date.now() < deadline) {
      console.log(`hosted state: ${status.state} (HTTP ${status.httpStatus}); waiting 15 s`)
      await new Promise(done => setTimeout(done, 15_000))
      status = await probeHosted()
    }
  }
  const ready = status.state === 'ready'
  if (targetMode !== 'local' && ready && liveUsed + scene.liveQuestions <= MAX_LIVE_QUESTIONS) return { kind: 'hosted', base: HOSTED_URL, status }
  if (targetMode === 'hosted') throw new Error(ready ? `live-question budget (${MAX_LIVE_QUESTIONS}) used up` : `hosted demo is ${status.state}, not ready`)
  if (!local) { console.log('hosted demo not used: starting the local HOSTED=1 stack'); local = await startLocalStack() }
  return { kind: 'local', base: local.url }
}

async function recordCard(scene) {
  const png = join(CLIPS, `${scene.id}.png`)
  await renderHtml({ html: scene.html(), out: png })
  await must('ffmpeg', ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', String(FPS), '-i', png, '-t', String(scene.seconds), '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), join(CLIPS, `${scene.id}.mp4`)])
  const sidecar = { id: scene.id, source: 'card', durationMs: scene.seconds * 1000, fps: FPS, marks: {}, labels: { env: 'XRPL Testnet · no real value', backend: 'card' }, ok: true }
  writeFileSync(join(CLIPS, `${scene.id}.json`), JSON.stringify(sidecar, null, 2) + '\n')
  return sidecar
}

async function recordTerminal(scene) {
  const fresh = scratchDir('fresh-')
  const claude = scene.cwd === 'claude' ? claudeCwd() : null
  const cwd = claude ? claude.dir : fresh
  try {
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
  const target = scene.hosted ? await resolveTarget(scene) : { kind: scene.source ?? 'site' }
  const labels = { ...scene.labels(target) }
  if (target.kind === 'hosted') { liveUsed += scene.liveQuestions; labels.hostedLabels = target.status.labels; labels.hostedState = target.status.state }
  const options = typeof scene.contextOptions === 'function' ? scene.contextOptions(target) : {}
  const source = scene.hosted ? (target.kind === 'hosted' ? 'hosted' : 'local-hosted-stack') : scene.source
  return recordScene({ id: scene.id, source, labels, contextOptions: options, run: rec => scene.run(rec, target) })
}

let failures = 0
try {
  for (const id of wanted) {
    const scene = SCENES.find(s => s.id === id)
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
  if (local) await local.close().catch(() => undefined)
  pass.hostedQuestionsAsked = liveUsed
  pass.finishedAt = new Date().toISOString()
  writeFileSync(join(CLIPS, 'last-pass.json'), JSON.stringify(pass, null, 2) + '\n')
  if (existsSync(join(CLIPS, 'last-pass.json'))) console.log(`pass summary: ${join(CLIPS, 'last-pass.json')} (hosted questions asked: ${liveUsed})`)
}
for (const s of pass.scenes) console.log(`${s.ok ? '✓' : '✗'} ${s.id}${s.ok ? ` · ${s.source} · ${(s.durationMs / 1000).toFixed(1)} s clip · ${s.seconds} s wall` : ''}`)
process.exit(failures ? 1 : 0)
