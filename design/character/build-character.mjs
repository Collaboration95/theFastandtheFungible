#!/usr/bin/env node
// Source of truth for the ResearchAgent pixel character (v2).
// node design/character/build-character.mjs          write every export
// node design/character/build-character.mjs --check  exit 1 if committed exports drift
// Pure Node: frames are character grids below, PNG via node:zlib, GIF via the
// LZW encoder in this file. Text in the social exports is Geist (the committed
// site/brand WOFF2) outlined by fontkit, the brand build's locked dev
// dependency, and rasterised here. No network, browser or image model.
import { deflateSync, inflateSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openSync } from 'fontkit'
import { palette as brand } from '../cast/build-cast.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// ── Palette: brand tokens only. Index 0 is transparent. ──────────────────────
// Ledger grey is the midpoint of the brand rule (#C9BFB2) and secondary text
// (#655D55). The last five entries are not used by the character: GitHub dark
// and light for evidence previews, and three Ink-on-Paper steps that
// anti-alias the wordmark and captions on Paper backgrounds.
const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('')
const COLORS = [
  [' ', null], ['K', brand.ink], ['P', brand.paper], ['g', '#655D55'], ['S', brand.salmon],
  ['D', brand.deep], ['G', brand.green], ['O', brand.ochre], ['R', brand.red], ['L', '#978E83'],
  ['d', '#0D1117'], ['w', '#FFFFFF'], ['1', mix(brand.paper, brand.ink, 0.25)], ['2', mix(brand.paper, brand.ink, 0.5)], ['3', mix(brand.paper, brand.ink, 0.75)],
]
const KEY = Object.fromEntries(COLORS.map(([c], i) => [c, i]))
KEY['.'] = 0
const RGB = COLORS.map(([, hex]) => hex ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) : [0, 0, 0])
const DARK = KEY.d, LIGHT = KEY.w, PAPER = KEY.P

// ── Sprites ──────────────────────────────────────────────────────────────────
// A sprite is {w,h,px}. `grid` parses rows; `outlined` adds the 1-px Paper rim
// (4-neighbour) so every part reads on GitHub dark and light alike.
function grid(rows) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length, px = new Uint8Array(w * h)
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (!(c in KEY)) throw new Error(`bad pixel ${c}`); px[y * w + x] = KEY[c] }))
  return { w, h, px }
}
function outlined(s) {
  const w = s.w + 2, h = s.h + 2, px = new Uint8Array(w * h)
  const at = (x, y) => x >= 0 && y >= 0 && x < s.w && y < s.h ? s.px[y * s.w + x] : 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = at(x - 1, y - 1)
    px[y * w + x] = v || (at(x - 2, y - 1) || at(x, y - 1) || at(x - 1, y - 2) || at(x - 1, y) ? KEY.P : 0)
  }
  return { w, h, px }
}
function canvas(w, h, fill = 0) { const c = { w, h, px: new Uint8Array(w * h) }; if (fill) c.px.fill(fill); return c }
function draw(c, s, x, y) {
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
    const v = s.px[j * s.w + i], X = x + i, Y = y + j
    if (v && X >= 0 && Y >= 0 && X < c.w && Y < c.h) c.px[Y * c.w + X] = v
  }
  return c
}
const dot = (c, x, y, v) => { if (x >= 0 && y >= 0 && x < c.w && y < c.h) c.px[y * c.w + x] = v }

