#!/usr/bin/env node
// Source of truth for the ResearchAgent pixel character ("Index").
// node design/character/build-character.mjs          write every export
// node design/character/build-character.mjs --check  exit 1 if committed exports drift
// Pure Node: frames are character grids below, PNG via node:zlib, GIF via the
// LZW encoder in this file. No network, fonts, browser or image model.
import { deflateSync, inflateSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { palette as brand } from '../cast/build-cast.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// ── Palette: brand tokens only. Index 0 is transparent. ──────────────────────
// Ledger grey is the midpoint of the brand rule (#C9BFB2) and secondary text
// (#655D55), so the dashed line reads on GitHub light and dark alike.
const COLORS = [
  [' ', null], ['K', brand.ink], ['P', brand.paper], ['g', '#655D55'], ['S', brand.salmon],
  ['D', brand.deep], ['G', brand.green], ['O', brand.ochre], ['R', brand.red], ['L', '#978E83'],
]
const KEY = Object.fromEntries(COLORS.map(([c], i) => [c, i]))
KEY['.'] = 0
const RGB = COLORS.map(([, hex]) => hex ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) : [0, 0, 0])
const OUTLINE = KEY.P

// ── Sprites ──────────────────────────────────────────────────────────────────
// A sprite is {w,h,px}. `grid` parses rows; `outlined` adds the 1-px Paper rim
// (4-neighbour) so every part reads on dark and light backgrounds.
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
    px[y * w + x] = v || (at(x - 2, y - 1) || at(x, y - 1) || at(x - 1, y - 2) || at(x - 1, y) ? OUTLINE : 0)
  }
  return { w, h, px }
}
const part = rows => outlined(grid(rows))
function canvas(w, h) { return { w, h, px: new Uint8Array(w * h) } }
function draw(c, s, x, y) {
  for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
    const v = s.px[j * s.w + i], X = x + i, Y = y + j
    if (v && X >= 0 && Y >= 0 && X < c.w && Y < c.h) c.px[Y * c.w + X] = v
  }
  return c
}

