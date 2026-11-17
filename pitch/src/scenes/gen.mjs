// "Saturday evening" scenes: the painted layer of each slide, golden hour into night.
//   node pitch/src/scenes/gen.mjs   → pitch/src/scenes/s0.svg … s8.svg, sN-cu.svg / sN-st.svg (drifting clouds), grain.svg
// Each sN.svg is one 1920 × 1080 picture (sun, land, rooftops, stars) drawn over the slide's sky gradient
// (the --zN/--mN/--hN tokens in base.css) and under its cards. The build inlines it as a CSS background image, so it is
// rasterised once and its filter ids never meet another slide's. Deterministic: the same seeds give the same files.
// Colours here must agree with the sky tokens in base.css; edit both together. No bitmaps.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const W = 1920, H = 1080
const OUT = dirname(fileURLToPath(import.meta.url))
const f0 = n => String(Math.round(n))
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const uni = (r, a, b) => a + (b - a) * r()
const pick = (r, xs) => xs[Math.floor(r() * xs.length)]
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>${defs}</defs>${body}</svg>\n`

// ---------- shared filters ----------
// cf: rough, soft streak edges · ch: wide glow · cr: lit rim · cu: cumulus edges (softer, rounder) · lf: hand-cut land edges
const FILTERS = seed => `<filter id="cf" x="-10%" y="-80%" width="120%" height="260%"><feTurbulence type="fractalNoise" baseFrequency=".007 .03" numOctaves="3" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="26" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="3.2"/></filter>`
  + '<filter id="ch" x="-30%" y="-150%" width="160%" height="400%"><feGaussianBlur stdDeviation="26"/></filter>'
  + `<filter id="cr" x="-10%" y="-200%" width="120%" height="500%"><feTurbulence type="fractalNoise" baseFrequency=".01 .08" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="14" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="2.2"/></filter>`
  + `<filter id="cu" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency=".008" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="11" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="2.4"/></filter>`
  + '<filter id="cb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>'
  + '<filter id="lf" x="-2%" y="-20%" width="104%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".02 .06" numOctaves="2" seed="9"/><feDisplacementMap in="SourceGraphic" scale="7" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".7"/></filter>'

// ---------- clouds ----------
// streak: a low stratus band, cool on top, a flat underside lit warm with a bright rim. cy is the underside.
function streak(id, { cx, cy, w, h, top, under, rim, op = 1, seed = 1, lumps = 7 }) {
  const r = rng(seed)
  const set = (x, ww, hh, n) => {
    let s = ''
    for (let k = 0; k < n; k++) {
      const t = (k + .5) / n, ex = x - ww / 2 + t * ww + uni(r, -ww * .03, ww * .03)
      const eh = hh * (.3 + .7 * Math.sin(Math.PI * t) ** .8) * uni(r, .7, 1.1), ew = ww / n * uni(r, .8, 1.35)
      s += `<ellipse cx="${f0(ex)}" cy="${f0(cy - eh * .5)}" rx="${f0(ew)}" ry="${f0(eh * .5)}"/>`
    }
    return s + `<ellipse cx="${f0(x)}" cy="${f0(cy - hh * .1)}" rx="${f0(ww * .5)}" ry="${f0(hh * .12)}"/>`
  }
  const defs = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f0(cy - h)}" x2="0" y2="${f0(cy)}"><stop offset=".5" stop-color="${top}"/><stop offset="1" stop-color="${under}"/></linearGradient>`
  const body = `<g opacity="${op}"><ellipse cx="${cx}" cy="${f0(cy - h * .3)}" rx="${f0(w * .55)}" ry="${f0(h * .9)}" fill="${under}" opacity=".28" filter="url(#ch)"/>`
    + `<g fill="url(#${id})" filter="url(#cf)">${set(cx, w, h, lumps)}</g>`
    + `<g fill="${top}" opacity=".45" filter="url(#cf)">${set(cx + w * .04, w * .7, h * .7, Math.max(3, lumps - 2))}</g>`
    + `<ellipse cx="${f0(cx + w * .02)}" cy="${f0(cy - h * .06)}" rx="${f0(w * .44)}" ry="${f0(Math.max(3, h * .07))}" fill="${rim}" opacity=".9" filter="url(#cr)"/></g>`
  return [defs, body]
}

