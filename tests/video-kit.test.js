// The demo-video kit (scripts/video, docs/submission/video): pure timeline logic, the ANSI renderer, and the invariants
// that keep the video honest: every label says what is real, the voice-over matches the owner-facing script, and no
// terminal session inherits a key or a seed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { THEMES, lineHtml, paletteColor, parseLine, plain, redactLine } from '../scripts/video/lib/ansi.mjs'
import { clockText, fillTokens, placeSentences, planShot, resolveRef, resolveSegments, speedLabel, speechText, splitSentences, splitSubtitles, srtTime, timeCues, toSrt } from '../scripts/video/lib/timeline.mjs'
import { assertPublished, checkVideoPins } from '../scripts/video/lib/release-pins.mjs'
import { RELEASE_TAG, TGZ, WHEEL, QUESTIONS, HISTORICAL_MCP_QUESTION } from '../scripts/video/config.mjs'
import { CLAUDE_PROMPT, SCENES, hasTeamAuthoredResult, assertHostedModels } from '../scripts/video/scenes.mjs'
import { resolveRecordingTarget } from '../scripts/video/lib/target.mjs'
import { sessionEnv } from '../scripts/video/lib/terminal.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const spec = JSON.parse(readFileSync(join(root, 'docs/submission/video/shots.json'), 'utf8'))
const script = readFileSync(join(root, 'docs/submission/demo-video-script.md'), 'utf8')
const norm = text => text.replace(/[“”"]/g, '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()

const clip = (id, seconds, marks = {}) => ({ id, durationMs: seconds * 1000, marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v * 1000])) })

describe('timeline: references and segments', () => {
  const scene = clip('s', 40, { asked: 10, ready: 22 })
  it('resolves numbers, start/end, marks and mark offsets', () => {
    expect(resolveRef(5, scene)).toBe(5)
    expect(resolveRef('start', scene)).toBe(0)
    expect(resolveRef('end', scene)).toBe(40)
    expect(resolveRef('asked', scene)).toBe(10)
    expect(resolveRef('asked+1.5', scene)).toBe(11.5)
    expect(resolveRef('ready-2', scene)).toBe(20)
    expect(resolveRef('ready+99', scene)).toBe(40) // clamped to the clip
  })
  it('names the scene and its marks when a mark is missing', () => {
    expect(() => resolveRef('nope', scene)).toThrow(/scene s has no mark "nope".*asked, ready/)
  })
  it('compresses a long wait to maxSeconds, labels it, and leaves short footage at 1×', () => {
    const shot = { id: 't', label: 'Base', segments: [{ scene: 's', from: 'asked', to: 'ready', maxSeconds: 4 }, { scene: 's', from: 'ready', to: 'ready+2', maxSeconds: 4 }] }
    const [wait, short] = resolveSegments(shot, { s: scene })
    expect(wait.speed).toBeCloseTo(3) // 12 s of footage in 4 s
    expect(wait.outDur).toBeCloseTo(4)
    expect(wait.clock).toBe(true)
    expect(short.speed).toBe(1)
    expect(short.clock).toBe(false)
  })
  it('rejects an empty segment unless it is optional', () => {
    const empty = { scene: 's', from: 'ready', to: 'asked' }
    expect(() => resolveSegments({ id: 't', segments: [empty] }, { s: scene })).toThrow(/is empty/)
    expect(resolveSegments({ id: 't', segments: [{ ...empty, optional: true }] }, { s: scene })).toEqual([])
  })
  it('plans a shot: lengths follow the longer of picture and voice, labels carry the speed claim', () => {
    const shot = { id: 't', label: 'Base', voStart: 0.5, segments: [{ scene: 's', from: 0, to: 6 }, { scene: 's', from: 'asked', to: 'ready', maxSeconds: 4, label: 'Waiting' }] }
    const silent = planShot(shot, { s: scene })
    expect(silent.natural).toBeCloseTo(10)
    expect(silent.length).toBeCloseTo(10)
    expect(silent.labels.map(l => l.text)).toEqual(['Base', 'Waiting · Sped up ×3 · real time shown'])
    expect(silent.labels.at(-1).to).toBeCloseTo(silent.length)
    const voiced = planShot(shot, { s: scene }, { duration: 14, start: 0.5 })
    expect(voiced.length).toBeCloseTo(15.2) // 0.5 + 14 + 0.7 tail: the last frame holds
  })
  it('states speed to within a tenth', () => {
    expect(speedLabel(3.04)).toBe('Sped up ×3 · real time shown')
    expect(speedLabel(2.46)).toBe('Sped up ×2.5 · real time shown')
    expect(speedLabel(12.4)).toBe('Sped up ×12 · real time shown')
  })
  it('places voice-over sentences at their cue times without overlap', () => {
    const shot = { id: 't', voStart: 1, voAt: [1, 2, 9] }
    const placed = placeSentences(shot, [3, 2, 1.5])
    expect(placed[0]).toEqual({ start: 1, end: 4 })
    expect(placed[1].start).toBeCloseTo(4.3) // wanted 2 s, but the first sentence is still speaking
    expect(placed[2]).toEqual({ start: 9, end: 10.5 })
    expect(() => placeSentences({ id: 't', voAt: [1] }, [1, 1])).toThrow(/voAt has 1 times for 2 sentences/)
    expect(placeSentences({ id: 't', voStart: 0.5 }, [1, 1]).map(p => p.start)).toEqual([0.5, 1.8])
  })
  it('splits a voice-over into its sentences', () => {
    expect(splitSentences('This is X: it works. Does it? Yes!  Mainnet is a checklist, not a claim.')).toEqual(['This is X: it works.', 'Does it?', 'Yes!', 'Mainnet is a checklist, not a claim.'])
  })
  it('preserves decimal runtime, money and release labels through subtitle generation', () => {
    const text = 'This run finished in 22.3 seconds and bought one S$0.40 article. Use v1.1.1. No refund.'
    expect(splitSentences(text)).toEqual(['This run finished in 22.3 seconds and bought one S$0.40 article.', 'Use v1.1.1.', 'No refund.'])
    expect(splitSubtitles(text).flat().join(' ')).toBe(text)
  })
  it('formats the real-time clock', () => { expect(clockText(0)).toBe('0:00'); expect(clockText(75.4)).toBe('1:15') })
})