// Head: the open-index mark. Two Ink source boundaries frame a Paper visor and
// the ascending route, here in Salmon. On a light page it reads as the logo.
const HEAD = part([
  'KKKKPPPPKKKK',
  'KKKKPPPPKKKK',
  'KKPPPPPPPPKK',
  'KKPPPPPPSSKK',
  'KKPPPPPSSPKK',
  'KKPPPPSSPPKK',
  'KKPPPSSPPPKK',
  'KKPPPPPPPPKK',
  'KKKKPPPPKKKK',
  'KKKKPPPPKKKK',
])
// Blink/scan: the route dims while the agent reads or decides.
const HEAD_SCAN = part([
  'KKKKPPPPKKKK',
  'KKKKPPPPKKKK',
  'KKPPPPPPPPKK',
  'KKPPPPPPPPKK',
  'KKPPPPPPPPKK',
  'KKPSSSSSSPKK',
  'KKPPPPPPPPKK',
  'KKPPPPPPPPKK',
  'KKKKPPPPKKKK',
  'KKKKPPPPKKKK',
])
// Torso: Ink coat, a Slate belt and the wallet pouch at the back hip.
const TORSO = part([
  'KKKKKKKKKK',
  'KKKKKKKKKK',
  'KKKKKKKKKK',
  'gggggggggg',
  'gPgKKKKKKK',
  'gggKKKKKKK',
  'KKKKKKKKKK',
])
// Legs: front leg Ink, back leg Slate, so the walk cycle reads at 1×.
const LEGS = {
  stand: part(['...gg.KK....', '...gg.KK....', '...gg.KK....', '...gggKKK...']),
  strideA: part(['....gg.KK...', '...gg...KK..', '..gg.....KK.', '..ggg....KKK']),
  pass: part(['....gKK.....', '....gKK.....', '....gKK.....', '....gKK.....', '....gKKK....']),
  strideB: part(['....KK.gg...', '...KK...gg..', '..KK.....gg.', '..KKK....ggg']),
}
// Arms: the rim is drawn behind the torso and the fill on top, so a sleeve
// crossing the coat stays clean and only its outside edge gets the Paper rim.
const arm = (rows, x, y) => ({ s: part(rows), fill: grid(rows), x, y })
const ARMS = {
  down: arm(['KK', 'KK', 'KK', 'gg'], 7, 1),
  forward: arm(['KKKKgg', 'KKKKgg'], 7, 2),
  raised: arm(['....gg', '...Kgg', '..KK..', '.KK...', 'KK....'], 7, -2),
  chin: arm(['.gg', 'KKg', 'KK.', 'KK.'], 7, -2),
  carry: arm(['KKKgg', 'KKKgg'], 7, 3),
}
const PROP = {
  magnifier: part(['...KKK.', '..KPPPK', '..KPPPK', '..KPPPK', '..gKKK.', '.gg....', 'gg.....']),
  magnifierGlint: part(['...KKK.', '..KPPSK', '..KPPPK', '..KPPPK', '..gKKK.', '.gg....', 'gg.....']),
  pageHidden: part([
    'KKKKKK...', 'KPPPPKK..', 'KPPPPKPK.', 'KPPPPKKKK', 'KPPPPPPPK', 'KPLLLLLPK',
    'KPPPPPPPK', 'KPLLLLPPK', 'KPPPPPPPK', 'KPLLLLLPK', 'KPPPPPPPK', 'KKKKKKKKK']),
  pageOpen: part([
    'KKKKKK...', 'KPPPPKK..', 'KPPPPKPK.', 'KPPPPKKKK', 'KPPPPPPPK', 'KPKKKKKPK',
    'KPPPPPPPK', 'KPKKKKPPK', 'KPPPPPPPK', 'KPKKKKKPK', 'KPPPPPPPK', 'KKKKKKKKK']),
  // Escrow lock: Paper coin slot, keyhole below. Funded shows the coin in Salmon.
  lock: part(['.KKKKK.', '.K...K.', 'KKKKKKK', 'KKPPPKK', 'KKKKKKK', 'KKKPKKK', 'KKKPKKK', 'KKKKKKK']),
  lockFunded: part(['.KKKKK.', '.K...K.', 'KKKKKKK', 'KKSSSKK', 'KKKKKKK', 'KKKPKKK', 'KKKPKKK', 'KKKKKKK']),
  lockOpen: part(['.KKKKK.', '.K...K.', '.K.....', '.K.....', 'KKKKKKK', 'KKSSSKK', 'KKKKKKK', 'KKKOKKK', 'KKKOKKK', 'KKKKKKK']),
  lockBroken: part(['.KKKKK.', '.K...K.', 'KKKKKKK', 'KKPPPKK', 'KKKKKKK', 'KKRKRKK', 'KKKRKKK', 'KKRKRKK', 'KKKKKKK']),
  coin: part(['.SSS.', 'SSDSS', 'SSDSS', 'SSDSS', '.SSS.']),
  coinEdge: part(['SS', 'SD', 'SD', 'SD', 'SS']),
  key: part(['.OO.', 'O..O', '.OO.', '.O..', '.OO.', '.O..', '.OO.']),
  keyTurn: part(['.O.', 'O.O', '.O.', '.O.', '.O.', '.O.', '.O.']),
  check: part(['..GGGGG..', '.GGGGGGG.', 'GGGGGGGPG', 'GGGGGGPPG', 'GPGGGPPGG', 'GPPGPPGGG', 'GGPPPGGGG', '.GGPGGGG.', '..GGGGG..']),
  cross: part(['RR...RR', '.RR.RR.', '..RRR..', '.RR.RR.', 'RR...RR']),
  dot: part(['KK', 'KK']),
}

// Agent body sprite. Origin (0,0) is the top-left of the outlined head; feet sit
// on `ground` (outline row included). Width 16, height 24 when standing.
const AGENT_W = 16
function agent(c, x, ground, { legs = 'stand', arm = 'down', head = HEAD, hold, holdAt = [0, 0] } = {}) {
  const L = LEGS[legs], top = ground - L.h + 1
  const torsoY = top - TORSO.h + 2, headY = torsoY - HEAD.h + 1, A = ARMS[arm], ax = x + 2 + A.x, ay = torsoY + A.y
  draw(c, A.s, ax, ay)
  draw(c, L, x + 1, top)
  draw(c, TORSO, x + 2, torsoY)
  draw(c, head, x + 1, headY)
  if (hold) draw(c, hold, ax + holdAt[0], ay + holdAt[1])
  draw(c, A.fill, ax + 1, ay + 1)
  return { headY, torsoY, ax, ay }
}