// ── The agent, facing right. Fill coordinates: soles on row FEET. ────────────
// Hood: a big Ink helmet; the Paper visor is the face. Eyes, blush and mouth
// are stamped on per state, so expression changes without redrawing the head.
const HEAD = grid([
  '......KKKKKKKKKK......',
  '...KKKKKKKKKKKKKKKK...',
  '..KKggggKKKKKKKKKKKK..',
  '.KKgKKKKKKKKKKKKKKKKK.',
  '.KgKKKKKKKKKKKKKKKKKK.',
  'KKgKKKKKKKKKKKKKKKKKKK',
  'KKKKKKPPPPPPPPPPPPPPKK',
  'KKKKKPPPPPPPPPPPPPPPPK',
  'KKKKKPPPPPPPPPPPPPPPPK',
  'KKKKKPPPPPPPPPPPPPPPPK',
  'KKKKKPPPPPPPPPPPPPPPPK',
  'KKKKKPPPPPPPPPPPPPPPPK',
  'KKKKKPPPPPPPPPPPPPPPPK',
  'KKKKKKPPPPPPPPPPPPPPKK',
  '.KKKKKKKKKKKKKKKKKKKK.',
  '..KKKKKKKKKKKKKKKKKK..',
  '....KKKKKKKKKKKKKK....',
])
const EYES = {
  open: ['.KK', '.KK', '.KK'],
  blink: ['...', '...', 'KKK'],
  happy: ['.K.', 'K.K', '...'],
  focus: ['...', '.KK', '.KK'],
  up: ['.KK', '.KK', '...'],
}
const MOUTH = { none: ['....', '....'], smile: ['K..K', '.KK.'], o: ['.KK.', '.KK.'], flat: ['....', '.KK.'], frown: ['.KK.', 'K..K'] }
// Coat: a Salmon scarf over Ink. The satchel carries the open-index mark: two
// Ink source boundaries and the Salmon ascending route on a Paper flap.
const TORSO = grid([
  '.SSSSSSSSSSSSSS.',
  '.DSSSSSSSSSSSSD.',
  '.KKKKKKKKKKKKKK.',
  'KKKKKKKKKKKKKKKK',
  'KKKKKKKKKKKKKKKK',
  'KKKKKKKKKKKKKKKK',
  'KKKKKKKKKKKKKKKK',
  '.KKKKKKKKKKKKKK.',
])
const SATCHEL = grid([
  '.KKKKKKKKK.',
  'KPPPPPPPPPK',
  'KPKKPPPKKPK',
  'KPKPPPPSKPK',
  'KPKPPPSPKPK',
  'KPKPPSPPKPK',
  'KPKPSPPPKPK',
  'KPKKPPPKKPK',
  'KKKKKKKKKKK',
])
const STRAP = [[11, 25], [12, 25], [13, 24], [14, 24], [15, 24], [16, 24]]
// Scarf tail: hangs at rest, streams back while walking.
const TAILS = {
  hang: { s: grid(['.S', 'SS', 'SD', 'S.']), x: 5, y: 23 },
  streamA: { s: grid(['...SSS', 'SSSSD.', 'SD....']), x: 1, y: 22 },
  streamB: { s: grid(['..SSSS', '.SSDD.', 'SS....']), x: 1, y: 23 },
}
// Antenna: the mark's ascending route, rising from the hood at 45°.
const ANTENNA = { up: [[16, 4], [17, 3], [18, 2]], lag: [[16, 4], [16, 3], [17, 2]] }
const TIP = { up: [19, 0], lag: [17, 0] }
// Legs: front leg Ink, back leg Slate. Strides are a row shorter than passes,
// so the body dips on contact and rises on the pass: the walk has weight.
const LEGS = {
  stand: grid(['...ggg...KKK....', '...ggg...KKK....', '...ggg...KKK....', '...ggg...KKK....', '...gggg..KKKK...', '...gggg..KKKK...']),
  strideA: grid(['.....ggKKK......', '....ggg..KKK....', '...ggg....KKK...', '.gggg......KKKK.', '.gggg......KKKK.']),
  passA: grid(['......gg.KKK....', '.....ggg.KKK....', '....gggg.KKK....', '....ggg..KKK....', '.........KKKK...', '.........KKKK...']),
  strideB: grid(['.....KKKgg......', '....KKK..ggg....', '...KKK....ggg...', '.KKKK......gggg.', '.KKKK......gggg.']),
  passB: grid(['....KKK..ggg....', '....KKK..ggg....', '...KKKK..ggg....', '...KKK...ggg....', '.........gggg...', '.........gggg...']),
}
// Front arm: Ink sleeve, Paper mitten with an Ink edge (reads on white too).
// `hand` is the mitten's centre in fill coordinates, for held props.
const arm = (rows, x, y, hand) => ({ s: grid(rows), x, y, hand })
const ARMS = {
  down: arm(['KK..', 'KKK.', 'KKK.', 'KKK.', 'KPPK', 'KPPK', '.KK.'], 20, 24, [22, 29]),
  swingF: arm(['KK....', 'KKK...', '.KKK..', '..KKK.', '..KPPK', '..KPPK', '...KK.'], 20, 24, [24, 29]),
  swingB: arm(['...KK', '..KKK', '.KKK.', 'KPPK.', 'KPPK.', '.KK..'], 17, 24, [19, 28]),
  forward: arm(['KKKKK.KK.', 'KKKKKKPPK', 'KKKKKKPPK', '......KK.'], 20, 25, [27, 26]),
  reach: arm(['.....KK.', '....KPPK', '..KKKPPK', 'KKKKKKK.', 'KKKK....', 'KKK.....'], 20, 20, [26, 21]),
  chin: arm(['.KK...', 'KPPK..', 'KPPK..', '.KKKK.', '..KKKK', '..KKKK', '.KKKK.', 'KKK...'], 19, 18, [20, 19]),
  wave: arm(['......KK..', '.....KPPK.', '.....KPPK.', '......KK..', '.....KKK..', '.....KKK..', '....KKK...', '....KKK...', '....KKK...', '...KKK....', '...KKK....', '...KKK....', '..KKK.....', '..KKK.....', '.KKK......', '.KKK......', '.KKK......', 'KKK.......', 'KKK.......'], 22, 6, [28, 8]),
  wave2: arm(['.......KK.', '......KPPK', '......KPPK', '.......KK.', '.....KKK..', '.....KKK..', '....KKK...', '....KKK...', '....KKK...', '...KKK....', '...KKK....', '...KKK....', '..KKK.....', '..KKK.....', '.KKK......', '.KKK......', '.KKK......', 'KKK.......', 'KKK.......'], 22, 6, [29, 8]),
}
const FEET = 35, M = 10
function agent(c, x, g, o = {}) {
  const t = canvas(64, 64), legs = LEGS[o.legs ?? 'stand'], dy = 6 - legs.h, A = ARMS[o.arm ?? 'down']
  const at = (s, fx, fy) => draw(t, s, fx + M, fy + M + dy), px = (fx, fy, v) => dot(t, fx + M, fy + M + dy, v)
  const tail = TAILS[o.tail ?? 'hang']
  draw(t, tail.s, tail.x + M, tail.y + M + dy)
  draw(t, legs, 7 + M, 30 + M + dy)
  at(TORSO, 7, 22)
  at(SATCHEL, 0, 25)
  for (const [sx, sy] of STRAP) px(sx, sy, KEY.g)
  at(HEAD, 4, 5)
  at(grid(EYES[o.eyes ?? 'open']), 14, 13); at(grid(EYES[o.eyes ?? 'open']), 20, 13)
  at(grid(MOUTH[o.mouth ?? 'none']), 17, 16)
  px(13, 16, KEY.S); px(14, 16, KEY.S); px(22, 16, KEY.S); px(23, 16, KEY.S)
  const ant = o.antenna ?? 'up'
  for (const [ax, ay] of ANTENNA[ant]) px(ax, ay, KEY.K)
  for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) px(TIP[ant][0] + i, TIP[ant][1] + j, o.lit ? KEY.O : KEY.S)
  for (const [s, hx, hy] of o.hold ?? []) at(s, hx, hy)
  at(A.s, A.x, A.y)
  draw(c, outlined(t), x - M - 1, g - FEET - M - 1)
  return { hand: [x + A.hand[0], g - FEET + A.hand[1] + dy], top: g - FEET + dy }
}

