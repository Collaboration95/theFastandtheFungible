#!/usr/bin/env node
// Assemble the demo video from the recorded clips (video-out/vid-3/clips) and the cut in docs/submission/video/shots.json.
//
//   node scripts/video/assemble.mjs                       silent partial cut and a silent cut with owner cues
//   node scripts/video/assemble.mjs --voice owner         use your own per-shot recordings: video-out/vid-3/voice/owner/<shot-id>.wav
//   node scripts/video/assemble.mjs --voice-file take.wav one continuous voice track laid over the no-voice cut
//   node scripts/video/assemble.mjs --only s2-sandbox,s4-claude   rebuild just those shots (fast iteration)
//   node scripts/video/assemble.mjs --without s6-try      leave a shot out (or set "enabled": false in shots.json)
//
// Writes MP4s to video-out/vid-3/out (gitignored) and, on a full build, captions.srt, timing.json, timing.csv and
// voiceover.txt next to shots.json. Nothing is uploaded anywhere.
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLIPS, FPS, KIT_DOCS, OUT, PAPER, ROOT, SCRATCH, VOICE } from './config.mjs'
import { overlayRenderer } from './lib/overlays.mjs'
import { durationOf, must } from './lib/proc.mjs'
import { clockText, fillTokens, planShot, splitSubtitles, srtTime, timeCues, timecode, toSrt, wordCount } from './lib/timeline.mjs'

const args = process.argv.slice(2)
const flag = name => args.includes(`--${name}`)
const option = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const list = name => (option(name) ?? '').split(',').map(s => s.trim()).filter(Boolean)

const spec = JSON.parse(readFileSync(join(KIT_DOCS, 'shots.json'), 'utf8'))
const facts = Object.fromEntries(Object.entries(JSON.parse(readFileSync(join(ROOT, 'docs/submission/facts.json'), 'utf8')).facts).map(([k, v]) => [k, v.value]))
const only = list('only'), without = list('without')
const full = only.length === 0 && without.length === 0
const deferred = spec.shots.filter(s => s.deferred)
const voiceMode = flag('voice-file') || option('voice-file') ? 'file' : (option('voice') ?? 'none')
const WORK = join(SCRATCH, 'work')
const W = spec.width, H = spec.height
const encode = ['-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.1', '-r', String(FPS), '-movflags', '+faststart']
mkdirSync(OUT, { recursive: true }); mkdirSync(WORK, { recursive: true })

const shots = spec.shots.filter(s => s.enabled !== false && !s.deferred && (!only.length || only.includes(s.id)) && !without.includes(s.id))
if (!shots.length) { console.error('no shots selected'); process.exit(2) }

// ── Sidecars of the recorded scenes the selected shots use.
const sidecars = {}
for (const shot of shots) for (const segment of shot.segments) {
  if (sidecars[segment.scene]) continue
  const file = join(CLIPS, `${segment.scene}.json`)
  if (!existsSync(file) || !existsSync(join(CLIPS, `${segment.scene}.mp4`))) { console.error(`missing clip for scene "${segment.scene}" (shot ${shot.id}). Record it: node scripts/video/record.mjs --scenes ${segment.scene}`); process.exit(2) }
  sidecars[segment.scene] = JSON.parse(readFileSync(file, 'utf8'))
  if (!sidecars[segment.scene].ok) { console.error(`the clip for "${segment.scene}" was not recorded cleanly: ${sidecars[segment.scene].error}`); process.exit(2) }
}
const tokens = { facts, scenes: Object.fromEntries(Object.entries(sidecars).map(([id, s]) => [id, s])) }
const resolved = shots.map(shot => ({ ...shot, label: fillTokens(shot.label, tokens), segments: shot.segments.map(s => ({ ...s, label: s.label === undefined ? undefined : fillTokens(s.label, tokens) })) }))

// ── Voice: owner recordings only, or text estimates for a silent cut.
function ownerTake(shot) {
  const dir = join(VOICE, 'owner')
  if (!existsSync(dir)) return null
  const name = readdirSync(dir).find(f => f.startsWith(`${shot.id}.`) && /\.(wav|m4a|mp3|aiff?|flac|ogg)$/i.test(f))
  return name ? join(dir, name) : null
}
const voices = {}
for (const shot of resolved) {
  if (voiceMode === 'owner') {
    const file = ownerTake(shot)
    if (!file) { console.error(`no owner recording for ${shot.id}: put it at ${join(VOICE, 'owner', `${shot.id}.wav`)}`); process.exit(2) }
    voices[shot.id] = { file, duration: await durationOf(file), kind: 'owner', start: shot.voStart ?? 0.6 }
  } else voices[shot.id] = null
}
// Silent timings estimate the supplied text; owner recordings determine actual voiced timing.
if (!['none', 'owner', 'file'].includes(voiceMode)) throw new Error('Use --voice none or --voice owner; synthetic voice is not part of the final kit')
const planningVoices = voiceMode === 'owner' ? voices : Object.fromEntries(resolved.map(s => [s.id, { kind: 'text-estimate', start: s.voStart ?? 0.4, duration: wordCount(s.vo) / 2.5 }]))