// ── Scenes: one description per story beat, positioned relative to the agent.
// Props stand PROPS px to the agent's right: the escrow lock in front of the
// page's lower-left corner. Shared by the sheet, the hero strip and the loop.
const PROPS = 25
const LOCKS = { lock: PROP.lock, funded: PROP.lockFunded, open: PROP.lockOpen, broken: PROP.lockBroken }
function scene(c, x, g, s = {}) {
  const px = x + PROPS
  if (s.page) { const p = s.page === 'open' ? PROP.pageOpen : PROP.pageHidden; draw(c, p, px + 6, g - p.h + 1) }
  const L = s.lock && LOCKS[s.lock], lockTop = L ? g - L.h + 1 : g - PROP.lock.h + 1
  if (L) draw(c, L, px, lockTop)
  const magnifier = s.magnifier !== undefined && { arm: 'raised', hold: s.magnifier ? PROP.magnifierGlint : PROP.magnifier, holdAt: [3 + s.magnifier, -6 + s.magnifier] }
  const coinInHand = s.coin === 'hand' && { arm: 'forward', hold: PROP.coin, holdAt: [4, -5] }
  const carry = s.carry && { arm: 'carry', hold: PROP.pageOpen, holdAt: [3, -8] }
  const r = agent(c, x, g, { ...magnifier, ...coinInHand, ...carry, ...s.agent })
  const slot = [px + 1, lockTop - 3], hand = [r.ax + 4, r.ay - 5]
  if (s.coin === 'arc') draw(c, PROP.coinEdge, ((slot[0] + hand[0]) >> 1) + 2, Math.min(slot[1], hand[1]) - 5)
  if (s.coin === 'slot') draw(c, PROP.coin, ...slot)
  if (s.coin === 'return') draw(c, PROP.coin, slot[0], slot[1] - 6)
  if (s.key === 'drop') draw(c, PROP.key, px + 2, lockTop - 13)
  if (s.key === 'in') draw(c, PROP.key, px + 2, lockTop - 1)
  if (s.key === 'turn') draw(c, PROP.keyTurn, px + 2, lockTop - 1)
  if (s.cross) draw(c, PROP.cross, px + 8, lockTop - 14)
  if (s.check) draw(c, PROP.check, r.ax + 8, r.ay - 14)
  for (let i = 0; i < (s.dots ?? 0); i++) draw(c, PROP.dot, x + 14 + i * 4, r.headY - 1 - i)
  return r
}
const pageLock = { page: 'hidden', lock: 'lock' }
const BEATS = {
  idle: [{}, { agent: { head: HEAD_SCAN } }],
  walk: ['strideA', 'pass', 'strideB', 'pass'].map(legs => ({ agent: { legs } })),
  search: [0, 1, 0, 1].map(m => ({ ...pageLock, magnifier: m, agent: m ? { head: HEAD_SCAN } : {} })),
  thinking: [0, 1, 2, 3].map(n => ({ ...pageLock, dots: n, agent: { arm: 'chin', head: n % 2 ? HEAD_SCAN : HEAD } })),
  pay: [{ ...pageLock, coin: 'hand' }, { ...pageLock, coin: 'arc', agent: { arm: 'forward' } }, { ...pageLock, coin: 'slot', agent: { arm: 'forward' } }, { page: 'hidden', lock: 'funded' }],
  'key-reveal': [{ page: 'hidden', lock: 'funded', key: 'drop' }, { page: 'hidden', lock: 'funded', key: 'in' }, { page: 'hidden', lock: 'funded', key: 'turn', agent: { head: HEAD_SCAN } }, { page: 'open', lock: 'open' }],
  verified: [{ carry: true }, { carry: true, check: true }, { carry: true, check: true, agent: { head: HEAD_SCAN } }, { carry: true, check: true }],
  refund: [{ page: 'hidden', lock: 'broken', cross: true }, { page: 'hidden', lock: 'broken', coin: 'return' }, { ...pageLock, coin: 'arc', agent: { arm: 'forward' } }, { ...pageLock, coin: 'hand' }],
}