// ── Props. Fill grids; standalone props get their own rim. ───────────────────
const G = {
  pageHidden: grid([
    'KKKKKKKK....', 'KPPPPPPKK...', 'KPPPPPPKPK..', 'KPPPPPPKPPK.', 'KPPPPPPKKKKK', 'KPPPPPPPPPPK', 'KPLLLLLLLPPK', 'KPPPPPPPPPPK',
    'KPLLLLLLPPPK', 'KPPPPPPPPPPK', 'KPLLLLLLLLPK', 'KPPPPPPPPPPK', 'KPLLLLLPPPPK', 'KPPPPPPPPPPK', 'KKKKKKKKKKKK']),
  pageOpen: grid([
    'KKKKKKKK....', 'KPPPPPPKK...', 'KPSSSPPKPK..', 'KPPPPPPKPPK.', 'KPPPPPPKKKKK', 'KPPPPPPPPPPK', 'KPKKKKKKKPPK', 'KPPPPPPPPPPK',
    'KPKKKKKKPPPK', 'KPPPPPPPPPPK', 'KPKKKKKKKKPK', 'KPPPPPPPPPPK', 'KPKKKKKPPPPK', 'KPPPPPPPPPPK', 'KKKKKKKKKKKK']),
  // Escrow lock: Paper coin slot, keyhole below. Funded shows the coin in Salmon.
  lock: grid(['...KKKKK...', '..KK...KK..', '..K.....K..', '..K.....K..', 'KKKKKKKKKKK', 'KgggggggggK', 'KKKPPPPPKKK', 'KKKKKKKKKKK', 'KKKKKPKKKKK', 'KKKKPPPKKKK', 'KKKKKPKKKKK', 'KKKKKKKKKKK']),
  lockFunded: grid(['...KKKKK...', '..KK...KK..', '..K.....K..', '..K.....K..', 'KKKKKKKKKKK', 'KgggggggggK', 'KKKSSSSSKKK', 'KKKKKKKKKKK', 'KKKKKPKKKKK', 'KKKKPPPKKKK', 'KKKKKPKKKKK', 'KKKKKKKKKKK']),
  lockOpen: grid(['...KKKKK...', '..KK...KK..', '..K.....K..', '..K........', '..K........', '..K........', 'KKKKKKKKKKK', 'KgggggggggK', 'KKKSSSSSKKK', 'KKKKKKKKKKK', 'KKKKKOKKKKK', 'KKKKOOOKKKK', 'KKKKKOKKKKK', 'KKKKKKKKKKK']),
  lockBroken: grid(['...KKKKK...', '..KK...KK..', '..K.....K..', '..K.....K..', 'KKKKKKKKKKK', 'KgggggggggK', 'KKKPPPPPKKK', 'KKKKKKKKKKK', 'KKKKRKRKKKK', 'KKKKKRKKKKK', 'KKKKRKRKKKK', 'KKKKKKKKKKK']),
  coin: grid(['..SSS..', '.SSSSS.', 'SSSSDSS', 'SSSDSSS', 'SSDSSSS', '.SSSSS.', '..SSS..']),
  coinEdge: grid(['.S.', 'SDS', 'SDS', 'SDS', 'SDS', 'SDS', '.S.']),
  key: grid(['.OOO.', 'O...O', 'O...O', '.OOO.', '..O..', '..O..', '..OO.', '..O..', '..OO.']),
  keyIn: grid(['.OOO.', 'O...O', 'O...O', '.OOO.', '..O..']),
  keyTurn: grid(['OO', 'OO', 'OO', 'OO', 'O.']),
  check: grid(['...GGGGG...', '.GGGGGGGGG.', '.GGGGGGGPG.', 'GGGGGGGPPGG', 'GGGGGGPPGGG', 'GGPGGPPGGGG', 'GGPPPPGGGGG', 'GGGPPGGGGGG', '.GGGGGGGGG.', '.GGGGGGGGG.', '...GGGGG...']),
  cross: grid(['RR...RR', '.RR.RR.', '..RRR..', '.RR.RR.', 'RR...RR']),
  sparkle: grid(['..O..', '..O..', 'OO.OO', '..O..', '..O..']),
  dot: grid(['KK', 'KK']),
  magnifier: grid(['.....KKKK..', '....KPPPPK.', '...KPLPPPPK', '...KLPPPPPK', '...KPPPPPPK', '...KPPPPPPK', '....KPPPPK.', '...ggKKKK..', '..gg.......', '.gg........', 'gg.........']),
  magnifierGlint: grid(['.....KKKK..', '....KPPPPK.', '...KPPPLPPK', '...KPPLPPPK', '...KPPPPPPK', '...KPPPPPPK', '....KPPPPK.', '...ggKKKK..', '..gg.......', '.gg........', 'gg.........']),
}
const OUT = Object.fromEntries(Object.entries(G).map(([k, s]) => [k, outlined(s)]))
const prop = (c, name, x, y) => draw(c, OUT[name], x - 1, y - 1)

