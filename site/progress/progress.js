// /progress/ enhancements. The page is complete without this file: every number is
// already in the HTML. This adds count-up on first view, tooltips, "Open all" and
// deep links that open a rail stop. No network requests.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches

  // Count-up: short, once, only when the stat scrolls into view; skipped for reduced motion.
  const nums = [...document.querySelectorAll('[data-count]')]
  if (!reduce && 'IntersectionObserver' in window) {
    const show = (el, v) => {
      const d = Number(el.dataset.decimals || 0)
      el.textContent = `${el.dataset.prefix || ''}${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${el.dataset.suffix || ''}`
    }
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        io.unobserve(entry.target)
        const el = entry.target, to = Number(el.dataset.count), final = el.textContent, start = performance.now(), ms = 700
        if (!Number.isFinite(to) || to === 0) continue
        const step = now => {
          const t = Math.min(1, (now - start) / ms), eased = 1 - Math.pow(1 - t, 3)
          if (t < 1) { show(el, to * eased); requestAnimationFrame(step) } else el.textContent = final
        }
        requestAnimationFrame(step)
      }
    }, { threshold: 0.6 })
    for (const el of nums) io.observe(el)
  }

  // Tooltips for chart marks (pointer and keyboard focus).
  const tip = document.getElementById('tip')
  let current = null
  const place = (x, y) => {
    const r = tip.getBoundingClientRect()
    tip.style.left = `${Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2))}px`
    tip.style.top = `${Math.max(8, y - r.height - 12)}px`
  }
  const open = (el, x, y) => { current = el; tip.textContent = el.dataset.tip; tip.hidden = false; place(x, y) }
  const close = () => { current = null; tip.hidden = true }
  document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el) open(el, e.clientX, e.clientY); else if (current) close() })
  document.addEventListener('pointermove', e => { if (current) place(e.clientX, e.clientY) })
  document.addEventListener('pointerleave', close)
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el) { const r = el.getBoundingClientRect(); open(el, r.left + r.width / 2, r.top) } })
  document.addEventListener('focusout', close)
  addEventListener('scroll', () => { if (current && !current.matches(':hover')) close() }, { passive: true })

  // Rail: open the stop a link points at, and "Open all".
  const openStop = id => { const d = document.getElementById(id)?.querySelector('details'); if (d) d.open = true }
  document.addEventListener('click', e => { const a = e.target.closest('[data-open]'); if (a) openStop(a.dataset.open) })
  if (location.hash.startsWith('#stop-')) openStop(location.hash.slice(1))
  const toggle = document.querySelector('[data-expand="rail"]')
  if (toggle) toggle.addEventListener('click', () => {
    const all = [...document.querySelectorAll('#rail details')], opening = all.some(d => !d.open)
    for (const d of all) d.open = opening
    toggle.textContent = opening ? 'Close all' : 'Open all'
    toggle.setAttribute('aria-pressed', String(opening))
  })
})()
