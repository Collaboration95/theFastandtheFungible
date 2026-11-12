// Pure timeline logic for the cut: resolving marks, planning shot lengths, labels, subtitles, SRT. Unit-tested
// (tests/video-kit.test.js). No file or process access here.

/** Seconds for a reference: a number, 'start', 'end', a mark name, or a mark ± seconds ("tx_hover+0.8"). */
export function resolveRef(ref, sidecar) {
  const end = sidecar.durationMs / 1000
  if (typeof ref === 'number') return Math.min(Math.max(0, ref), end)
  if (ref === undefined || ref === 'start') return 0
  if (ref === 'end') return end
  const m = /^([A-Za-z0-9_]+)([+-]\d+(?:\.\d+)?)?$/.exec(ref)
  if (!m) throw new Error(`bad reference "${ref}"`)
  const at = sidecar.marks?.[m[1]]
  if (at === undefined) throw new Error(`scene ${sidecar.id} has no mark "${m[1]}" (marks: ${Object.keys(sidecar.marks ?? {}).join(', ') || 'none'})`)
  return Math.min(Math.max(0, at / 1000 + Number(m[2] ?? 0)), end)
}

/** "Sped up ×3 · real time shown": rounded so the claim stays true to within a tenth. */
export function speedLabel(speed) {
  const n = speed >= 9.5 ? Math.round(speed) : Math.round(speed * 10) / 10
  return `Sped up ×${n} · real time shown`
}
/** Any real speed-up is declared (label + clock); only footage at 1× to within 10% goes unmarked. */
export const CLOCK_THRESHOLD = 1.1

/** Resolve a shot's segments against the recorded sidecars. Output durations follow the speed rules. */
export function resolveSegments(shot, sidecars) {
  return shot.segments.map((segment, index) => {
    const sidecar = sidecars[segment.scene]
    if (!sidecar) throw new Error(`shot ${shot.id}: scene "${segment.scene}" was not recorded`)
    const from = resolveRef(segment.from, sidecar)
    const to = segment.to === undefined ? sidecar.durationMs / 1000 : resolveRef(segment.to, sidecar)
    if (to <= from) {
      // A segment marked optional is skipped when its footage is empty (the local stack finishes a run in under a second).
      if (segment.optional) return null
      throw new Error(`shot ${shot.id} segment ${index}: "${segment.from}" → "${segment.to}" is empty (${from.toFixed(2)}–${to.toFixed(2)} s)`)
    }
    const source = to - from
    let speed = segment.speed ?? 1
    if (segment.maxSeconds && source > segment.maxSeconds) speed = Math.max(speed, source / segment.maxSeconds)
    const clockOrigin = segment.clockOrigin === undefined ? from : resolveRef(segment.clockOrigin, sidecar)
    return { index, scene: segment.scene, from, to, source, speed, outDur: source / speed, label: segment.label, clock: speed >= CLOCK_THRESHOLD, clockOrigin, sidecar }
  }).filter(Boolean)
}

/**
 * Plan one shot: segment output times, the shot length (the visual length, or the voice-over if that is longer),
 * and the label timeline. `vo` is { duration, start } in seconds, or null for a silent shot.
 */
export function planShot(shot, sidecars, vo = null, tail = 0.7) {
  const segments = resolveSegments(shot, sidecars)
  let t = 0
  for (const s of segments) { s.outStart = t; t += s.outDur; s.outEnd = t }
  const natural = t
  const voiceEnd = vo ? vo.start + vo.duration + tail : 0
  const length = Math.max(natural, shot.minSeconds ?? 0, voiceEnd)
  // The last segment's final frame holds when the voice-over runs longer than the picture.
  const labels = []
  let current = shot.label
  for (const s of segments) {
    if (s.label !== undefined) current = s.label
    const text = s.clock ? `${current} · ${speedLabel(s.speed)}` : current
    const last = labels.at(-1)
    if (last && last.text === text) last.to = s.outEnd
    else labels.push({ text, from: s.outStart, to: s.outEnd })
  }
  if (labels.length) labels.at(-1).to = length
  return { id: shot.id, natural, length, segments, labels, voStart: shot.voStart ?? 0.6 }
}