describe('labels, tokens and captions', () => {
  it('fills tokens, honours fallbacks, and refuses to caption an unknown value', () => {
    expect(fillTokens('{facts.transactions} transactions', { facts: { transactions: '61' } })).toBe('61 transactions')
    expect(fillTokens('{a.b-c|none}', {})).toBe('none')
    expect(() => fillTokens('{missing}', {})).toThrow(/no value/)
  })
  it('splits voice-over into subtitle cues of at most two short lines and times them across the read', () => {
    const cues = splitSubtitles('Open the link, ask a question, set a budget. A five-second plan shows what it will do: free sources first, then at most one article per round.')
    expect(cues.length).toBeGreaterThan(1)
    for (const lines of cues) { expect(lines.length).toBeLessThanOrEqual(2); for (const line of lines) expect(line.length).toBeLessThanOrEqual(52) }
    const timed = timeCues(cues, 10, 8)
    expect(timed[0].start).toBe(10)
    expect(timed.at(-1).end).toBeCloseTo(18)
    for (let i = 1; i < timed.length; i++) expect(timed[i].start).toBeCloseTo(timed[i - 1].end)
  })
  it('writes valid SRT', () => {
    expect(srtTime(3723.456)).toBe('01:02:03,456')
    expect(toSrt([{ lines: ['Hello'], start: 1, end: 2.5 }])).toBe('1\n00:00:01,000 --> 00:00:02,500\nHello\n')
  })
  it('respells what the speech voice mispronounces, only for speech', () => {
    expect(speechText('on XRPL with RLUSD')).toBe('on X R P L with R L U S D')
  })
})