// cumulus: a fuller, rounder heap. Cool lavender on top, lit warm from below (the sun is under the horizon or low),
// each lobe with its own warm lower edge, a flat base with a bright rim, and a wide glow behind. base is the flat underside.
function cumulus(id, { cx, base, w, h, top, under, lit, rim, op = 1, seed = 1 }) {
  const r = rng(seed)
  const lobes = []
  // the base row: wide, low lobes; then rows up the dome, narrower and fewer, biggest near the middle
  const rows = 5
  for (let j = 0; j < rows; j++) {
    const t = j / (rows - 1)                       // 0 bottom … 1 top
    const span = w * (1 - .62 * t) * uni(r, .9, 1.02)
    const n = Math.max(1, Math.round((6 - 4.4 * t) * uni(r, .9, 1.15)))
    const rad = (h * (.24 - .04 * t)) * uni(r, .85, 1.15)
    for (let k = 0; k < n; k++) {
      const u = n === 1 ? .5 : k / (n - 1)
      const x = cx - span / 2 + u * span + uni(r, -rad * .25, rad * .25) + w * .06 * t * (r() - .3)
      const rr = rad * (n === 1 ? 1.1 : (.75 + .45 * Math.sin(Math.PI * (u * .9 + .05)))) * uni(r, .85, 1.1)
      const y = base - rr * .55 - t * (h - rad * 1.5) + uni(r, -rad * .12, rad * .12)
      lobes.push([x, Math.min(y, base - rr * .45), rr])
    }
  }
  // lobes, plus a flat slab along the base and a core, so no gaps open between the puffs
  const xs = lobes.filter(([, y]) => y > base - h * .4).map(([x]) => x), x0 = Math.min(...xs), x1 = Math.max(...xs)
  const circles = lobes.map(([x, y, rr]) => `<circle cx="${f0(x)}" cy="${f0(y)}" r="${f0(rr)}"/>`).join('')
    + `<rect x="${f0(x0)}" y="${f0(base - h * .3)}" width="${f0(x1 - x0)}" height="${f0(h * .3)}"/><ellipse cx="${f0(cx)}" cy="${f0(base - h * .42)}" rx="${f0(w * .36)}" ry="${f0(h * .36)}"/>`
  const top0 = Math.min(...lobes.map(([, y, rr]) => y - rr))
  const defs = `<clipPath id="${id}c"><rect x="${f0(cx - w)}" y="0" width="${f0(2 * w)}" height="${f0(base)}"/></clipPath>`
    + `<clipPath id="${id}k">${circles}</clipPath>`
    + `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f0(top0)}" x2="0" y2="${f0(base)}"><stop offset="0" stop-color="${top}"/><stop offset=".55" stop-color="${top}"/><stop offset="1" stop-color="${under}"/></linearGradient>`
  // each lobe lit from below: a warm crescent under its centre (clipped to the heap), so the lobes read as separate puffs
  const glows = lobes.filter(([, y]) => y > base - h * .62).map(([x, y, rr]) => `<ellipse cx="${f0(x)}" cy="${f0(y + rr * .7)}" rx="${f0(rr * 1.05)}" ry="${f0(rr * .5)}"/>`).join('')
  const body = `<g opacity="${op}">`
    + `<ellipse cx="${f0(cx)}" cy="${f0(base - h * .35)}" rx="${f0(w * .62)}" ry="${f0(h * .62)}" fill="${under}" opacity=".26" filter="url(#ch)"/>`
    + `<g filter="url(#cu)"><g clip-path="url(#${id}c)"><g clip-path="url(#${id}k)">`
    + `<rect x="${f0(cx - w)}" y="${f0(top0)}" width="${f0(2 * w)}" height="${f0(base - top0)}" fill="url(#${id})"/>`
    + `<g fill="${lit}" opacity=".55" filter="url(#cb)">${glows}</g>`
    + `<rect x="${f0(cx - w)}" y="${f0(base - h * .16)}" width="${f0(2 * w)}" height="${f0(h * .16)}" fill="${under}" opacity=".7" filter="url(#cb)"/>`
    + '</g></g></g>'
    + `<ellipse cx="${f0(cx)}" cy="${f0(base - 4)}" rx="${f0(w * .3)}" ry="${f0(Math.max(4, h * .025))}" fill="${rim}" opacity=".8" filter="url(#cr)"/></g>`
  return [defs, body]
}