/** Substitute {token} from a record of strings; an unknown token without a fallback throws (a caption must not say {x}). */
export function fillTokens(text, values) {
  return text.replace(/\{([A-Za-z0-9_.-]+)(?:\|([^}]*))?\}/g, (whole, key, fallback) => {
    const v = key.split('.').reduce((o, k) => o?.[k], values)
    if (v !== undefined && v !== '') return String(v)
    if (fallback !== undefined) return fallback
    throw new Error(`label token {${key}} has no value`)
  })
}

/** The sentences of a voice-over, in order (a cue is one sentence; `voAt` in shots.json gives each one's start). */
export function splitSentences(text) {
  return text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean)
}

/**
 * Place a shot's sentences on its timeline. Each starts at its `voAt` time (or right after the previous one) but never
 * overlaps the sentence before it. `durations` are the spoken lengths in seconds. Returns [{ text?, start, end }].
 */
export function placeSentences(shot, durations, gap = 0.3) {
  const at = shot.voAt
  if (at && at.length !== durations.length) throw new Error(`shot ${shot.id}: voAt has ${at.length} times for ${durations.length} sentences`)
  const placed = []
  durations.forEach((duration, i) => {
    const earliest = i === 0 ? 0 : placed[i - 1].end + gap
    const wanted = at ? at[i] : i === 0 ? (shot.voStart ?? 0.6) : earliest
    const start = Math.max(wanted, earliest)
    placed.push({ start, end: start + duration })
  })
  return placed
}

/** Split a voice-over into subtitle cues of at most two lines of `width` characters, on sentence and clause breaks. */
export function splitSubtitles(text, width = 52) {
  const cues = []
  for (const sentence of splitSentences(text)) {
    // Balanced lines: as few as fit, each about the same length, so a short word never sits alone on the last line.
    const n = Math.max(1, Math.ceil(sentence.length / width))
    const target = Math.min(width, Math.ceil(sentence.length / n) + 6)
    let line = '', lines = []
    for (const word of sentence.split(' ')) {
      if ((line + ' ' + word).trim().length > target && line) { lines.push(line); line = word } else line = (line + ' ' + word).trim()
    }
    if (line) lines.push(line)
    for (let i = 0; i < lines.length; i += 2) cues.push(lines.slice(i, i + 2))
  }
  return cues
}

/** Time cues across [start, start+duration] in proportion to their length (a good fit for a steady read). */
export function timeCues(cues, start, duration) {
  const weights = cues.map(lines => lines.join(' ').length + 6)
  const total = weights.reduce((a, b) => a + b, 0)
  let at = start
  return cues.map((lines, i) => { const span = duration * weights[i] / total; const cue = { lines, start: at, end: at + span }; at += span; return cue })
}

const pad = (n, w = 2) => String(Math.floor(n)).padStart(w, '0')
export function srtTime(seconds) {
  const ms = Math.round(seconds * 1000)
  return `${pad(ms / 3600000)}:${pad((ms / 60000) % 60)}:${pad((ms / 1000) % 60)},${pad(ms % 1000, 3)}`
}
export function toSrt(cues) {
  return cues.map((cue, i) => `${i + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.lines.join('\n')}\n`).join('\n')
}
export const clockText = seconds => `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`
export const timecode = seconds => `${pad(seconds / 60)}:${pad(seconds % 60)}`

/** Words the macOS voice reads wrongly, respelled for speech only (captions keep the written form). */
export const PRONUNCIATION = [[/\bXRPL\b/g, 'X R P L'], [/\bXRP\b/g, 'X R P'], [/\bRLUSD\b/g, 'R L U S D'], [/\bMCP\b/g, 'M C P'], [/\bx402\b/gi, 'x four oh two'], [/\bS\$/g, 'S dollars ']]
export const speechText = text => PRONUNCIATION.reduce((out, [pattern, spoken]) => out.replace(pattern, spoken), text.replace(/\s+/g, ' '))
export const wordCount = text => text.trim().split(/\s+/).filter(Boolean).length
