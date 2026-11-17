/* ResearchAgent finals deck · runtime: stage scaling, navigation, in-slide steps, markers, print.
   Slide scripts register hooks with Deck.on('sN', {...}) and the build calls Deck.start() last.
   Contract (SYSTEM.md):
     →  Space  PgDn  Enter   next slide (a slide's next() hook may consume the press; only the intro does)
     ←  PgUp  Backspace      previous slide
     ↓ / ↑                   next / previous in-slide step (↓ after the last step returns to 0; ↑ stops at 0)
     1–9                     jump to that step · 0 or Esc: back to the rest state
     Home / End · #N in URL  first / last slide · deep link by slide number (#0 intro … #7)
     f                       fullscreen
     click on the slide      next (as →), except on in-slide controls marked [data-click]
     nav pill (below the stage, never on a slide or in print): ← N / total →
   Hook shape: { steps: N, set(n, ctx), enter(el, ctx), leave(el), next(ctx) → true to consume, final(el) }
   ctx: { animate, reduce, print } and, for enter, { dir: ±1, from: previous slide number or null, play }
   Step 0 is the rest state: what the slide shows on arrival, after leaving, and in print.
   Arrival motion: on a forward arrival (not print, not reduced motion) the slide gets .play, and base.css's
   primitives ([data-enter], .pop, .run, .bump, .shake, .draw, .stamp, .sweep) run their from-only keyframes,
   so the resting CSS is always the final state. Going backwards, print and reduced motion never get .play.
   Deck.seq(id, [[step, ms], …]) auto-runs in-slide steps after arrival; leaving or any key cancels it. */