describe('ANSI → HTML for the terminal scenes', () => {
  it('parses 16, 256 and true colour, bold, dim and reverse', () => {
    const runs = parseLine('\x1b[1m\x1b[38;5;220mAllow\x1b[0m plain \x1b[38;2;10;20;30;48;5;4mrgb\x1b[39m\x1b[49m \x1b[7mrev\x1b[27m')
    expect(runs[0]).toMatchObject({ text: 'Allow', bold: true, fg: { n: 220 } })
    expect(runs[1]).toEqual({ text: ' plain ' })
    expect(runs[2]).toMatchObject({ text: 'rgb', fg: { rgb: [10, 20, 30] }, bg: { n: 4 } })
    expect(runs.at(-1)).toMatchObject({ text: 'rev', reverse: true })
  })
  it('drops OSC 8 links and other escapes, and escapes HTML', () => {
    const line = '\x1b]8;id=a;https://example.org\x1b\\link\x1b]8;;\x1b\\ <b> & \x1b[2K'
    expect(plain(line)).toBe('link <b> & ')
    expect(lineHtml(line)).toContain('&lt;b&gt; &amp;')
    expect(lineHtml(line)).not.toContain('https://example.org')
  })
  it('maps the 256-colour cube and grey ramp', () => {
    expect(paletteColor(16)).toBe('rgb(0,0,0)')
    expect(paletteColor(231)).toBe('rgb(255,255,255)')
    expect(paletteColor(232)).toBe('rgb(8,8,8)')
    expect(paletteColor(1, THEMES.light)).toBe(THEMES.light.base[1])
  })
  it('paints the cursor cell', () => {
    expect(lineHtml('ab', THEMES.dark, 1)).toContain(`background:${THEMES.dark.cursor}`)
    expect(lineHtml('ab', THEMES.dark, 5)).toContain('&nbsp;')
  })
  it('redacts the home directory and blanks personal usage rows', () => {
    const redact = { home: '/Users/someone', user: 'someone', blankRows: [/\b5h:\s*\d+%/] }
    expect(redactLine('File modified: /Users/someone/.claude.json', redact)).toBe('File modified: ~/.claude.json')
    expect(redactLine('\x1b[2m5h: 52% (1h44m)\x1b[0m', redact)).toBe('')
    expect(redactLine('Opus 5.5 · Claude Max', redact)).toBe('Opus 5.5 · Claude Max')
  })
})