// ── Plan every shot and place it on the global timeline.
const plans = []
let cursor = 0
for (const shot of resolved) {
  const voice = planningVoices[shot.id]
  const plan = planShot(shot, sidecars, voice ? { duration: voice.duration, start: voice.start } : null)
  plan.voStart = voice ? voice.start : plan.voStart
  plan.shot = shot; plan.start = cursor; plan.end = cursor + plan.length; plan.voice = voices[shot.id]; plan.planningVoice = voice
  cursor += plan.length
  plans.push(plan)
}
const total = cursor

if (flag('plan')) {
  for (const plan of plans) {
    console.log(`\n${plan.id}  ${timecode(plan.start)}–${timecode(plan.end)} (${plan.length.toFixed(1)} s)`)
    for (const seg of plan.segments) console.log(`  ${seg.outStart.toFixed(1).padStart(5)}–${seg.outEnd.toFixed(1).padEnd(5)} ${seg.scene} ${seg.from.toFixed(1)}–${seg.to.toFixed(1)} ×${seg.speed.toFixed(1)}`)
    for (const c of sentenceTimes(plan)) console.log(`  voice ${(c.start - plan.start).toFixed(1).padStart(5)}–${(c.end - plan.start).toFixed(1)}  ${c.text.slice(0, 70)}`)
  }
  console.log(`\ntotal ${timecode(total)}`)
  process.exit(0)
}

// ── Overlays.
const overlays = await overlayRenderer(join(WORK, 'overlays'))
const clockDir = join(WORK, 'clocks')
mkdirSync(clockDir, { recursive: true })
async function clockFrames(plan, segment) {
  const dir = join(clockDir, `${plan.id}-${segment.index}`)
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const count = Math.ceil(segment.outDur) + 1
  let size
  for (let i = 0; i < count; i++) {
    const real = (segment.from - segment.clockOrigin) + Math.min(i, segment.outDur) * segment.speed
    const o = await overlays.clock(clockText(Math.max(0, real)))
    size ??= o
    copyFileSync(o.file, join(dir, `c_${String(i).padStart(3, '0')}.png`))
  }
  return { pattern: join(dir, 'c_%03d.png'), ...size }
}

// ── One shot, clean: its segments at their speeds, labels, the real-time clock, a soft fade at each end.
async function buildClean(plan) {
  const out = join(WORK, `${plan.id}.clean.mp4`)
  const inputs = [], chains = []
  plan.segments.forEach((seg, i) => {
    inputs.push('-ss', seg.from.toFixed(3), '-t', seg.source.toFixed(3), '-i', join(CLIPS, `${seg.scene}.mp4`))
    chains.push(`[${i}:v]setpts=(PTS-STARTPTS)/${seg.speed.toFixed(5)},fps=${FPS},format=yuv420p[s${i}]`)
  })
  const n = plan.segments.length
  chains.push(`${plan.segments.map((_, i) => `[s${i}]`).join('')}concat=n=${n}:v=1:a=0[cat]`)
  let last = 'cat'
  const pad = plan.length - plan.natural
  if (pad > 0.02) { chains.push(`[${last}]tpad=stop_mode=clone:stop_duration=${pad.toFixed(3)}[padded]`); last = 'padded' }
  let input = n
  for (const [k, label] of plan.labels.entries()) {
    const bar = await overlays.bar(label.text)
    inputs.push('-loop', '1', '-framerate', String(FPS), '-t', plan.length.toFixed(3), '-i', bar.file)
    chains.push(`[${last}][${input}:v]overlay=x=40:y=${H - 34 - bar.h}:enable='between(t,${label.from.toFixed(3)},${(label.to + 0.001).toFixed(3)})'[l${k}]`)
    last = `l${k}`; input++
  }
  for (const seg of plan.segments.filter(s => s.clock)) {
    const frames = await clockFrames(plan, seg)
    inputs.push('-framerate', '1', '-i', frames.pattern)
    chains.push(`[${input}:v]setpts=PTS-STARTPTS+${seg.outStart.toFixed(3)}/TB[c${seg.index}]`)
    chains.push(`[${last}][c${seg.index}]overlay=x=${W - 40 - frames.w}:y=${H - 34 - frames.h}:enable='between(t,${seg.outStart.toFixed(3)},${seg.outEnd.toFixed(3)})':eof_action=pass[k${seg.index}]`)
    last = `k${seg.index}`; input++
  }
  chains.push(`[${last}]fade=t=in:st=0:d=0.25:color=${PAPER},fade=t=out:st=${(plan.length - 0.25).toFixed(3)}:d=0.25:color=${PAPER}[out]`)
  await must('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', chains.join(';'), '-map', '[out]', '-t', plan.length.toFixed(3), '-an', ...encode, '-crf', '14', out])
  return out
}