(() => {
  const P = new URLSearchParams(location.search)
  const PRINT = P.has('print') || P.has('capture')
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches
  const hooks = {}
  const stepOf = {}
  let slides = [], cur = -1
  let seqTimers = []
  const stopSeq = () => { seqTimers.forEach(clearTimeout); seqTimers = [] }
  // a step the presenter asks for ends any arrival motion (its rest state is the final state anyway)
  const userStep = (id, n) => { stopSeq(); slides[cur]?.classList.remove('play'); setStep(id, n) }

  /* ---------- marker: the one hand-drawn loop, fitted around its .mk phrase ---------- */
  const NS = 'http://www.w3.org/2000/svg'
  const rng = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  const smooth = p => {
    const f = n => n.toFixed(1)
    let d = `M${f(p[0][0])} ${f(p[0][1])}`
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || c
      d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`
    }
    return d
  }
  /* The loop is fitted to the phrase's ink, not its box: each glyph's ink rectangle (canvas metrics), padded by
     GAP px plus half the stroke, must sit inside the loop, so it never touches a descender, ascender or full stop.
     The span then gets margins so the loop also clears the words beside it and the line above. */
  const GAP = 20
  const ctx2d = document.createElement('canvas').getContext('2d')
  function inkOf(m) {
    const cs = getComputedStyle(m), t = m.textContent
    ctx2d.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    ctx2d.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing
    const probe = document.createElement('i')
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
    m.appendChild(probe); const base = probe.offsetTop; probe.remove()
    const boxes = []
    for (let i = 0; i < t.length; i++) {
      if (/\s/.test(t[i])) continue
      const x0 = ctx2d.measureText(t.slice(0, i)).width, g = ctx2d.measureText(t[i])
      boxes.push([x0 - g.actualBoundingBoxLeft, base - g.actualBoundingBoxAscent, x0 + g.actualBoundingBoxRight, base + g.actualBoundingBoxDescent])
    }
    const desc = ctx2d.measureText('gjpqy').actualBoundingBoxDescent
    return { boxes, base, desc, fs: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.1, ws: ctx2d.measureText(' ').width }
  }
  function drawMark(m, seed) {
    m.querySelector(':scope>svg')?.remove()
    m.style.margin = ''
    if (!m.offsetWidth) return
    const { boxes, base, desc, fs, lh, ws } = inkOf(m)
    if (!boxes.length) return
    const R = rng(seed * 97 + 5), sw = Math.max(5, Math.min(10, fs * .085)), pad = GAP + sw / 2 + 2
    const x0 = Math.min(...boxes.map(b => b[0])), y0 = Math.min(...boxes.map(b => b[1])), x1 = Math.max(...boxes.map(b => b[2])), y1 = Math.max(...boxes.map(b => b[3]))
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, e = .5, q = 2 / e
    const A0 = (x1 - x0) / 2 + pad, B0 = (y1 - y0) / 2 + pad, d = pad * .7071
    // test points: each glyph box grown by pad (round corners), all inside the tilted loop; .95 covers the hand wobble
    const tests = boxes.flatMap(b => [[b[0] - pad, b[1]], [b[0] - pad, b[3]], [b[2] + pad, b[1]], [b[2] + pad, b[3]], [b[0], b[1] - pad], [b[2], b[1] - pad], [b[0], b[3] + pad], [b[2], b[3] + pad],
      [b[0] - d, b[1] - d], [b[2] + d, b[1] - d], [b[0] - d, b[3] + d], [b[2] + d, b[3] + d]])
    const inside = (A, B, tilt) => tests.every(([x, y]) => {
      const dx = x - cx, dy = y - cy, u = dx * Math.cos(tilt) + dy * Math.sin(tilt), v = -dx * Math.sin(tilt) + dy * Math.cos(tilt)
      return Math.abs(u / A) ** q + Math.abs(v / B) ** q <= .95 ** q
    })
    // the smallest loop that fits (size and a slight hand tilt), preferring width over height:
    // height runs into the lines around it
    let rx = A0 * 2, ry = B0 * 2, tilt = 0, best = Infinity
    for (let t = -.09; t <= .001; t += .015) for (let b = 1; b <= 2.2; b += .02) {
      let lo = 1, hi = 3
      if (!inside(A0 * hi, B0 * b, t)) continue
      for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; inside(A0 * mid, B0 * b, t) ? hi = mid : lo = mid }
      const cost = A0 * hi + 2 * B0 * b
      if (cost < best) { best = cost; rx = A0 * hi; ry = B0 * b; tilt = t }
    }
    const a0 = -2.5 + (R() - .5) * .4, N = 26, pts = []
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = a0 + t * Math.PI * 2 * 1.08, k = .97 + .06 * t + .02 * Math.sin(a * 2.3 + seed)
      const c = Math.cos(a), n = Math.sin(a), x = rx * k * Math.sign(c) * Math.abs(c) ** e, y = ry * k * Math.sign(n) * Math.abs(n) ** e
      pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt) + (R() - .5) * 2, cy + x * Math.sin(tilt) + y * Math.cos(tilt) + (R() - .5) * 2])
    }
    // the loop's outer edge, in span coordinates
    const L = Math.min(...pts.map(p => p[0])) - sw / 2, T = Math.min(...pts.map(p => p[1])) - sw / 2
    const Rt = Math.max(...pts.map(p => p[0])) + sw / 2, B = Math.max(...pts.map(p => p[1])) + sw / 2
    const w = m.offsetWidth
    // clear the neighbours: a word before or after on the same line, and the line above (its descenders)
    const prev = m.previousSibling?.textContent ?? '', next = m.nextSibling?.textContent ?? ''
    if (/\S\s*$/.test(prev)) m.style.marginLeft = Math.max(0, -L + GAP - (/\s$/.test(prev) ? ws : 0)) + 'px'
    if (/^\s*\S/.test(next)) m.style.marginRight = Math.max(0, Rt - w + GAP - (/^\s/.test(next) ? ws : 0)) + 'px'
    const block = m.parentElement, top = m.getBoundingClientRect().top - block.getBoundingClientRect().top
    if (top > lh * .5) { const d = (base - lh + desc + GAP) - T; if (d > 0) m.style.marginTop = d + 'px' }
    const ox = -L, oy = -T, W = Rt - L, H = B - T
    const s = document.createElementNS(NS, 'svg')
    s.setAttribute('width', W.toFixed(1)); s.setAttribute('height', H.toFixed(1)); s.setAttribute('viewBox', `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`); s.setAttribute('aria-hidden', 'true')
    s.style.left = -ox + 'px'; s.style.top = -oy + 'px'
    const p = document.createElementNS(NS, 'path')
    p.setAttribute('d', smooth(pts.map(([x, y]) => [x + ox, y + oy]))); p.setAttribute('stroke-width', sw.toFixed(1)); s.appendChild(p)
    p.style.setProperty('--len', (p.getTotalLength() + 2).toFixed(0))
    m.appendChild(s)
  }
  const allMarks = () => [...document.querySelectorAll('.mk')]
  const drawMarks = root => { const all = allMarks(); root.querySelectorAll('.mk').forEach(m => drawMark(m, all.indexOf(m) + 1)) }
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls) }
  // every SVG path.draw gets --len (its length) so the .draw primitive can stroke it on
  const drawLens = root => root.querySelectorAll('path.draw,line.draw,polyline.draw,circle.draw').forEach(p => {
    try { p.style.setProperty('--len', (p.getTotalLength() + 2).toFixed(0)) } catch { /* storage unavailable */ }
  })

  /* ---------- steps ---------- */
  const ctx = () => ({ animate: !REDUCE && !PRINT, reduce: REDUCE, print: PRINT })
  function setStep(id, n) {
    const h = hooks[id]
    if (!h || !h.steps) return
    n = ((n % (h.steps + 1)) + h.steps + 1) % (h.steps + 1)
    stepOf[id] = n
    h.set?.(n, ctx())
  }
  const rest = id => { if (hooks[id]?.steps) { stepOf[id] = 0; hooks[id].set?.(0, { ...ctx(), animate: false }) } }

  /* ---------- navigation ---------- */
  const numOf = el => +(el.id.match(/^s(\d+)$/)?.[1] ?? NaN)
  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i))
    if (i === cur) return
    const dir = i > cur ? 1 : -1, prev = slides[cur]
    stopSeq()
    if (prev) { prev.classList.remove('active', 'enter', 'play'); hooks[prev.id]?.leave?.(prev); rest(prev.id) }
    cur = i
    const el = slides[cur]
    el.classList.add('active')
    if (!REDUCE) replay(el, 'enter')
    // arrival motion only going forward (or on first load); backwards arrives in the final state
    const play = !REDUCE && !PRINT && dir > 0
    if (play) replay(el, 'play'); else el.classList.remove('play')
    hooks[el.id]?.enter?.(el, { ...ctx(), dir, from: prev ? numOf(prev) : null, play })
    if (!REDUCE) el.querySelectorAll('.mk').forEach(m => replay(m, 'draw'))
    if (pos) pos.textContent = `${cur + 1} / ${slides.length}`
    const n = numOf(el)
    try { history.replaceState(null, '', location.search + '#' + (Number.isFinite(n) ? n : cur)) } catch { /* storage unavailable */ }   // some browsers refuse on file://
  }
  const fromHash = () => {
    const n = parseInt(location.hash.slice(1), 10)
    if (!Number.isFinite(n)) return 0
    const k = slides.findIndex(s => numOf(s) === n)
    return k >= 0 ? k : 0
  }
  const forward = () => { const h = hooks[slides[cur].id]; if (h?.next?.(ctx()) !== true) go(cur + 1) }
  let pos = null
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = e.key, id = slides[cur].id, h = hooks[id]
    stopSeq()
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k)) { e.preventDefault(); forward(); return }
    if (['ArrowLeft', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); go(cur - 1); return }
    if (k === 'Home') { e.preventDefault(); go(0); return }
    if (k === 'End') { e.preventDefault(); go(slides.length - 1); return }
    if (k === 'f' || k === 'F') { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); return }
    if (!h?.steps) return
    if (k === 'ArrowDown') { e.preventDefault(); userStep(id, (stepOf[id] || 0) + 1) }
    else if (k === 'ArrowUp') { e.preventDefault(); userStep(id, Math.max(0, (stepOf[id] || 0) - 1)) }
    else if (k === 'Escape' || k === '0') userStep(id, 0)
    else if (/^[1-9]$/.test(k) && +k <= h.steps) userStep(id, +k)
  }

  /* ---------- final state (print, ?print=1, Cmd+P) ---------- */
  function finalAll() {
    stopSeq()
    slides.forEach(el => { el.classList.remove('enter', 'play'); rest(el.id); hooks[el.id]?.final?.(el) })
    document.querySelectorAll('.mk.draw').forEach(m => m.classList.remove('draw'))
  }

  window.Deck = {
    PRINT, REDUCE,
    /** Register hooks for one slide: Deck.on('s4', { steps: 4, set(n, ctx) {…} }) */
    on(id, hook) { hooks[id] = hook },
    /** Set a slide's step from its own click handlers: Deck.step('s3', 2) */
    step(id, n) { userStep(id, n) },
    /** Auto-run in-slide steps after arrival: Deck.seq('s4', [[1, 200], [2, 500]]); leaving or any key cancels */
    seq(id, list) {
      stopSeq()
      if (REDUCE || PRINT) return
      seqTimers = list.map(([n, ms]) => setTimeout(() => { if (slides[cur]?.id === id) setStep(id, n) }, ms))
    },
    stepOf: id => stepOf[id] || 0,
    start() {
      slides = [...document.querySelectorAll('section.slide')]
      const stage = document.getElementById('stage')
      drawMarks(document)
      drawLens(document)
      document.fonts?.ready.then(() => drawMarks(document))
      addEventListener('beforeprint', finalAll)
      if (PRINT) {
        document.documentElement.classList.add('print')
        finalAll()
        return
      }
      // the nav pill lives in a band under the stage, so it never covers a slide
      const BAND = 64
      const nav = document.createElement('nav')
      nav.className = 'nav'; nav.setAttribute('aria-label', 'Slides')
      nav.innerHTML = '<button type="button" aria-label="Previous slide">←</button><span class="pos"></span><button type="button" aria-label="Next slide">→</button>'
      const [prevB, nextB] = nav.querySelectorAll('button')
      pos = nav.querySelector('.pos')
      prevB.addEventListener('click', () => go(cur - 1))
      nextB.addEventListener('click', () => forward())
      nav.addEventListener('mousedown', e => e.preventDefault())   // keep focus off the buttons so Space/Enter don't double-step
      document.body.appendChild(nav)
      const fit = () => {
        const s = Math.min(innerWidth / 1920, (innerHeight - BAND) / 1080)
        stage.style.top = (innerHeight - BAND) / 2 + 'px'
        stage.style.transform = `translate(-50%,-50%) scale(${s})`
      }
      addEventListener('resize', fit); fit()
      stage.addEventListener('click', e => {
        if (e.button !== 0) return
        stopSeq()
        if (e.target.closest('[data-click],a,button,input,select,textarea,label')) return
        if (getSelection()?.toString()) return
        forward()
      })
      slides.forEach(el => rest(el.id))
      go(fromHash())
      addEventListener('hashchange', () => go(fromHash()))
      addEventListener('keydown', onKey)
      let idle
      addEventListener('mousemove', () => { document.body.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.add('idle'), 2000) })
    }
  }
})()