// ── Sprite sheet: one row per animation so CSS steps() can run each strip. ──
const CELL = { w: 48, h: 32 }, G = 31, AX = 3
const ANIMS = Object.entries({ idle: 400, walk: 110, search: 180, thinking: 260, pay: 160, 'key-reveal': 220, verified: 300, refund: 200 })
  .map(([name, ms]) => [name, ms, BEATS[name].map(beat => c => scene(c, AX, G, beat))])

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
  [40, {}], ...[0, 1, 0, 1].map(m => [16, BEATS.search[m]]), ...[1, 2, 3].map(n => [22, BEATS.thinking[n]]),
  [18, BEATS.pay[0]], [8, BEATS.pay[1]], [8, BEATS.pay[2]], [40, BEATS.pay[3]],
  [36, BEATS['key-reveal'][0]], [14, BEATS['key-reveal'][1]], [22, BEATS['key-reveal'][2]], [50, BEATS['key-reveal'][3]],
  [24, BEATS.verified[0]], [90, BEATS.verified[1], 'anchor'],
]

// ── Hero strip: walk the ledger in, the story, walk off with the page. ──────
const HERO = { w: 224, h: 40, ground: 35, line: 37, scale: 3 }
const STOP = 92
function ledger(c, line, anchorX) {
  for (let x = 0; x < c.w; x++) if (x % 6 < 4) c.px[line * c.w + x] = KEY.L
  // Anchored: the proof's segment of the ledger turns Salmon and stays.
  if (anchorX !== undefined) for (let x = anchorX; x < anchorX + 10; x++) for (const y of [line, line + 1]) c.px[y * c.w + x] = KEY.S
}
function heroFrames() {
  const f = [], g = HERO.ground, anchorX = STOP + PROPS + 1
  const add = (cs, paint, label) => { const c = canvas(HERO.w, HERO.h); paint(c); f.push({ c, cs, label }) }
  const walk = ['strideA', 'pass', 'strideB', 'pass']
  let step = 0
  for (let x = -AGENT_W; x < STOP; x += 4) { const legs = walk[step++ % 4]; add(9, c => { ledger(c, HERO.line); scene(c, x, g, { ...pageLock, agent: { legs } }) }, step === 12 ? 'walk' : undefined) }
  for (const [cs, beat, anchor] of STORY) add(cs, c => { ledger(c, HERO.line, anchor && anchorX); scene(c, STOP, g, beat) }, beat === BEATS.search[1] ? 'search' : beat === BEATS.pay[1] ? 'pay' : beat === BEATS['key-reveal'][2] ? 'key' : anchor ? 'verified' : undefined)
  step = 0
  for (let x = STOP + 4; x < HERO.w; x += 4) { const legs = walk[step++ % 4]; add(9, c => { ledger(c, HERO.line, anchorX); scene(c, x, g, { carry: true, agent: { legs } }) }, step === 6 ? 'off' : undefined) }
  add(80, c => ledger(c, HERO.line, anchorX))
  return f
}

// Compact site loop: the same story in place, 64 × 36.
function loopFrames() {
  const W = 64, H = 36, g = 33, x = 2
  return STORY.map(([cs, beat, anchor]) => { const c = canvas(W, H); ledger(c, g + 2, anchor && x + PROPS + 1); scene(c, x, g, beat); return { c, cs } })
}
// App state loops: one sheet row, 48 × 32 cells.
function stateFrames(name) {
  const [, ms, frames] = ANIMS.find(([n]) => n === name)
  return frames.map(fn => { const c = canvas(CELL.w, CELL.h); fn(c); return { c, cs: Math.round(ms / 10) } })
}