// ── Shot + voice + burned-in subtitles (the draft), or + the cue panel (the cues cut), or voice only.
async function subtitleCues(plan) {
  const voice = plan.planningVoice
  if (!voice) return []
  // Use owner audio timing, or a text-only estimate for the silent cut.
  const parts = voice.parts ?? [{ text: plan.shot.vo, start: voice.start, end: voice.start + voice.duration }]
  return parts.flatMap(part => timeCues(splitSubtitles(part.text), plan.start + part.start, part.end - part.start))
}
/** The sentence timeline of a shot, in seconds from the start of the whole video (for the cue sheet and timing files). */
function sentenceTimes(plan) {
  const voice = plan.planningVoice
  if (!voice) return []
  const parts = voice.parts ?? [{ text: plan.shot.vo, start: voice.start, end: voice.start + voice.duration }]
  return parts.map(p => ({ text: p.text, start: plan.start + p.start, end: plan.start + p.end }))
}
async function buildVariant(plan, clean, { mode, voice }) {
  const out = join(WORK, `${plan.id}.${mode}.mp4`)
  const inputs = ['-i', clean], chains = []
  let last = '0:v', input = 1
  const overlayAt = async (o, x, y, from, to) => {
    inputs.push('-loop', '1', '-framerate', String(FPS), '-t', plan.length.toFixed(3), '-i', o.file)
    chains.push(`[${last}][${input}:v]overlay=x=${x}:y=${y}:enable='between(t,${from.toFixed(3)},${to.toFixed(3)})'[o${input}]`)
    last = `o${input}`; input++
  }
  if (mode === 'subs') {
    for (const cue of await subtitleCues(plan)) {
      const o = await overlays.subtitle(cue.lines)
      await overlayAt(o, Math.round((W - o.w) / 2), H - 120 - o.h, cue.start - plan.start, cue.end - plan.start)
    }
  }
  if (mode === 'cues') {
    const lines = sentenceTimes(plan).map(c => `${timecode(c.start)}  ${c.text}`).join('\n')
    const o = await overlays.cue(`${plan.id.toUpperCase()}  ·  ${timecode(plan.start)}–${timecode(plan.end)}  ·  say each sentence at its time`, lines)
    await overlayAt(o, 40, H - 120 - o.h, 0, plan.length)
    for (let s = 0; s < Math.ceil(plan.length); s++) {
      const tc = await overlays.timecode(`${timecode(plan.start + s)}  ·  ${plan.id}  +${s}s`)
      await overlayAt(tc, 40, 24, s, s + 1)
    }
  }
  let audio = []
  if (voice && plan.voice) {
    const clips = plan.voice.parts ?? [{ file: plan.voice.file, start: plan.voice.start }]
    clips.forEach((clip, i) => {
      inputs.push('-i', clip.file)
      chains.push(`[${input + i}:a]aresample=44100,aformat=channel_layouts=mono,adelay=${Math.round(clip.start * 1000)}:all=1[v${i}]`)
    })
    input += clips.length
    const mix = clips.length > 1 ? `${clips.map((_, i) => `[v${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:duration=longest[mix]` : `[v0]anull[mix]`
    chains.push(mix)
    chains.push(`[mix]loudnorm=I=-16:TP=-1.5:LRA=9,apad,atrim=0:${plan.length.toFixed(3)},afade=t=out:st=${(plan.length - 0.06).toFixed(3)}:d=0.05[a]`)
    audio = ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '1']
  } else if (voice) {
    chains.push(`anullsrc=r=44100:cl=mono,atrim=0:${plan.length.toFixed(3)}[a]`)
    audio = ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '1']
  }
  if (!chains.length) { copyFileSync(clean, out); return out }
  const map = ['-filter_complex', chains.join(';'), '-map', last === '0:v' ? '0:v' : `[${last}]`]
  await must('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, ...map, ...audio, '-t', plan.length.toFixed(3), ...encode, '-crf', '16', out])
  return out
}

async function concat(files, out, withAudio) {
  const listFile = join(WORK, `concat-${createHash('sha1').update(out).digest('hex').slice(0, 6)}.txt`)
  writeFileSync(listFile, files.map(f => `file '${f}'`).join('\n') + '\n')
  await must('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', ...(withAudio ? [] : ['-an']), '-movflags', '+faststart', out])
}

// ── Build.
console.log(`${plans.length} shots · ${voiceMode} voice · ${timecode(total)} total`)
const clean = [], cues = [], voiced = [], silentBase = []
for (const plan of plans) {
  const t0 = Date.now()
  const c = await buildClean(plan)
  clean.push(c)
  if (voiceMode === 'owner') voiced.push(await buildVariant(plan, c, { mode: flag('subs') ? 'subs' : 'plain', voice: true }))
  cues.push(await buildVariant(plan, c, { mode: 'cues', voice: false }))
  silentBase.push(c)
  console.log(`  ${plan.id}: ${plan.length.toFixed(1)} s (visual ${plan.natural.toFixed(1)} s, voice ${plan.planningVoice ? plan.planningVoice.duration.toFixed(1) : '-'} s) in ${Math.round((Date.now() - t0) / 1000)} s`)
}
await overlays.close()

const base = 'ResearchAgent-demo'
const suffix = full && !deferred.length ? '' : `-PARTIAL-${plans.map(p => p.id.split('-')[0]).join('+')}`
const outputs = {}
await concat(silentBase, join(OUT, `${base}-NOVOICE-clean${suffix}.mp4`), false); outputs.noVoice = join(OUT, `${base}-NOVOICE-clean${suffix}.mp4`)
await concat(cues, join(OUT, `${base}-NOVOICE-cues${suffix}.mp4`), false); outputs.cues = join(OUT, `${base}-NOVOICE-cues${suffix}.mp4`)
if (voiceMode === 'owner') { outputs.owner = join(OUT, `${base}-OWNER-voice${suffix}.mp4`); await concat(voiced, outputs.owner, true) }
const fileVoice = option('voice-file')
if (fileVoice) {
  outputs.final = join(OUT, `${base}-FINAL-owner-track${suffix}.mp4`)
  await must('ffmpeg', ['-y', '-loglevel', 'error', '-i', outputs.noVoice, '-i', fileVoice, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-af', `apad,atrim=0:${total.toFixed(3)}`, '-shortest', outputs.final])
}

// ── Captions and timing, committed with the kit (a full build only).
const srtCues = []
for (const plan of plans) for (const cue of await subtitleCues(plan)) srtCues.push(cue)
const timing = {
  note: 'Generated from recorded clips and owner text. Silent timing estimates 150 words/minute; retime with actual owner audio. Deferred hosted scenes are omitted.',
  deferred: deferred.map(s => ({ id: s.id, reason: s.deferred })), total: Number(total.toFixed(2)), voice: voiceMode,
  sources: Object.fromEntries(Object.entries(sidecars).map(([id, s]) => [id, s.source])),
  shots: plans.map(plan => ({
    id: plan.id, title: plan.shot.title, start: Number(plan.start.toFixed(2)), end: Number(plan.end.toFixed(2)), length: Number(plan.length.toFixed(2)),
    voStart: Number((plan.start + plan.voStart).toFixed(2)), voEnd: plan.planningVoice ? Number((plan.start + plan.voStart + plan.planningVoice.duration).toFixed(2)) : null,
    sentences: sentenceTimes(plan).map(c => ({ start: Number(c.start.toFixed(2)), end: Number(c.end.toFixed(2)), text: c.text })),
    words: wordCount(plan.shot.vo), labels: plan.labels.map(l => ({ from: Number((plan.start + l.from).toFixed(2)), to: Number((plan.start + l.to).toFixed(2)), text: l.text })),
    segments: plan.segments.map(s => ({ scene: s.scene, source: sidecars[s.scene].source, from: Number(s.from.toFixed(2)), to: Number(s.to.toFixed(2)), speed: Number(s.speed.toFixed(2)) })),
  })),
}
if (full) {
  writeFileSync(join(KIT_DOCS, 'captions.srt'), toSrt(srtCues))
  writeFileSync(join(KIT_DOCS, 'timing.json'), JSON.stringify(timing, null, 2) + '\n')
  writeFileSync(join(KIT_DOCS, 'timing.csv'), ['shot,title,start,end,vo_start,vo_end,words', ...timing.shots.map(s => [s.id, `"${s.title}"`, srtTime(s.start).slice(3, 8), srtTime(s.end).slice(3, 8), srtTime(s.voStart).slice(3, 8), s.voEnd === null ? '' : srtTime(s.voEnd).slice(3, 8), s.words].join(','))].join('\n') + '\n')
  writeFileSync(join(KIT_DOCS, 'voiceover.txt'), spec.shots.map(s => `# ${s.id} · ${s.title}${s.deferred ? ' · record after redeploy' : ''}\n${s.vo}\n`).join('\n'))
}
writeFileSync(join(OUT, 'last-build.json'), JSON.stringify({ at: new Date().toISOString(), ...timing, outputs }, null, 2) + '\n')

console.log(`\ntotal ${timecode(total)} (${total.toFixed(1)} s)`)
for (const [kind, file] of Object.entries(outputs)) console.log(`${kind.padEnd(8)} ${file} (${(await durationOf(file)).toFixed(1)} s)`)