describe('the video stays honest', () => {
  const enabled = spec.shots.filter(s => s.enabled !== false)
  const labelsOf = shot => [shot.label, ...shot.segments.map(s => s.label).filter(Boolean)]
  it('has unique shots, each with picture and voice-over', () => {
    expect(new Set(spec.shots.map(s => s.id)).size).toBe(spec.shots.length)
    for (const shot of spec.shots) { expect(shot.segments.length).toBeGreaterThan(0); expect(shot.vo.length).toBeGreaterThan(40) }
  })
  it('gives every sentence of a shot with cue times its own time', () => {
    for (const shot of spec.shots.filter(s => s.voAt)) expect(shot.voAt.length, shot.id).toBe(splitSentences(shot.vo).length)
  })
  it('only cuts scenes the recorder can make', () => {
    const ids = new Set(SCENES.map(s => s.id))
    for (const shot of spec.shots) for (const segment of shot.segments) expect(ids.has(segment.scene), `${shot.id}: ${segment.scene}`).toBe(true)
  })
  it('puts a label that says what is real on every shot (hard gate 5)', () => {
    for (const shot of enabled) for (const label of labelsOf(shot)) {
      const text = label.startsWith('{') ? 'no real value' : label // tokens resolve to the recorder's caption, checked below
      expect(/no real value|Testnet|Replay of a recorded|checked live from your browser/.test(text), `${shot.id}: "${label}"`).toBe(true)
      expect(/live service|production|mainnet ready/i.test(label), `${shot.id}: "${label}"`).toBe(false)
    }
  })
  it('names the sandbox as Testnet with no real value wherever footage is the hosted app or the local stack', () => {
    const source = readFileSync(join(root, 'scripts/video/scenes.mjs'), 'utf8')
    expect(source).toMatch(/'Live sandbox', 'XRPL Testnet', models, 'no real value'/)
    expect(source).toMatch(/'Local HOSTED=1 stack', 'fixture models', 'simulated payments', 'no real value'/)
  })
  it('marks replay footage as a replay and the writer kinds as what they are', () => {
    const refund = spec.shots.find(s => s.id === 's3-refund')
    expect(refund.label).toMatch(/Local replay.*recorded Testnet escrow/)
    expect(refund.label).toMatch(/fictional writers/)
    const claude = spec.shots.find(s => s.id === 's4-claude')
    expect(claude.label).toMatch(/team-authored writer · real content · not an independent writer/)
  })
  it('keeps the voice-over word for word in the owner-facing script', () => {
    for (const shot of spec.shots) expect(norm(script), `${shot.id} voice-over is not in demo-video-script.md`).toContain(norm(shot.vo))
  })
  it('fits the story into well under three minutes', () => {
    const total = enabled.reduce((sum, s) => sum + (s.minSeconds ?? 0), 0)
    expect(total).toBeGreaterThan(120)
    expect(total).toBeLessThan(175)
    const words = enabled.reduce((sum, s) => sum + s.vo.split(/\s+/).length, 0)
    expect(words).toBeLessThan(360)
  })
  it('reuses the refusal voice-file ID for zero-question verification and preserves the optional safe decline', () => {
    const corner = spec.shots.find(s => s.id === 's3b-refusal')
    expect(corner.segments.every(s => s.scene === 'hosted-ask')).toBe(true)
    expect(corner.label).toContain('featured run 421bae3d · 12 Nov · 5/5 gates Held')
    expect(corner.vo).toContain('twenty-four checks passed and two not checked')
    expect(spec.shots.indexOf(corner)).toBeLessThan(spec.shots.findIndex(s => s.id === 's2-sandbox'))
    // "outlook" and "prices" match the open central-bank records, which answer from free sources and leave no refusal to prove.
    expect(QUESTIONS.decline).not.toMatch(/\b(outlook|prices?|rates?|yields?|bonds?|bank|inflation|forecast)\b/i)
    for (const question of [QUESTIONS.buy, QUESTIONS.decline]) expect(norm(script), question).toContain(norm(question.replace(/\s+/g, ' ')))
  })
  it('preserves the actual historical MCP question separately from the new hosted preset', () => {
    expect(CLAUDE_PROMPT).toContain(`'${HISTORICAL_MCP_QUESTION}'`)
    expect(HISTORICAL_MCP_QUESTION).not.toBe(QUESTIONS.buy)
    expect(norm(script)).toContain(norm(`ask_expert '${HISTORICAL_MCP_QUESTION}' with budget_sgd=2`))
  })
  it('uses the exact third preset and its own measured payment for the hosted run', () => {
    expect(QUESTIONS.buy).toBe('How does the writer get paid, and what stops the agent from reading the article and then refusing to pay?')
    const hosted = spec.shots.find(s => s.id === 's2-sandbox')
    expect(hosted.vo).toContain(QUESTIONS.buy)
    expect(hosted.vo).toContain('S$0.40')
    expect(hosted.vo).toContain('20.7 seconds')
    expect(hosted.deferred).toBeUndefined()
    expect(script).toContain('0fe8cdb8-541e-4c7b-80c6-854c73cfb4f6')
    expect(script).toContain('https://testnet.xrpl.org/transactions/60D4CA28A9BCB7E1C792CF71261AAEE520CAE117245F9E32E12259D05E1B814C')
    expect(script).toContain('421bae3d-564c-48f8-b5e8-5034b195860a')
  })
  it('describes the shared key without an absolute secrecy claim and qualifies domain excerpts', () => {
    const voice = readFileSync(join(root, 'docs/submission/video/voiceover.txt'), 'utf8')
    for (const text of [script, voice, ...spec.shots.map(s => s.vo)]) {
      expect(text).not.toContain('an agent cannot read the article unless the writer is paid')
      expect(text).not.toMatch(/(?<!Testnet )Permissioned Domain/)
    }
    expect(spec.shots.find(s => s.id === 's2-sandbox').vo).toContain("The key that unlocks the article is the same key that releases the writer's payment.")
    expect(voice).toContain('Signed submission can expose the key before validation.')
  })
  it('starts terminal sessions from an allowlist: no key, token or seed is inherited', () => {
    const before = { ...process.env }
    Object.assign(process.env, { OPENAI_API_KEY: 'x', DEEPSEEK_API_KEY: 'x', PAYER_SEED: 'x', GH_TOKEN: 'x', ANTHROPIC_API_KEY: 'x' })
    try {
      const env = sessionEnv({ REL: 'https://example.org' })
      expect(Object.keys(env).filter(k => /KEY|TOKEN|SEED|SECRET|PASSWORD/i.test(k))).toEqual([])
      expect(env.REL).toBe('https://example.org')
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in before)) delete process.env[k]
      Object.assign(process.env, before)
    }
  })
})