// ── Encoders ─────────────────────────────────────────────────────────────────
function scaled(c, k) {
  const o = canvas(c.w * k, c.h * k)
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) o.px[y * o.w + x] = c.px[((y / k) | 0) * c.w + ((x / k) | 0)]
  return o
}
function flatten(c, bg) { const o = canvas(c.w, c.h); for (let i = 0; i < c.px.length; i++) o.px[i] = c.px[i] || bg; return o }
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length), td = Buffer.concat([Buffer.from(type), data])
  out.writeUInt32BE(data.length, 0); td.copy(out, 4); out.writeUInt32BE(crc32(td), 8 + data.length); return out
}
// Extra RGB entries (index >= COLORS.length) for evidence backgrounds.
const BG = { dark: [0x0d, 0x11, 0x17], light: [0xff, 0xff, 0xff] }
const rgbOf = i => i < RGB.length ? RGB[i] : Object.values(BG)[i - RGB.length]
function png(c) {
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h)
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const v = c.px[y * c.w + x], o = y * (c.w * 4 + 1) + 1 + x * 4, [r, g, b] = rgbOf(v)
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
function lzw(indices, min) {
  const bytes = []; let cur = 0, bits = 0
  const emit = (code, size) => { cur |= code << bits; bits += size; while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8 } }
  const clear = 1 << min, eoi = clear + 1
  let size = min + 1, next = eoi + 1, table = new Map(), prefix = indices[0]
  emit(clear, size)
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = (prefix << 8) | k, hit = table.get(key)
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
// Transparent index 0, disposal 2 (restore to background) on every frame so
// nothing smears; each frame is cropped to its opaque bounds.
function gif(frames, k, bg) {
  const W = frames[0].c.w * k, H = frames[0].c.h * k
  const table = Buffer.alloc(16 * 3)
  for (let i = 0; i < 16; i++) { const [r, g, b] = i < RGB.length + 2 ? rgbOf(i) : [0, 0, 0]; table[i * 3] = r; table[i * 3 + 1] = g; table[i * 3 + 2] = b }
  const parts = [Buffer.from('GIF89a'), Buffer.from([W & 255, W >> 8, H & 255, H >> 8, 0xf3, 0, 0]), table,
    Buffer.from([0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0])]
  for (const { c: small, cs } of frames) {
    const c = scaled(bg === undefined ? small : flatten(small, bg), k)
    let x0 = c.w, y0 = c.h, x1 = -1, y1 = -1
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.px[y * c.w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
    if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0 }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, idx = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) idx[y * w + x] = c.px[(y + y0) * c.w + x + x0]
    parts.push(Buffer.from([0x21, 0xf9, 4, (2 << 2) | 1, cs & 255, cs >> 8, 0, 0]),
      Buffer.from([0x2c, x0 & 255, x0 >> 8, y0 & 255, y0 >> 8, w & 255, w >> 8, h & 255, h >> 8, 0]), lzw(idx, 4))
  }
  parts.push(Buffer.from([0x3b]))
  return Buffer.concat(parts)
}