// Clouds drift (base.css .sky): each slide's cumulus heaps and streaks become two separate 1920-wide tiles, sN-cu.svg
// and sN-st.svg, that repeat seamlessly in x. Every cloud is drawn three times (x − 1920, x, x + 1920) and the tile
// crops to its frame, so a cloud leaving one edge is the same cloud entering the other. Print shows the tile as drawn.
const clouds = (specs, seed = 3) => specs.reduce((o, [kind, s], i) => {
  const [dd, bb] = (kind === 'cu' ? cumulus : streak)(`k${i}`, s)
  const k = kind === 'cu' ? 'cu' : 'st'
  o[k] = [(o[k]?.[0] ?? '') + dd, (o[k]?.[1] ?? '') + bb]
  return o
}, { seed })
const cloudTile = (seed, [d, b]) => svg(FILTERS(seed) + d + `<g id="c">${b}</g>`, `<use href="#c" x="${-W}"/><use href="#c"/><use href="#c" x="${W}"/>`)

// ---------- land ----------
function hill(y, waves, color, { seed = 1, crest } = {}) {
  const r = rng(seed), n = 24, phase = waves.map(() => uni(r, 0, 6.28))
  const pts = []
  for (let k = 0; k <= n; k++) {
    const x = W * k / n
    pts.push([x, y + waves.reduce((s, [a, f], i) => s + a * Math.sin(x / W * f * 6.283 + phase[i]), 0)])
  }
  let d = `M-20 ${H + 20}L-20 ${f0(pts[0][1])}`
  for (let k = 0; k < n; k++) d += `Q${f0(pts[k][0])} ${f0(pts[k][1])} ${f0((pts[k][0] + pts[k + 1][0]) / 2)} ${f0((pts[k][1] + pts[k + 1][1]) / 2)}`
  d += `L${W + 20} ${f0(pts[n][1])}L${W + 20} ${H + 20}Z`
  if (!crest) return ['', `<path d="${d}" fill="${color}" filter="url(#lf)"/>`]
  const top = Math.min(...pts.map(p => p[1])), id = `h${seed}`
  return [`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f0(top - 4)}" x2="0" y2="${f0(top + 70)}"><stop offset="0" stop-color="${crest}"/><stop offset="1" stop-color="${color}"/></linearGradient>`,
    `<path d="${d}" fill="url(#${id})" filter="url(#lf)"/>`]
}