// ── Scenes: one description per story beat, positioned relative to the agent.
// The escrow lock stands PROPS px right of the agent, in front of the page's
// lower-left corner. Shared by the sheet, the hero strip, the loop and social.
const PROPS = 36
const LOCKS = { lock: 'lock', funded: 'lockFunded', open: 'lockOpen', broken: 'lockBroken' }
function scene(c, x, g, s = {}) {
  const px = s.propsAt ?? x + PROPS, lockTop = g - G.lock.h + 1
  if (s.page) { const p = s.page === 'open' ? 'pageOpen' : 'pageHidden'; prop(c, p, px + 7, g - G[p].h + 1) }
  if (s.lock) prop(c, LOCKS[s.lock], px, g - G[LOCKS[s.lock]].h + 1)
  const a = { ...s.agent }
  if (s.magnifier !== undefined) Object.assign(a, { arm: 'reach', eyes: 'focus', hold: [[s.magnifier ? G.magnifierGlint : G.magnifier, 27, 10]] })
  if (s.coin === 'hand') Object.assign(a, { arm: 'forward', hold: [[G.coin, 25, 18]] })
  if (s.carry) Object.assign(a, { arm: 'forward', hold: [[G.pageOpen, 26, 12]] })
  const r = agent(c, x, g, a)
  const slot = [px + 2, lockTop - 3], top = r.top
  if (s.coin === 'arc') prop(c, 'coinEdge', ((slot[0] + r.hand[0]) >> 1) + 2, Math.min(slot[1], top + 18) - 6)
  if (s.coin === 'slot') prop(c, 'coin', slot[0], slot[1] - 1)
  if (s.coin === 'return') prop(c, 'coin', slot[0], slot[1] - 8)
  if (s.key === 'drop') prop(c, 'key', px + 3, lockTop - 13)
  if (s.key === 'in') prop(c, 'keyIn', px + 3, lockTop + 4)
  if (s.key === 'turn') prop(c, 'keyTurn', px + 4, lockTop + 4)
  if (s.sparkle) { prop(c, 'sparkle', px + 13, lockTop - 12); prop(c, 'sparkle', px - 2, lockTop - 6) }
  if (s.cross) prop(c, 'cross', px + 9, lockTop - 12)
  if (s.check) prop(c, 'check', x + 34, top + 2 - (s.check === 'up' ? 1 : 0))
  for (let i = 0; i < (s.dots ?? 0); i++) prop(c, 'dot', x + 24 + i * 4, top - 1 - i * 2)
  return r
}
const pageLock = { page: 'hidden', lock: 'lock' }
const WALK = [
  { legs: 'strideA', arm: 'swingB', tail: 'streamA', antenna: 'lag' },
  { legs: 'passA', arm: 'down', tail: 'streamB', antenna: 'up' },
  { legs: 'strideB', arm: 'swingF', tail: 'streamA', antenna: 'lag' },
  { legs: 'passB', arm: 'down', tail: 'streamB', antenna: 'up' },
]
const BEATS = {
  idle: [{}, { agent: { antenna: 'lag' } }, { agent: { eyes: 'blink' } }, {}],
  walk: WALK.map(agent => ({ agent })),
  search: [0, 1, 0, 1].map(m => ({ ...pageLock, magnifier: m })),
  thinking: [0, 1, 2, 3].map(n => ({ ...pageLock, dots: n, agent: { arm: 'chin', eyes: n === 3 ? 'blink' : 'up', mouth: 'flat', lit: n % 2 === 1 } })),
  pay: [
    { ...pageLock, coin: 'hand', agent: { mouth: 'flat' } },
    { ...pageLock, coin: 'arc', agent: { arm: 'forward', eyes: 'focus' } },
    { ...pageLock, coin: 'slot', agent: { arm: 'forward', eyes: 'focus' } },
    { page: 'hidden', lock: 'funded', agent: { mouth: 'smile' } },
  ],
  'key-reveal': [
    { page: 'hidden', lock: 'funded', key: 'drop', agent: { eyes: 'up' } },
    { page: 'hidden', lock: 'funded', key: 'in', agent: { eyes: 'focus' } },
    { page: 'hidden', lock: 'funded', key: 'turn', agent: { mouth: 'o' } },
    { page: 'open', lock: 'open', sparkle: true, agent: { eyes: 'happy', mouth: 'smile' } },
  ],
  verified: [
    { carry: true, agent: { mouth: 'smile' } },
    { carry: true, check: true, agent: { eyes: 'happy', mouth: 'smile' } },
    { carry: true, check: 'up', agent: { eyes: 'blink', mouth: 'smile' } },
    { carry: true, check: true, agent: { eyes: 'happy', mouth: 'smile' } },
  ],
  refund: [
    { page: 'hidden', lock: 'broken', cross: true, agent: { mouth: 'frown' } },
    { page: 'hidden', lock: 'broken', coin: 'return', agent: { eyes: 'up', mouth: 'frown' } },
    { ...pageLock, coin: 'arc', agent: { arm: 'forward', mouth: 'flat' } },
    { ...pageLock, coin: 'hand', agent: { eyes: 'happy', mouth: 'smile' } },
  ],
}

// ── Sprite sheet: one row per animation so CSS steps() can run each strip. ──
const CELL = { w: 64, h: 48 }, CG = 45, AX = 2
const ANIMS = Object.entries({ idle: 350, walk: 120, search: 180, thinking: 260, pay: 160, 'key-reveal': 220, verified: 300, refund: 200 })
  .map(([name, ms]) => [name, ms, BEATS[name].map(beat => c => scene(c, AX, CG, beat))])

function sheet() {
  const cols = Math.max(...ANIMS.map(([, , f]) => f.length))
  const c = canvas(cols * CELL.w, ANIMS.length * CELL.h)
  const atlas = { image: 'sprite-sheet.png', size: { w: c.w, h: c.h }, cell: CELL, frames: {}, animations: {} }
  ANIMS.forEach(([name, ms, frames], row) => {
    atlas.animations[name] = { row, y: row * CELL.h, frames: frames.length, duration: ms, frameNames: [] }
    frames.forEach((fn, i) => {
      const cell = canvas(CELL.w, CELL.h); fn(cell); draw(c, cell, i * CELL.w, row * CELL.h)
      const id = `${name}-${i}`
      atlas.frames[id] = { x: i * CELL.w, y: row * CELL.h, w: CELL.w, h: CELL.h, duration: ms }
      atlas.animations[name].frameNames.push(id)
    })
  })
  return { c, atlas }
}

// The story as timed beats (centiseconds): find, decide, pay into escrow, the
// writer's key turns, the page unlocks and is verified, the proof is anchored.
const STORY = [
  [40, {}], [12, BEATS.idle[2]], [20, {}], ...[0, 1, 0, 1].map(m => [16, BEATS.search[m]]), ...[1, 2, 3].map(n => [22, BEATS.thinking[n]]),
  [18, BEATS.pay[0]], [8, BEATS.pay[1]], [8, BEATS.pay[2]], [40, BEATS.pay[3]],
  [36, BEATS['key-reveal'][0]], [14, BEATS['key-reveal'][1]], [26, BEATS['key-reveal'][2]], [50, BEATS['key-reveal'][3]],
  [24, BEATS.verified[0]], [30, BEATS.verified[1], 'anchor'], [10, BEATS.verified[2], 'anchor'], [50, BEATS.verified[3], 'anchor'],
]