// ── Outputs ──────────────────────────────────────────────────────────────────
const DARK = RGB.length, LIGHT = RGB.length + 1
function contact(frames, picks, bg, gap = 4) {
  const w = frames[0].c.w, h = frames[0].c.h, c = canvas(w, picks.length * (h + gap) - gap)
  c.px.fill(bg); picks.forEach((p, i) => draw(c, frames[p].c, 0, i * (h + gap)))
  return c
}
export function build() {
  const out = new Map()
  const { c: sheetC, atlas } = sheet()
  const hero = heroFrames(), loop = loopFrames(), search = stateFrames('search'), thinking = stateFrames('thinking')
  const C = 'design/character/'
  out.set(C + 'sprite-sheet.png', png(sheetC))
  out.set(C + 'sprite-sheet@4x.png', png(scaled(sheetC, 4)))
  out.set(C + 'sprite-atlas.json', JSON.stringify(atlas, null, 1) + '\n')
  out.set(C + 'hero.gif', gif(hero, HERO.scale))
  out.set(C + 'loop.gif', gif(loop, 3))
  out.set(C + 'state-search.gif', gif(search, 2))
  out.set(C + 'state-thinking.gif', gif(thinking, 2))
  out.set(C + 'idle.png', png(scaled(stateFrames('idle')[0].c, 4)))
  // Explainers landing header: the loop, and its first frame for reduced motion.
  out.set('site/brand/agent-loop.gif', out.get(C + 'loop.gif'))
  out.set('site/brand/agent-still.png', png(scaled(loop[0].c, 3)))
  // The app imports its own copies so Vite fingerprints them.
  out.set('src/assets/character/sprite-sheet.png', out.get(C + 'sprite-sheet.png'))
  out.set('src/assets/character/sprite-atlas.json', out.get(C + 'sprite-atlas.json'))
  const E = 'docs/evidence/character/'
  out.set(E + 'hero-on-dark.gif', gif(hero, HERO.scale, DARK))
  out.set(E + 'hero-on-light.gif', gif(hero, HERO.scale, LIGHT))
  const picks = ['walk', 'search', 'pay', 'key', 'verified', 'off'].map(l => hero.findIndex(fr => fr.label === l))
  out.set(E + 'hero-frames-on-dark.png', png(scaled(contact(hero, picks, DARK), 2)))
  out.set(E + 'hero-frames-on-light.png', png(scaled(contact(hero, picks, LIGHT), 2)))
  out.set(E + 'sheet-on-dark.png', png(scaled(flatten(sheetC, DARK), 4)))
  out.set(E + 'sheet-on-light.png', png(scaled(flatten(sheetC, LIGHT), 4)))
  const size = f => `${(out.get(f).length / 1024).toFixed(1)} KB`
  const dims = f => { const b = out.get(f); return b.toString('ascii', 0, 3) === 'GIF' ? `${b.readUInt16LE(6)}×${b.readUInt16LE(8)}` : `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}` }
  const gifs = [C + 'hero.gif', C + 'loop.gif', C + 'state-search.gif', C + 'state-thinking.gif', E + 'hero-on-dark.gif', E + 'hero-on-light.gif']
  const frameCount = { [C + 'hero.gif']: hero.length, [C + 'loop.gif']: loop.length, [C + 'state-search.gif']: search.length, [C + 'state-thinking.gif']: thinking.length, [E + 'hero-on-dark.gif']: hero.length, [E + 'hero-on-light.gif']: hero.length }
  const total = list => (list.reduce((s, x) => s + x.cs, 0) / 100).toFixed(2)
  out.set(E + 'README.md', `# Character evidence

Generated by \`node design/character/build-character.mjs\`; do not edit by hand.
\`node design/character/build-character.mjs --check\` (also run by
\`tests/character.test.ts\` in \`npm run check:fast\` and CI) fails if any committed
export drifts from the generator. GIF, JSON and Markdown are compared byte for
byte; PNGs by decoded RGBA, because PNG bytes depend on the zlib build.

| Preview | Background |
| --- | --- |
| ![Hero on GitHub dark](hero-on-dark.gif) | GitHub dark #0d1117 |
| ![Hero on GitHub light](hero-on-light.gif) | GitHub light #ffffff |
| ![Key frames on dark](hero-frames-on-dark.png) | key frames, dark |
| ![Key frames on light](hero-frames-on-light.png) | key frames, light |
| ![Sheet on dark](sheet-on-dark.png) | sprite sheet ×4, dark |
| ![Sheet on light](sheet-on-light.png) | sprite sheet ×4, light |

## GIF exports

All transparent except the two evidence previews. Integer nearest-neighbour
scaling, a 16-colour global table of brand tokens, index 0 transparent,
disposal 2 on every frame, infinite loop.

| File | Pixels | Frames | Loop | Size |
| --- | --- | --- | --- | --- |
${gifs.map(f => `| \`${f}\` | ${dims(f)} | ${frameCount[f]} | ${total(f.includes('hero') ? hero : f.includes('loop') ? loop : f.includes('search') ? search : thinking)} s | ${size(f)} |`).join('\n')}

Budget: \`hero.gif\` under 400 KB.

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
    for (const [f, data] of build()) {
      const path = resolve(root, f); mkdirSync(dirname(path), { recursive: true })
      if (!same(f, data)) writeFileSync(path, data)
    }
    const hero = readFileSync(resolve(root, 'design/character/hero.gif')).length
    console.log(`Wrote character exports. hero.gif ${(hero / 1024).toFixed(1)} KB`)
    if (hero > 400 * 1024) { console.error('hero.gif is over the 400 KB budget'); process.exit(1) }
  }
}