// abstract rooftops: uneven boxes, gables, a chimney here and there; nothing recognisable. Lit windows are small panes.
function roofs(base, color, { seed = 3, lights = [], light = '#F6C987', hmin = 26, hmax = 78 } = {}) {
  const r = rng(seed)
  let x = -20, d = `M-20 ${H + 20}`, wins = ''
  while (x < W + 20) {
    const w = pick(r, [46, 58, 64, 72, 88, 104, 120]), h = uni(r, hmin, hmax), top = base - h, kind = r()
    d += `L${f0(x)} ${f0(top)}`
    if (kind < .42) d += `L${f0(x + w / 2)} ${f0(top - w * .32)}L${f0(x + w)} ${f0(top)}`
    else if (kind < .55) { const c = x + w * .7; d += `L${f0(c)} ${f0(top)}L${f0(c)} ${f0(top - 16)}L${f0(c + 9)} ${f0(top - 16)}L${f0(c + 9)} ${f0(top)}L${f0(x + w)} ${f0(top)}` }
    else d += `L${f0(x + w)} ${f0(top)}`
    for (const lx of lights) if (x <= lx && lx < x + w) {
      const wy = top + Math.min(h - 18, h * uni(r, .3, .5))
      wins += `<rect x="${f0(lx - 9)}" y="${f0(wy - 8)}" width="26" height="28" rx="4" fill="${light}" opacity=".14"/>`
        + `<rect x="${f0(lx - 1)}" y="${f0(wy)}" width="5" height="6" fill="${light}"/><rect x="${f0(lx + 5)}" y="${f0(wy)}" width="5" height="6" fill="${light}"/>`
        + `<rect x="${f0(lx - 1)}" y="${f0(wy + 7)}" width="5" height="6" fill="${light}"/><rect x="${f0(lx + 5)}" y="${f0(wy + 7)}" width="5" height="6" fill="${light}"/>`
    }
    x += w
  }
  return `<path d="${d}L${W + 20} ${H + 20}Z" fill="${color}" filter="url(#lf)"/>` + wins
}

function stars(n, seed, y0, y1, { xr = [0, W], avoid = [], bright = [], color = '#FFF6DE' } = {}) {
  const r = rng(seed)
  let s = '', k = 0, tries = 0
  while (k < n && tries++ < n * 50) {
    const x = uni(r, ...xr), y = uni(r, y0, y1)
    if (avoid.some(([ax0, ay0, ax1, ay1]) => x >= ax0 && x <= ax1 && y >= ay0 && y <= ay1)) continue
    s += `<circle cx="${f0(x)}" cy="${f0(y)}" r="${pick(r, [.9, 1.1, 1.2, 1.4, 1.7])}" fill="${color}" opacity="${uni(r, .35, .85).toFixed(2)}"/>`
    k++
  }
  for (const [x, y, z] of bright) s += `<circle cx="${x}" cy="${y}" r="${z * 9}" fill="${color}" opacity=".1"/><circle cx="${x}" cy="${y}" r="${z * 4}" fill="${color}" opacity=".22"/><circle cx="${x}" cy="${y}" r="${z * 1.8}" fill="${color}"/>`
  return s
}

const sun = (x, y, r, c, halo) => `<circle cx="${x}" cy="${y}" r="${r * 4}" fill="${halo}" opacity=".18"/><circle cx="${x}" cy="${y}" r="${r * 2}" fill="${halo}" opacity=".28"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity=".95"/>`

// ---------- the nine scenes ----------
// a scene: the static picture (sun, stars, land) plus its drifting cloud tiles
const scene = (cl, land, extra = '') => {
  const ld = land.map(l => l[0]).join(''), lb = land.map(l => l[1]).join('')
  const out = { '': svg(FILTERS(cl.seed) + ld, extra + lb) }
  for (const k of ['cu', 'st']) if (cl[k]) out['-' + k] = cloudTile(cl.seed, cl[k])
  return out
}
const noClouds = { seed: 3 }
const scenes = {}

// s0 · late afternoon: pale haze, a low sun, a heap of cumulus up left, three soft hills
scenes.s0 = scene(clouds([
  ['cu', { cx: 360, base: 372, w: 560, h: 300, top: '#DCCCDD', under: '#F7D6BE', lit: '#FFE6C8', rim: '#FFF1DA', op: .8, seed: 2 }],
  ['cu', { cx: 1650, base: 300, w: 380, h: 170, top: '#E0D2E0', under: '#F8DABE', lit: '#FFE9CC', rim: '#FFF0D8', op: .72, seed: 5 }],
  ['st', { cx: 1180, cy: 214, w: 560, h: 40, top: '#E8D8E2', under: '#F9DCC2', rim: '#FFEBD0', op: .6, seed: 7, lumps: 6 }],
  ['st', { cx: 900, cy: 760, w: 1000, h: 40, top: '#EECAC4', under: '#F9D3B2', rim: '#FFE7C6', op: .7, seed: 8, lumps: 9 }],
]), [
  hill(808, [[16, 1.3], [9, 3.1]], '#E9BFAE', { seed: 1, crest: '#F6D6C0' }),
  hill(870, [[22, 1], [8, 2.7]], '#D9A2A0', { seed: 4, crest: '#EBBDB0' }),
  hill(948, [[18, .8], [6, 2.2]], '#BF8796', { seed: 6, crest: '#D79E9F' }),
], sun(1380, 800, 34, '#FFF3D6', '#FFE2B4'))