// ── Story strip: walk the ledger in, the story, walk off with the page. ─────
// The ledger is dashed grey; the proof's segment turns Salmon and stays.
function ledger(c, line, anchorX, phase = 0) {
  for (let x = 0; x < c.w; x++) if ((x + phase) % 6 < 4) c.px[line * c.w + x] = KEY.L
  if (anchorX !== undefined) for (let x = anchorX; x < anchorX + 12; x++) for (const y of [line, line + 1]) dot(c, x, y, KEY.S)
}
// W×H at 1×: soles on row H-5, ledger on row H-3.
function strip(W, H, stop) {
  const f = [], g = H - 5, line = H - 3, anchorX = stop + PROPS
  const add = (cs, paint, label) => { const c = canvas(W, H); paint(c); f.push({ c, cs, label }) }
  let step = 0
  for (let x = -40; x < stop; x += 3) { const a = WALK[step++ % 4]; add(10, c => { ledger(c, line); scene(c, x, g, { ...pageLock, propsAt: anchorX, agent: a }) }, step === 14 ? 'walk' : undefined) }
  for (const [cs, beat, anchor] of STORY) add(cs, c => { ledger(c, line, anchor && anchorX); scene(c, stop, g, beat) }, beat === BEATS.search[1] ? 'search' : beat === BEATS.pay[1] ? 'pay' : beat === BEATS['key-reveal'][2] ? 'key' : beat === BEATS.verified[3] ? 'verified' : undefined)
  step = 0
  for (let x = stop + 3; x < W + 8; x += 3) { const a = WALK[step++ % 4]; add(10, c => { ledger(c, line, anchorX); scene(c, x, g, { carry: true, agent: { ...a, arm: 'forward', mouth: 'smile' } }) }, step === 8 ? 'off' : undefined) }
  add(80, c => ledger(c, line, anchorX))
  return f
}
const HERO = { w: 336, h: 46, stop: 118, scale: 2 }
const heroFrames = () => strip(HERO.w, HERO.h, HERO.stop)
// Compact site loop: the same story in place.
const LOOP = { w: 80, h: 54, scale: 2 }
function loopFrames() {
  const g = LOOP.h - 5, x = 4
  return STORY.map(([cs, beat, anchor]) => { const c = canvas(LOOP.w, LOOP.h); ledger(c, LOOP.h - 3, anchor && x + PROPS); scene(c, x, g, beat); return { c, cs } })
}
// App state loops: one sheet row.
function stateFrames(name) {
  const [, ms, frames] = ANIMS.find(([n]) => n === name)
  return frames.map(fn => { const c = canvas(CELL.w, CELL.h); fn(c); return { c, cs: Math.round(ms / 10) } })
}

// ── Raster helpers for full-size compositions ────────────────────────────────
function scaled(c, k) {
  const o = canvas(c.w * k, c.h * k)
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.px[y * o.w + x] = c.px[((y / k) | 0) * c.w + ((x / k) | 0)]
  return o
}
function flatten(c, bg) { const o = canvas(c.w, c.h); for (let i = 0; i < c.px.length; i++) o.px[i] = c.px[i] || bg; return o }
const blit = (dst, src, k, x, y) => draw(dst, scaled(src, k), x, y)
// Non-zero polygon fill with 4×4 supersampling. On Paper, coverage maps to the
// three Ink-on-Paper steps; `solid` thresholds at half coverage instead.
function fill(c, polys, solid) {
  const pts = polys.flat(), y0 = Math.max(0, Math.floor(Math.min(...pts.map(p => p[1])))), y1 = Math.min(c.h - 1, Math.ceil(Math.max(...pts.map(p => p[1]))))
  const edges = polys.flatMap(p => p.map((a, i) => [a, p[(i + 1) % p.length]]))
  for (let y = y0; y <= y1; y++) {
    const cov = new Map()
    for (let sub = 0; sub < 4; sub++) {
      const sy = y + (sub + 0.5) / 4, xs = []
      for (const [a, b] of edges) if ((a[1] <= sy) !== (b[1] <= sy)) xs.push([a[0] + (sy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]), b[1] > a[1] ? 1 : -1])
      xs.sort((p, q) => p[0] - q[0])
      let wind = 0, start = 0
      for (const [x, d] of xs) {
        const was = wind; wind += d
        if (!was && wind) start = x
        if (was && !wind) for (let k = Math.ceil(start * 4 - 0.5); k <= Math.ceil(x * 4 - 0.5) - 1; k++) { const X = k >> 2; cov.set(X, (cov.get(X) ?? 0) + 1) }
      }
    }
    for (const [x, n] of cov) {
      if (x < 0 || x >= c.w) continue
      const level = Math.round(n / 4)
      if (solid !== undefined) { if (n >= 8) c.px[y * c.w + x] = solid; continue }
      if (level) c.px[y * c.w + x] = [0, KEY['1'], KEY['2'], KEY['3'], KEY.K][level]
    }
  }
}
let geist
function text(c, s, x, baseline, size, { solid } = {}) {
  geist ??= openSync(resolve(root, 'site/brand/geist-latin-wght-normal.woff2'))
  const font = geist, run = font.layout(s), k = size / font.unitsPerEm, polys = []
  let adv = 0
  run.glyphs.forEach((gl, i) => {
    const pos = run.positions[i], ox = x + (adv + pos.xOffset) * k, P = (px, py) => [ox + px * k, baseline - (py + pos.yOffset) * k]
    let cur = null, last = [0, 0]
    for (const { command, args } of gl.path.commands) {
      if (command === 'moveTo') { if (cur?.length > 2) polys.push(cur); cur = [P(...args)]; last = args }
      else if (command === 'lineTo') { cur.push(P(...args)); last = args }
      else if (command === 'quadraticCurveTo') { for (let t = 1; t <= 8; t++) { const u = t / 8, v = 1 - u; cur.push(P(v * v * last[0] + 2 * v * u * args[0] + u * u * args[2], v * v * last[1] + 2 * v * u * args[1] + u * u * args[3])) } last = args.slice(2) }
      else if (command === 'bezierCurveTo') { for (let t = 1; t <= 10; t++) { const u = t / 10, v = 1 - u; cur.push(P(v ** 3 * last[0] + 3 * v * v * u * args[0] + 3 * v * u * u * args[2] + u ** 3 * args[4], v ** 3 * last[1] + 3 * v * v * u * args[1] + 3 * v * u * u * args[3] + u ** 3 * args[5])) } last = args.slice(4) }
      else if (command === 'closePath') { if (cur?.length > 2) polys.push(cur); cur = null }
    }
    if (cur?.length > 2) polys.push(cur)
    adv += pos.xAdvance
  })
  if (polys.length) fill(c, polys, solid)
  return adv * k
}
// The open-index mark (design/brand: 24 units, 1.5 stroke, square caps).
function mark(c, x, y, unit) {
  const r = (ax, ay, bx, by) => [[x + ax * unit, y + ay * unit], [x + bx * unit, y + ay * unit], [x + bx * unit, y + by * unit], [x + ax * unit, y + by * unit]]
  const h = 0.75, n = h / Math.SQRT2, d = h / Math.SQRT2
  const route = [[9 - d - n, 15 + d - n], [9 - d + n, 15 + d + n], [15 + d + n, 9 - d + n], [15 + d - n, 9 - d - n]].map(([px, py]) => [x + px * unit, y + py * unit])
  fill(c, [r(4 - h, 4 - h, 9 + h, 4 + h), r(4 - h, 4 - h, 4 + h, 20 + h), r(4 - h, 20 - h, 9 + h, 20 + h),
    r(15 - h, 4 - h, 20 + h, 4 + h), r(20 - h, 4 - h, 20 + h, 20 + h), r(15 - h, 20 - h, 20 + h, 20 + h), route])
}
// Lockup as in design/brand/lockup.svg: mark 1.333× at (0,8), Geist 32 at x 48.
function lockup(c, x, y, s) { mark(c, x, y + 8 * s, 1.333333 * s); return 48 * s + text(c, 'ResearchAgent', x + 48 * s, y + 34 * s, 32 * s) }

