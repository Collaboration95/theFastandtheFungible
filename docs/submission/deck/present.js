// Browser presenter for site/deck/ (added by web.mjs; the PDF export never loads it).
// Keys: → / Space / PageDown next · ← / PageUp back · Home / End · F fullscreen. Click a slide for next; swipe on touch.
// The address keeps the slide number (#3), so a link can open on any slide.
(() => {
  const slides = [...document.querySelectorAll('.slide')]
  if (!slides.length) return
  const deck = document.createElement('main')
  deck.id = 'deck'
  deck.setAttribute('aria-roledescription', 'slide deck')
  slides[0].before(deck)
  deck.append(...slides)
  const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`
  const bar = document.createElement('nav')
  bar.id = 'bar'
  bar.setAttribute('aria-label', 'Slides')
  bar.innerHTML = `<span class="hint"><kbd>←</kbd> <kbd>→</kbd> to move · <kbd>F</kbd> fullscreen</span>
<button type="button" class="prev" aria-label="Previous slide">${icon('M15 5l-7 7 7 7')}</button>
<span class="count" aria-live="polite"></span>
<button type="button" class="next" aria-label="Next slide">${icon('M9 5l7 7-7 7')}</button>
<button type="button" class="fs" aria-label="Fullscreen">${icon('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5')}</button>`
  deck.after(bar)
  const [prev, next, fs, count] = ['.prev', '.next', '.fs', '.count'].map(s => bar.querySelector(s))

  let at = 0
  const fromHash = () => Math.min(slides.length, Math.max(1, parseInt(location.hash.slice(1), 10) || 1)) - 1
  function show(i, push = true) {
    at = Math.min(slides.length - 1, Math.max(0, i))
    slides.forEach((s, j) => { s.classList.toggle('on', j === at); s.setAttribute('aria-hidden', String(j !== at)); s.inert = j !== at })
    count.innerHTML = `<b>${at + 1}</b> / ${slides.length}`
    prev.disabled = at === 0
    next.disabled = at === slides.length - 1
    document.title = `${slides[at].dataset.title} · ResearchAgent deck`
    if (push && location.hash !== `#${at + 1}`) history.replaceState(null, '', `#${at + 1}`)
  }
  function fit() {
    const r = deck.getBoundingClientRect(), pad = document.documentElement.classList.contains('fs-on') ? 0 : 24
    deck.style.setProperty('--s', Math.min((r.width - 2 * pad) / 1920, (r.height - 2 * pad) / 1080))
  }
  const go = d => show(at + d)
  async function fullscreen() {
    try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen() } catch { /* not available: stay windowed */ }
  }

  prev.onclick = () => go(-1)
  next.onclick = () => go(1)
  fs.onclick = fullscreen
  deck.addEventListener('click', e => { if (!e.target.closest('a')) go(e.clientX < innerWidth / 4 ? -1 : 1) })
  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea, summary, details')) return
    const k = e.key
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(k) && !e.target.closest('a, button')) { e.preventDefault(); go(1) }
    else if (['ArrowLeft', 'PageUp'].includes(k)) { e.preventDefault(); go(-1) }
    else if (k === 'Home') { e.preventDefault(); show(0) }
    else if (k === 'End') { e.preventDefault(); show(slides.length - 1) }
    else if (k === 'f' || k === 'F') fullscreen()
  })
  let x0 = null
  deck.addEventListener('touchstart', e => { x0 = e.touches[0].clientX }, { passive: true })
  deck.addEventListener('touchend', e => {
    if (x0 === null) return
    const dx = e.changedTouches[0].clientX - x0
    x0 = null
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
  })
  document.addEventListener('fullscreenchange', () => { document.documentElement.classList.toggle('fs-on', !!document.fullscreenElement); fit() })
  let idle
  addEventListener('mousemove', () => { document.documentElement.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(() => document.documentElement.classList.add('idle'), 2000) })
  addEventListener('hashchange', () => show(fromHash(), false))
  addEventListener('resize', fit)
  new ResizeObserver(fit).observe(deck)
  fit()
  show(fromHash(), false)
})()