describe('VID-3 release pins and local recording boundaries', () => {
  it('requires team-authored in the MCP result labels, not merely the typed prompt', () => {
    expect(hasTeamAuthoredResult(CLAUDE_PROMPT)).toBe(false)
    expect(hasTeamAuthoredResult(`${CLAUDE_PROMPT}\nCalling researchagent…\nLabels: XRPL TESTNET | writer: "ResearchAgent builders (team-authored)"`)).toBe(true)
    expect(hasTeamAuthoredResult(`${CLAUDE_PROMPT}\nLabels: XRPL TESTNET | writer: unverified`)).toBe(false)
  })
  it('pins the same published release list as the builders corner and rejects an unpublished tag', () => {
    expect(RELEASE_TAG).toBe('v1.1.1')
    expect(() => assertPublished()).not.toThrow()
    expect(() => assertPublished('v9.9.9')).toThrow(/not a published release/)
    for (const url of [TGZ, WHEEL]) expect(url).toContain('/v1.1.1/')
  })
  it.runIf(process.env.CHECK_RELEASE_URLS === '1')('checks real release and uploaded package assets through gh', async () => {
    await checkVideoPins()
  }, 90000)
  it('enables hosted scenes and includes the primary hosted ask in the full cut', () => {
    for (const id of ['hosted-ask', 'hosted-decline', 'ledger']) expect(SCENES.find(s => s.id === id).defer).toBeUndefined()
    expect(spec.shots.find(s => s.id === 's2-sandbox').deferred).toBeUndefined()
    expect(spec.shots.find(s => s.id === 's2-sandbox').label).toContain('live answers, rule-based buying')
  })
  it('keeps the five-second spending plan at 1× while compressing surrounding waits', () => {
    const shot = spec.shots.find(s => s.id === 's2-sandbox')
    const hosted = clip('hosted-ask', 100, { typed: 2, plan_ready: 12, plan_confirmed: 17, answer_read: 85, plan_check: 90 })
    const plan = planShot(shot, { 'hosted-ask': hosted })
    const modal = plan.segments.find(s => s.from === 12 && s.to === 17)
    expect(modal).toMatchObject({ speed: 1, outDur: 5, clock: false })
    expect(plan.segments.filter(s => s.speed > 1)).toHaveLength(2)
  })
  it('keeps owner voice text and the cut in sync, including deferred shots', () => {
    const voice = readFileSync(join(root, 'docs/submission/video/voiceover.txt'), 'utf8')
    for (const shot of spec.shots) expect(norm(voice)).toContain(norm(shot.vo))
  })
  it('uses gh downloads or committed receipts, never GitHub browser/raw fetches', () => {
    const source = readFileSync(join(root, 'scripts/video/scenes.mjs'), 'utf8')
    expect(source).not.toMatch(/page.goto\(`\$\{REPO\}/)
    expect(source).not.toContain('raw.githubusercontent.com')
    expect(source).toContain('MCP result must visibly say team-authored')
  })
})


describe('explicit recorder target', () => {
  it('never probes hosted in local mode', async () => {
    const target = await resolveRecordingTarget('local', { startLocal: async () => ({ url: 'https://localhost:12345' }), probe: () => { throw new Error('unexpected hosted probe') } })
    expect(target).toEqual({ kind: 'local', base: 'https://localhost:12345' })
  })
  it('uses the accepted hosted target without starting local', async () => {
    const status = { reachable: true, state: 'ready', labels: { models: 'live answers, rule-based buying' } }
    const target = await resolveRecordingTarget('hosted', { probe: async () => status, startLocal: () => { throw new Error('unexpected local fallback') } })
    expect(target).toMatchObject({ kind: 'hosted', base: 'https://ra-front-651013803640.asia-southeast1.run.app', status })
    expect(SCENES.find(s => s.id === 'hosted-ask').contextOptions(target).viewport).toEqual({ width: 1280, height: 720 })
  })
  it('refuses unavailable hosted targets instead of substituting local footage', async () => {
    for (const state of ['paused', 'ended', 'unreachable']) await expect(resolveRecordingTarget('hosted', { probe: async () => ({ reachable: state !== 'unreachable', state }) })).rejects.toThrow('Hosted capture unavailable')
    await expect(resolveRecordingTarget('auto')).rejects.toThrow('Use --target')
  })
})


it('requires actual live answer provenance rather than only a configured buying chip', () => {
  expect(() => assertHostedModels('Research · deepseek · live\nDecide · fixture · offline rules')).not.toThrow()
  expect(() => assertHostedModels('Research · fixture · offline extracts (fallback)\nDecide · fixture')).toThrow('retain actual provenance')
  expect(() => assertHostedModels('Research · deepseek\nDecide · openai')).toThrow()
  expect(() => assertHostedModels('')).toThrow()
})