// ── Encoders ─────────────────────────────────────────────────────────────────
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length), td = Buffer.concat([Buffer.from(type), data])
  out.writeUInt32BE(data.length, 0); td.copy(out, 4); out.writeUInt32BE(crc32(td), 8 + data.length); return out
}
function png(c) {
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h)
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const v = c.px[y * c.w + x], o = y * (c.w * 4 + 1) + 1 + x * 4, [r, g, b] = RGB[v]
    raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = v ? 255 : 0
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(c.w, 0); ihdr.writeUInt32BE(c.h, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}
// PNG bytes depend on the zlib build; drift checks compare decoded RGBA instead.
export function decodePng(buf) {
  let pos = 8, w = 0, h = 0; const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[9] !== 6 || data[12]) throw new Error('expected 8-bit RGBA non-interlaced PNG') }
    if (type === 'IDAT') idat.push(data)
    pos += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * 4, out = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? out[y * stride + x - 4] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= 4 && y ? out[(y - 1) * stride + x - 4] : 0
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]
      out[y * stride + x] = (line[x] + pred) & 255
    }
  }
  return { w, h, rgba: out }
}
// Reads a committed brand-palette PNG back into palette indices.
function unpng(buf) {
  const { w, h, rgba } = decodePng(buf), c = canvas(w, h)
  for (let i = 0; i < w * h; i++) {
    if (!rgba[i * 4 + 3]) continue
    const v = RGB.findIndex((rgb, j) => j && rgb.every((x, k) => x === rgba[i * 4 + k]))
    if (v < 0) throw new Error('colour outside the brand palette'); c.px[i] = v
  }
  return c
}
function lzw(indices, min) {
  const bytes = []; let cur = 0, bits = 0
  const emit = (code, size) => { cur |= code << bits; bits += size; while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8 } }
  const clear = 1 << min, eoi = clear + 1
  let size = min + 1, next = eoi + 1, table = new Map(), prefix = indices[0]
  emit(clear, size)
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = prefix * 256 + k, hit = table.get(key)
    if (hit !== undefined) { prefix = hit; continue }
    emit(prefix, size)
    if (next === 4096) { emit(clear, size); next = eoi + 1; size = min + 1; table = new Map() }
    else { if (next >= 1 << size) size++; table.set(key, next++) }
    prefix = k
  }
  emit(prefix, size); emit(eoi, size)
  if (bits) bytes.push(cur & 255)
  const out = [min]
  for (let i = 0; i < bytes.length; i += 255) { const n = Math.min(255, bytes.length - i); out.push(n, ...bytes.slice(i, i + n)) }
  out.push(0)
  return Buffer.from(out)
}
// 16-colour global table, infinite loop. Transparent animations: index 0 is
// transparent, every frame is cropped to its opaque bounds with disposal 2
// (restore to background), so nothing smears. Opaque animations: frame 1 is
// whole, later frames carry only the rectangle that changed (disposal 1).
function gif(frames, k = 1, bg) {
  const W = frames[0].c.w * k, H = frames[0].c.h * k
  const table = Buffer.alloc(16 * 3)
  RGB.forEach(([r, g, b], i) => { table[i * 3] = r; table[i * 3 + 1] = g; table[i * 3 + 2] = b })
  const parts = [Buffer.from('GIF89a'), Buffer.from([W & 255, W >> 8, H & 255, H >> 8, 0xf3, 0, 0]), table,
    Buffer.from([0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0])]
  let prev = null
  for (const { c: small, cs } of frames) {
    const c = k === 1 && bg === undefined ? small : scaled(bg === undefined ? small : flatten(small, bg), k)
    let x0 = c.w, y0 = c.h, x1 = -1, y1 = -1
    const keep = bg === undefined ? i => c.px[i] : i => !prev || prev.px[i] !== c.px[i]
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (keep(y * c.w + x)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0 }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, idx = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) idx.set(c.px.subarray((y + y0) * c.w + x0, (y + y0) * c.w + x0 + w), y * w)
    const packed = bg === undefined ? (2 << 2) | 1 : 1 << 2
    parts.push(Buffer.from([0x21, 0xf9, 4, packed, cs & 255, cs >> 8, 0, 0]),
      Buffer.from([0x2c, x0 & 255, x0 >> 8, y0 & 255, y0 >> 8, w & 255, w >> 8, h & 255, h >> 8, 0]), lzw(idx, 4))
    prev = c
  }
  parts.push(Buffer.from([0x3b]))
  return Buffer.concat(parts)
}