// s1 · golden hour, deeper: a lit cumulus beside the headline, a ribbon of cloud above the card, rose hills under it
scenes.s1 = scene(clouds([
  ['cu', { cx: 1720, base: 250, w: 380, h: 200, top: '#CDB4CC', under: '#F4BE98', lit: '#FFD8AE', rim: '#FFE2BC', op: .78, seed: 14 }],
  ['st', { cx: 520, cy: 452, w: 820, h: 70, top: '#D9BAC6', under: '#F3B48C', rim: '#FFD6A8', op: .85, seed: 11, lumps: 9 }],
  ['st', { cx: 1490, cy: 466, w: 700, h: 64, top: '#D8B6C4', under: '#F1AD88', rim: '#FFD2A4', op: .8, seed: 12, lumps: 8 }],
]), [
  hill(800, [[14, 1.2], [8, 3.3]], '#C98A8A', { seed: 21, crest: '#E2A795' }),
  hill(864, [[18, .9], [6, 2.4]], '#D9A094', { seed: 22, crest: '#E9B6A2' }),
])

// s2 · the sun has just set: mauve above, rose low behind the app, a lit cumulus over the app's corner, a low hill
scenes.s2 = scene(clouds([
  ['cu', { cx: 1700, base: 206, w: 360, h: 160, top: '#685893', under: '#D6909A', lit: '#F4AE9A', rim: '#F8BC9C', op: .85, seed: 31 }],
  ['st', { cx: 1100, cy: 1062, w: 900, h: 34, top: '#6E5490', under: '#B86A84', rim: '#E59A8C', op: .55, seed: 33, lumps: 8 }],
], 9), [hill(1046, [[10, 1.1], [5, 3]], '#3A2C60', { seed: 34, crest: '#5A4074' })])

// s3 · afterglow over a quiet street: rose fading, a cumulus catching the last light, the first rooftops
scenes.s3 = scene(clouds([
  ['cu', { cx: 1660, base: 222, w: 360, h: 180, top: '#5E4F8D', under: '#C07E96', lit: '#E8A094', rim: '#EDA592', op: .85, seed: 41 }],
  ['st', { cx: 1360, cy: 262, w: 860, h: 34, top: '#574A88', under: '#A86C8E', rim: '#D8948E', op: .65, seed: 42, lumps: 9 }],
], 12), [])   // the land is the rolling town (.scene-town, gen_town.py)

// s4 · dusk: lavender sky, the horizon glow behind the card, dark hills holding the step rail
scenes.s4 = scene(clouds([
  ['cu', { cx: 1660, base: 210, w: 420, h: 170, top: '#4B4486', under: '#A47298', lit: '#D3909C', rim: '#DE9C9A', op: .8, seed: 51 }],
  ['st', { cx: 1250, cy: 300, w: 620, h: 40, top: '#4A4588', under: '#A07096', rim: '#D99A98', op: .7, seed: 52, lumps: 7 }],
], 14), [
  hill(830, [[16, 1.1], [7, 2.9]], '#3B3168', { seed: 53, crest: '#6A4C7E' }),
  hill(880, [[20, .8], [6, 2.3]], '#2C2657', { seed: 54, crest: '#3E3168' }),
])