// ── Compositions ─────────────────────────────────────────────────────────────
function contact(frames, picks, bg, gap = 4) {
  const w = frames[0].c.w, h = frames[0].c.h, c = canvas(w, picks.length * (h + gap) - gap, bg)
  picks.forEach((p, i) => draw(c, frames[p].c, 0, i * (h + gap)))
  return c
}
// v1 (frozen copy of the merged sheet) above v2, same states, same scale.
const COMPARE = [['idle', 0], ['walk', 0], ['search', 1], ['pay', 2], ['key-reveal', 3], ['verified', 1], ['refund', 1]]
function compare(sheetC, atlas, bg) {
  const v1 = unpng(readFileSync(resolve(root, 'docs/evidence/character/v2/v1-sprite-sheet.png')))
  const rows = ['idle', 'walk', 'search', 'thinking', 'pay', 'key-reveal', 'verified', 'refund'], k = 3, pad = 24, label = 56
  const W = label + COMPARE.length * (CELL.w * k + 8) + pad, H = pad * 2 + CELL.h * k * 2 + 16
  const c = canvas(W, H, bg), ink = bg === DARK ? KEY.P : KEY.K
  text(c, 'v1', pad, pad + CELL.h * k - 16, 28, { solid: ink }); text(c, 'v2', pad, pad + CELL.h * k * 2, 28, { solid: ink })
  COMPARE.forEach(([name, i], n) => {
    const x = label + n * (CELL.w * k + 8)
    const old = canvas(48, 32); draw(old, { w: v1.w, h: v1.h, px: v1.px }, -i * 48, -rows.indexOf(name) * 32)
    blit(c, old, k, x, pad + (CELL.h - 32) * k)
    const cell = canvas(CELL.w, CELL.h), f = atlas.animations[name].frameNames[i], r = atlas.frames[f]
    draw(cell, sheetC, -r.x, -r.y); blit(c, cell, k, x, pad + CELL.h * k + 16)
  })
  return c
}
// LinkedIn square: idle (blink, wave) then a walk on a scrolling ledger, 15×.
function squareFrames() {
  const k = 15, S = 72, g = 55, x = 19, f = []
  const add = (cs, a, phase = 0) => { const c = canvas(S, S); for (let i = 6; i < 66; i++) if ((i + phase) % 6 < 4) c.px[(g + 2) * S + i] = KEY.L; agent(c, x, g, a); f.push({ c: scaled(c, k), cs }) }
  add(70, {}); add(12, { eyes: 'blink' }); add(40, { mouth: 'smile' })
  for (const arm of ['wave', 'wave2', 'wave', 'wave2']) add(18, { arm, eyes: 'happy', mouth: 'smile' })
  add(30, { antenna: 'lag' }); add(10, { eyes: 'blink' }); add(30, {})
  for (let i = 0; i < 16; i++) add(11, WALK[i % 4], i * 3)
  return f
}
// LinkedIn banner, 1200×627 on Paper: lockup, line, and the story strip at 4×.
function bannerFrames() {
  const k = 5, s = strip(240, 46, 84), base = canvas(1200, 627, PAPER)
  lockup(base, 64, 48, 1)
  text(base, 'Research with a wallet.', 64, 172, 56)
  text(base, 'It finds the page, pays the writer into escrow, and keeps the proof.', 66, 222, 26)
  text(base, 'Illustration · payments run on XRPL Testnet, no real value', 66, 262, 18)
  return s.map(({ c, cs }) => { const o = canvas(1200, 627); o.px.set(base.px); blit(o, flatten(c, PAPER), k, 0, 627 - 46 * k - 8); return { c: o, cs } })
}
// LinkedIn portrait still, 1080×1350 on Paper.
function portrait(sheetC, atlas) {
  const c = canvas(1080, 1350, PAPER), cellOf = (name, i) => { const r = atlas.frames[`${name}-${i}`], o = canvas(CELL.w, CELL.h); draw(o, sheetC, -r.x, -r.y); return o }
  lockup(c, 72, 56, 1.25)
  text(c, 'Research with a wallet.', 72, 214, 64)
  text(c, 'An agent that finds the evidence, pays the writer', 74, 268, 28)
  text(c, 'into escrow, and walks off with a verified page.', 74, 306, 28)
  const big = canvas(CELL.w, CELL.h + 4); draw(big, cellOf('verified', 1), 0, 0)
  for (let x = 0; x < CELL.w; x++) if (x % 6 < 4) big.px[(CELL.h + 1) * CELL.w + x] = KEY.L
  blit(c, big, 12, 156, 360)
  const states = [['search', 1, 'Search'], ['thinking', 2, 'Decide'], ['pay', 2, 'Pay into escrow'], ['key-reveal', 3, 'Key turns']]
  states.forEach(([name, i, label], n) => {
    const x = 72 + n * 240
    blit(c, cellOf(name, i), 3, x, 1012); text(c, label, x + 6, 1190, 24)
  })
  text(c, 'Illustration · payments run on XRPL Testnet, no real value', 74, 1286, 20)
  return c
}

// ── Outputs ──────────────────────────────────────────────────────────────────
export function build() {
  const out = new Map()
  const { c: sheetC, atlas } = sheet()
  const hero = heroFrames(), loop = loopFrames(), search = stateFrames('search'), thinking = stateFrames('thinking')
  const C = 'design/character/', SO = C + 'social/', E = 'docs/evidence/character/', V = E + 'v2/'
  out.set(C + 'sprite-sheet.png', png(sheetC))
  out.set(C + 'sprite-sheet@4x.png', png(scaled(sheetC, 4)))
  out.set(C + 'sprite-atlas.json', JSON.stringify(atlas, null, 1) + '\n')
  out.set(C + 'hero.gif', gif(hero, HERO.scale))
  out.set(C + 'loop.gif', gif(loop, LOOP.scale))
  out.set(C + 'state-search.gif', gif(search, 2))
  out.set(C + 'state-thinking.gif', gif(thinking, 2))
  // Reduced-motion stills: the standing agent, and the hero's opening frame.
  out.set(C + 'idle.png', png(scaled(stateFrames('idle')[0].c, 4)))
  out.set(C + 'hero-still.png', png(scaled(hero[0].c, HERO.scale)))
  // Explainers landing header: the loop, and its first frame for reduced motion.
  out.set('site/brand/agent-loop.gif', out.get(C + 'loop.gif'))
  out.set('site/brand/agent-still.png', png(scaled(loop[0].c, LOOP.scale)))
  // The app imports its own copies so Vite fingerprints them.
  out.set('src/assets/character/sprite-sheet.png', out.get(C + 'sprite-sheet.png'))
  out.set('src/assets/character/sprite-atlas.json', out.get(C + 'sprite-atlas.json'))
  // LinkedIn.
  const square = squareFrames(), banner = bannerFrames()
  out.set(SO + 'agent-1080.png', png(square[0].c))
  out.set(SO + 'agent-1080.gif', gif(square))
  out.set(SO + 'banner-1200x627.gif', gif(banner, 1, PAPER))
  out.set(SO + 'portrait-1080x1350.png', png(portrait(sheetC, atlas)))
  // Evidence.
  out.set(E + 'hero-on-dark.gif', gif(hero, HERO.scale, DARK))
  out.set(E + 'hero-on-light.gif', gif(hero, HERO.scale, LIGHT))
  const picks = ['walk', 'search', 'pay', 'key', 'verified', 'off'].map(l => hero.findIndex(fr => fr.label === l))
  if (picks.includes(-1)) throw new Error('hero key frame missing')
  out.set(E + 'hero-frames-on-dark.png', png(scaled(contact(hero, picks, DARK), 2)))
  out.set(E + 'hero-frames-on-light.png', png(scaled(contact(hero, picks, LIGHT), 2)))
  out.set(E + 'sheet-on-dark.png', png(scaled(flatten(sheetC, DARK), 3)))
  out.set(E + 'sheet-on-light.png', png(scaled(flatten(sheetC, LIGHT), 3)))
  out.set(V + 'compare-on-dark.png', png(compare(sheetC, atlas, DARK)))
  out.set(V + 'compare-on-light.png', png(compare(sheetC, atlas, LIGHT)))

  const kb = f => `${(out.get(f).length / 1024).toFixed(1)} KB`
  const dims = f => { const b = out.get(f); return b.toString('ascii', 0, 3) === 'GIF' ? `${b.readUInt16LE(6)}×${b.readUInt16LE(8)}` : `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}` }
  const seq = { [C + 'hero.gif']: hero, [C + 'loop.gif']: loop, [C + 'state-search.gif']: search, [C + 'state-thinking.gif']: thinking, [SO + 'agent-1080.gif']: square, [SO + 'banner-1200x627.gif']: banner, [E + 'hero-on-dark.gif']: hero, [E + 'hero-on-light.gif']: hero }
  const secs = f => (seq[f].reduce((s, x) => s + x.cs, 0) / 100).toFixed(2)
  const row = f => `| \`${f}\` | ${dims(f)} | ${seq[f] ? `${seq[f].length} | ${secs(f)} s` : '1 | still'} | ${kb(f)} |`
  for (const [f, cap] of [[C + 'hero.gif', 400], [SO + 'agent-1080.gif', 5120], [SO + 'banner-1200x627.gif', 5120]]) if (out.get(f).length > cap * 1024) throw new Error(`${f} is ${kb(f)}, over the ${cap} KB budget`)
  out.set(E + 'README.md', `# Character evidence

Generated by \`node design/character/build-character.mjs\`; do not edit by hand.
\`node design/character/build-character.mjs --check\` (also run by
\`tests/character.test.tsx\` in \`npm run check:fast\` and CI) fails if any committed
export drifts from the generator. GIF, JSON and Markdown are compared byte for
byte; PNGs by decoded RGBA, because PNG bytes depend on the zlib build.

## v1 → v2

Top row v1 (16 × 24 agent, merged in #385), bottom row v2 (32 × 40), same
states, both at 3×: idle, walk, search, pay, key reveal, verified, refund.
\`v2/v1-sprite-sheet.png\` is a frozen copy of the v1 sheet the comparison reads.

| GitHub dark #0d1117 | GitHub light #ffffff |
| --- | --- |
| ![v1 and v2 on dark](v2/compare-on-dark.png) | ![v1 and v2 on light](v2/compare-on-light.png) |

README at 1280 × 800 on github.com, dark, scrolled to the README's top.
Captures and measured positions: [v2/first-screen.md](v2/first-screen.md).

| v1 | v2 |
| --- | --- |
| ![README v1](v2/readme-1280x800-v1.png) | ![README v2](v2/readme-1280x800-v2.png) |

## Previews

| Preview | Background |
| --- | --- |
| ![Hero on GitHub dark](hero-on-dark.gif) | GitHub dark #0d1117 |
| ![Hero on GitHub light](hero-on-light.gif) | GitHub light #ffffff |
| ![Key frames on dark](hero-frames-on-dark.png) | key frames, dark |
| ![Key frames on light](hero-frames-on-light.png) | key frames, light |
| ![Sheet on dark](sheet-on-dark.png) | sprite sheet ×3, dark |
| ![Sheet on light](sheet-on-light.png) | sprite sheet ×3, light |

## Exports

Integer nearest-neighbour scaling, a 16-colour global table of brand tokens,
infinite loop. Transparent GIFs use index 0 and disposal 2 on every frame,
cropped to opaque bounds. The banner and the two evidence previews are opaque:
the first frame is whole and later frames carry only the changed rectangle
(disposal 1).

| File | Pixels | Frames | Loop | Size |
| --- | --- | --- | --- | --- |
${[C + 'hero.gif', C + 'loop.gif', C + 'state-search.gif', C + 'state-thinking.gif', SO + 'agent-1080.gif', SO + 'banner-1200x627.gif', E + 'hero-on-dark.gif', E + 'hero-on-light.gif'].map(row).join('\n')}
${[SO + 'agent-1080.png', SO + 'portrait-1080x1350.png', C + 'hero-still.png', C + 'idle.png'].map(row).join('\n')}

Budgets, enforced by the generator: \`hero.gif\` under 400 KB, each social GIF
under 5 MB.

## Sprite sheet

\`design/character/sprite-sheet.png\` is ${dims(C + 'sprite-sheet.png')} at 1×: ${ANIMS.length} rows of
${CELL.w}×${CELL.h} cells, one animation per row (${ANIMS.map(([n, ms, f]) => `${n} ${f.length}×${ms} ms`).join(', ')}).
\`sprite-atlas.json\` lists every frame rect and duration.
`)
  return out
}

function same(file, want) {
  const path = resolve(root, file)
  if (!existsSync(path)) return false
  const have = readFileSync(path)
  if (!file.endsWith('.png')) return Buffer.compare(have, Buffer.from(want)) === 0
  const a = decodePng(have), b = decodePng(want)
  return a.w === b.w && a.h === b.h && Buffer.compare(a.rgba, b.rgba) === 0
}
export function drift() { return [...build()].filter(([f, data]) => !same(f, data)).map(([f]) => f) }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const bad = drift()
    if (bad.length) { console.error(`Character exports drift from the generator:\n${bad.join('\n')}\nRun: node design/character/build-character.mjs`); process.exit(1) }
    console.log('Character exports match the generator.')
  } else {
    const all = build()
    for (const [f, data] of all) {
      const path = resolve(root, f); mkdirSync(dirname(path), { recursive: true })
      if (!same(f, data)) writeFileSync(path, data)
    }
    for (const f of ['design/character/hero.gif', 'design/character/social/agent-1080.gif', 'design/character/social/banner-1200x627.gif']) console.log(`${f} ${(all.get(f).length / 1024).toFixed(1)} KB`)
  }
}