// s5 · early blue hour: periwinkle, a cooler cumulus with a rose underside, two early stars, the last rose seam
scenes.s5 = scene(clouds([
  ['cu', { cx: 1640, base: 196, w: 400, h: 150, top: '#3E417F', under: '#86689A', lit: '#B98AA4', rim: '#C495A8', op: .72, seed: 61 }],
], 16), [hill(1010, [[10, 1.2], [5, 3.4]], '#251F4E', { seed: 62, crest: '#46386A' }), hill(1050, [[8, .9], [4, 2.6]], '#1B1840', { seed: 63 })],
stars(5, 61, 24, 90, { xr: [1100, 1880], avoid: [[1440, 0, 1840, 200]] }))

// s6 · blue hour: deep blue, a sea-green twilight band (the paid colour's echo), the first bright star, low hills
scenes.s6 = scene(clouds([
  ['st', { cx: 1500, cy: 168, w: 560, h: 44, top: '#2E3A74', under: '#4E5E8E', rim: '#7A86A8', op: .65, seed: 71, lumps: 6 }],
], 18), [],   // the land is the rolling town (.scene-town, gen_town.py)
stars(14, 71, 20, 120, { xr: [1060, 1900] }) + stars(0, 1, 0, 1, { bright: [[1810, 70, 1.4]] }))

// s7 · night settles: stars, a sleeping street, a few lit windows below the sign-off
scenes.s7 = scene(noClouds, [['', roofs(1066, '#0E1130', { seed: 8, hmin: 18, hmax: 52, lights: [214, 470, 803], light: '#F6C987' })]],
  stars(46, 81, 10, 960, { avoid: [[90, 70, 960, 1010], [1060, 70, 1840, 1010]] }) + stars(10, 83, 10, 70, { xr: [100, 960] })
  + stars(0, 1, 0, 1, { bright: [[1010, 130, 1.3]] }))

// s8 · appendix, late night: quiet indigo, sparse stars
scenes.s8 = scene(noClouds, [], stars(40, 91, 10, 1070, { avoid: [[90, 70, 1830, 1000]] }) + stars(10, 92, 10, 80, { xr: [700, 1300] }))

// haze: where white headline text sits on the sky, the drifting clouds thin to 10 % as they pass behind it (a static
// mask on .sky, base.css), so every line keeps ≥ 4.5:1 at any drift phase. Boxes are the headings' ink boxes (x0 y0 x1 y1)
// at 1920 × 1080; slide 4 includes the marker loop around "pays the writer.". Recheck when a heading moves.
const HAZE = {
  s2: [[100, 76, 1285, 195]],
  s3: [[100, 76, 1408, 195]],
  s4: [[100, 77, 1244, 181], [40, 200, 740, 350]],
  s5: [[100, 76, 876, 195]],
  s6: [[100, 76, 1025, 195]],
}
const haze = boxes => svg('<filter id="hb" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>'
  + `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#1A1A1A" filter="url(#hb)">`
  + boxes.map(([x0, y0, x1, y1]) => `<rect x="${x0 - 28}" y="${y0 - 28}" width="${x1 - x0 + 56}" height="${y1 - y0 + 56}" rx="40"/>`).join('') + '</g></mask>',
  `<rect width="${W}" height="${H}" mask="url(#m)"/>`)
for (const [k, boxes] of Object.entries(HAZE)) scenes[k]['-haze'] = haze(boxes)

// paper grain (260 px tile) and a horizontal brush wash, laid over every sky in soft-light (base.css)
const grain = '<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".82" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1"/></filter><rect width="260" height="260" filter="url(#n)"/></svg>\n'
const wash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><filter id="w" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".0014 .009" numOctaves="4" seed="7"/><feColorMatrix values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1"/></filter><rect width="${W}" height="${H}" filter="url(#w)"/></svg>\n`

for (const [k, parts] of Object.entries(scenes)) for (const [suf, v] of Object.entries(parts)) writeFileSync(join(OUT, `${k}${suf}.svg`), v)
for (const [k, v] of Object.entries({ grain, wash })) writeFileSync(join(OUT, `${k}.svg`), v)
console.log(`scenes: ${Object.keys(scenes).length} + grain, wash → ${OUT}`)
