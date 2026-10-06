/* Renders any ResearchAgent screen from (scenario, step, overlay). One renderer
   draws every thumbnail, the lightbox and the Play frame, so they stay in sync.
   With animate: true, only elements that enter at the current step get class "n",
   which is what the keyframes in mock.css hook onto. */
(function () {
  const D = window.RA
  const money = v => 'S$' + v.toFixed(2)
  const src = id => D.sources.find(s => s.id === id)
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const STORY = ['home', 'takeoff', 'search', 'read', 'answer1', 'gap', 'decide', 'verdicts', 'pay402', 'settle', 'verified', 'answer2', 'impact', 'round2', 'done', 'report', 'reportReady']
  const SCN = {
    story: { label: 'S$2 · demo story', budget: 2, steps: STORY },
    zero: { label: 'S$0 · free only', budget: 0, steps: ['home', 'takeoff', 'search', 'read', 'answer1', 'gap', 'decide', 'wouldbuy', 'done'] },
    open: { label: 'Nothing worth buying', budget: 2, steps: ['home', 'takeoff', 'search', 'read', 'answer1', 'gap', 'decide', 'nothing', 'done'] },
    fault: { label: 'Delivery fails once', budget: 2, steps: ['home', 'takeoff', 'search', 'read', 'answer1', 'gap', 'decide', 'verdicts', 'pay402', 'settle', 'failed', 'retry', 'verified', 'answer2', 'impact', 'round2', 'done'] },
    inject: { label: 'Injection trap', budget: 2, steps: ['home', 'takeoff', 'search', 'read', 'answer1', 'gap', 'decide', 'verdicts', 'pay402', 'settle', 'verified', 'answer2', 'impact', 'round2', 'done'] },
  }

  // Dwell time (ms at 1×) and the presenter caption for each step.
  const STEP = {
    home: [2900, 'Home. The demo question is prefilled with a S$2 budget. The sentence under the coins says what that budget allows. Ask.'],
    takeoff: [800, 'The question card lifts into the workspace. No page load, no spinner.'],
    search: [1900, 'Search: three publisher profiles return 18 sources, dealt onto the strip.'],
    read: [1900, 'Free sources are read. Four paywalled ones stay locked behind a price tag.'],
    answer1: [3400, 'Answer v1 streams in with citations. Every number opens the exact passage.'],
    gap: [2000, 'The answer names what it still doesn’t know: grid energisation. The pen circles it.'],
    decide: [2400, 'The decision model scores the four paywalled sources in 0.75 s. Each bar is value against the 0.20 bar.'],
    verdicts: [2900, 'Policy code stamps a verdict on every row. Only one source clears the bar and fits the cap.'],
    pay402: [2000, 'The publisher answers 402 Payment Required with a S$0.80 quote. The wallet holds it: S$1.20 left.'],
    settle: [2000, 'Simulated settlement turns the hold into one charge, with one receipt.'],
    verified: [2400, 'Delivery arrives and its sha-256 matches. Only now may the premium text be read.'],
    answer2: [3300, 'Answer v2 is rewritten around the new evidence. The gap card fills in.'],
    impact: [2300, 'Impact: QUALIFIES. The short answer moves from “unclear” to “240 of 600 MW”.'],
    round2: [2100, 'Round 2: with the gap closed, nothing clears the bar. It stops on its own.'],
    done: [3000, 'Done. S$0.80 of S$2.00 spent. The toast, tab title and favicon all say so.'],
    report: [2200, 'Download report: the button becomes a progress pill while the PDF is written.'],
    reportReady: [3000, 'Report ready. The PDF uses the same citation numbers as the screen.'],
    failed: [2900, 'Delivery fails after payment. The receipt is kept, and the card says retrying can’t charge again.'],
    retry: [1700, 'Retry asks for the same paid copy against the same receipt.'],
    wouldbuy: [3200, 'S$0 budget: the table still shows what it would have bought. Nothing is charged.'],
    nothing: [3200, 'Every source falls short of the bar, so nothing is bought. The free answer stands.'],
  }

  const ICON = {
    check: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.4l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="5.5" width="7" height="5" rx="1.2" fill="currentColor"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    flag: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 11V1.5M3 2h6l-1.5 2.2L9 6.5H3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    panel: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 3.5v13" stroke="currentColor" stroke-width="1.6"/></svg>',
    clock: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 6.5V10l2.5 1.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    cursor: '<svg class="m-cursor" viewBox="0 0 22 22" aria-hidden="true"><path d="M3 2l15 8.5-6.6 1.6L8.4 19z" fill="#0F1222" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  }

  function mark(cls = '') {
    return `<svg class="ra-mark ${cls}" viewBox="0 0 32 32" aria-hidden="true"><path class="br l" d="M11.5 6.5H7.5v19h4"/><path class="br r" d="M20.5 6.5h4v19h-4"/><circle class="coin" cx="16" cy="19" r="4.4"/></svg>`
  }
  function appIcon(size = 38) {
    return `<svg class="app" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="15" fill="#2F45FF"/><path d="M24 15h-7v34h7M40 15h7v34h-7" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="38" r="8" fill="#FFE45C"/></svg>`
  }

  // ---------- context ----------
  // Tweaks (feedback round 1): quiet, nav ('open' | 'rail'), bar, fold, pills, simbar.
  // A spec's own tw wins; otherwise the page-wide default set by setTweaks().
  let DEF = {}
  function ctx(spec) {
    const scnKey = spec.scn || 'story'
    const scn = SCN[scnKey]
    const step = spec.step || 'home'
    const i = scn.steps.indexOf(step)
    const reached = new Set(scn.steps.slice(0, i + 1))
    const anim = !!spec.animate
    return {
      scnKey, scn, step, o: spec.overlay || '', view: spec.view || '', variant: spec.variant || '', anim,
      r: n => reached.has(n),
      nw: (...names) => (anim && names.includes(step) ? ' n' : ''),
      budget: spec.overlay === 'budgetOut' ? 1 : scn.budget,
      tw: spec.tw || DEF,
    }
  }

  // ---------- browser chrome ----------
  function tabInfo(c) {
    if (c.view === 'osnote') return { t: '✓ Answer ready · ResearchAgent', f: 'done' }
    if (c.view || c.step === 'home' || c.step === 'takeoff') return { t: 'ResearchAgent', f: '' }
    if (c.o === 'stopped') return { t: 'Stopped · ResearchAgent', f: '' }
    if (c.step === 'failed') return { t: '! Delivery failed · ResearchAgent', f: 'alert' }
    if (c.r('reportReady')) return { t: '✓ Report ready · ResearchAgent', f: 'done' }
    if (c.r('done')) return { t: '✓ Answer ready · ResearchAgent', f: 'done' }
    if (['pay402', 'settle', 'retry', 'verified'].includes(c.step)) return { t: 'Buying S$0.80 · ResearchAgent', f: 'work' }
    if (c.r('answer2')) return { t: 'Rewriting answer · ResearchAgent', f: 'work' }
    if (c.r('decide')) return { t: 'Choosing sources · ResearchAgent', f: 'work' }
    return { t: 'Reading sources · ResearchAgent', f: 'work' }
  }
  function chrome(c) {
    const tab = tabInfo(c)
    const other = c.view === 'osnote'
    const fav = `<span class="m-fav ${tab.f ? 'f-' + tab.f : ''}">${mark()}</span>`
    return `<div class="m-chrome"><div class="m-tabs"><div class="m-dots"><i></i><i></i><i></i></div>
      <div class="m-tab ${other ? '' : 'is-on'}">${fav}<span class="m-tab-t">${tab.t}</span><span class="m-tab-x">×</span></div>
      <div class="m-tab ${other ? 'is-on' : ''}"><span class="m-fav" style="background:#7C8394"></span><span class="m-tab-t">Team notes · Oct 10 demo</span><span class="m-tab-x">×</span></div>
    </div><div class="m-url-row"><div class="m-navs">‹ › ↻</div><div class="m-url">${other ? 'notes.internal/oct-10' : '127.0.0.1:5100' + (c.view || c.step === 'home' ? '' : '/run/b5390658')}</div></div></div>`
  }

  function top(c, ws) {
    const fb = c.o === 'fallback', tw = c.tw
    // T1: normal is silent. A chip appears only when something is substituted.
    const chips = tw.quiet ? (fb ? '<span class="m-chip is-fallback"><i></i>Offline answer · Groq timed out</span>' : '') : `
        <span class="m-chip ${fb ? 'is-fallback' : ''}"><i></i>Research · ${fb ? 'fixture fallback' : 'Groq llama-3.3-70b'}</span>
        <span class="m-chip"><i></i>Decide · Cloudflare clef-flash</span>
        <span class="m-chip"><i></i>Publisher · local</span>
        <span class="m-chip is-sim">SIMULATED SGD · no real funds</span>`
    return `<header class="m-top${c.nw('takeoff', 'search') && ws ? ' n' : ''}">
      ${tw.nav ? `<span class="m-iconbtn">${ICON.panel}</span>` : ''}
      <div class="m-brand">${mark()}<span>ResearchAgent</span></div>
      ${ws ? `<div class="m-crumb"><span>Run</span><b>${D.short}</b></div>` : ''}
      <div class="m-prov">${chips}</div>
      ${ws && tw.nav ? '' : `<button class="m-btn">${ws ? 'New question' : 'How it works'}</button>`}
    </header>`
  }
  const SIMBAR = '<div class="m-simbar"><b>SIMULATED SGD</b>Demo money. No real funds move.</div>'
  const simTag = (c, long) => c.tw.quiet && !c.tw.simbar ? `<span class="m-chip is-sim">SIMULATED SGD${long ? ' · no real funds' : ''}</span>` : ''

  // ---------- rail: the run tape ----------
  function tapeItems(c) {
    const k = c.scnKey
    const base = [
      { title: 'Search', start: ['search'], done: ['read'], now: '3 publisher profiles…', fin: '18 sources found', t: '0.4 s' },
      { title: 'Read free sources', start: ['read'], done: ['answer1'], now: '14 free · 4 paywalled', fin: k === 'inject' ? '14 read · 1 flagged' : '14 read · 4 paywalled', t: '1.5 s' },
      { title: 'Write answer v1', start: ['answer1'], done: ['gap'], now: 'Streaming…', fin: '8 cited claims', t: '2.7 s' },
      { title: 'Name the gap', start: ['gap'], done: ['decide'], now: 'Grid energisation', fin: k === 'open' ? 'Nothing material' : 'Grid energisation', t: '0.1 s' },
    ]
    if (k === 'zero') return base.concat([
      { title: 'Choose what to buy', start: ['decide'], done: ['done'], now: 'Scoring 4 paywalled…', fin: 'Would buy 1 · S$0 budget', t: '0.8 s' },
      { title: 'Buy', skip: true, fin: 'S$0 budget · nothing bought' },
      { title: 'Done', start: ['done'], done: ['done'], fin: 'S$0.00 spent · free answer', t: '5.1 s' },
    ])
    if (k === 'open') return base.concat([
      { title: 'Choose what to buy', start: ['decide'], done: ['done'], now: 'Scoring 4 paywalled…', fin: 'Nothing clears the bar', t: '0.8 s' },
      { title: 'Buy', skip: true, fin: 'Nothing worth buying' },
      { title: 'Done', start: ['done'], done: ['done'], fin: 'S$0.00 of S$2.00 spent', t: '5.1 s' },
    ])
    const buyNow = { pay402: '402 → quote S$0.80', settle: 'Settling S$0.80…', failed: 'Paid · delivery failed', retry: 'Retrying, same receipt…' }
    return base.concat([
      { title: 'Choose what to buy', start: ['decide'], done: ['pay402'], now: 'Scoring 4 paywalled…', fin: '1 of 4 clears the bar', t: '0.8 s' },
      { title: 'Buy', start: ['pay402'], done: ['verified'], fail: ['failed'], nowMap: buyNow, fin: 'Grid Operators Report · S$0.80', t: k === 'fault' ? '3.9 s' : '0.6 s' },
      { title: 'Verify delivery', start: ['verified'], done: ['answer2'], now: 'Checking sha-256…', fin: 'sha-256 matches', t: '0.1 s' },
      { title: 'Rewrite answer', start: ['answer2'], done: ['round2'], now: 'Writing v2…', fin: 'v2 · qualifies', t: '2.6 s' },
      { title: 'Check again', start: ['round2'], done: ['done'], now: 'Round 2…', fin: 'Nothing clears the bar', t: '0.4 s' },
      { title: 'Done', start: ['done'], done: ['done'], fin: c.o === 'budgetOut' ? 'S$0.80 of S$1.00 spent' : 'S$0.80 of S$2.00 spent', t: k === 'fault' ? '12.7 s' : '9.4 s' },
    ])
  }
  // One state machine for the tape, the run bar (T3) and the sidebar's mini tape (T2).
  function tapeStates(c) {
    let stopped = false
    return tapeItems(c).map(it => {
      let st = 'todo', meta = ''
      if (it.skip) { st = c.r('done') ? 'skip' : 'todo'; meta = c.r('done') ? it.fin : '' }
      else if (stopped) { st = 'skip'; meta = 'Not run' }
      else if (it.fail && it.fail.includes(c.step)) { st = 'fail'; meta = it.nowMap[c.step] }
      else if (it.done.some(c.r) && !(it.title === 'Done' && !c.r('done'))) { st = 'done'; meta = it.fin }
      else if (it.start.some(c.r)) { st = 'now'; meta = (it.nowMap && it.nowMap[c.step]) || it.now || it.fin }
      if (c.o === 'stopped' && st === 'now') { st = 'skip'; meta = 'Stopped by you'; stopped = true }
      return { it, st, meta, entering: c.anim && (it.start || []).includes(c.step) }
    })
  }
  function clock(c) {
    return c.r('done') ? (c.scnKey === 'fault' ? '00:12.7' : c.scnKey === 'zero' || c.scnKey === 'open' ? '00:05.1' : '00:09.4') : c.o === 'stopped' ? '00:04.9' : ({ takeoff: '00:00.0', search: '00:00.3', read: '00:01.2', answer1: '00:02.9', gap: '00:04.6', decide: '00:04.9', verdicts: '00:05.4', wouldbuy: '00:05.4', nothing: '00:05.4', pay402: '00:05.5', settle: '00:05.8', failed: '00:06.3', retry: '00:09.1', verified: '00:06.2', answer2: '00:07.4', impact: '00:08.9', round2: '00:09.1' }[c.step] || '00:00.0')
  }
  const stopBtn = c => {
    const finished = c.r('done') || c.o === 'stopped'
    return `<button class="m-stop ${finished ? 'is-off' : ''}">${c.o === 'stopped' ? 'Stopped · no new purchases' : finished ? 'Run finished' : 'Stop buying'}</button>`
  }
  const SHOWWORK = '<div class="m-showwork"><span>Show work</span><kbd>W</kbd></div>'
  function rail(c) {
    const lis = tapeStates(c).map(({ it, st, meta, entering }) => `<li class="is-${st}"><i class="m-node${entering ? ' n' : ''}"></i><div><b>${it.title}</b>${meta ? `<span>${meta}</span>` : ''}</div>${st === 'done' && it.t ? `<time>${it.t}</time>` : '<time></time>'}</li>`).join('')
    return `<aside class="m-rail${c.nw('takeoff', 'search')}"><div class="m-rail-h"><span>Run</span><span class="mono">${clock(c)}</span></div>
      <ol class="m-tape">${lis}</ol>
      <div class="m-rail-foot">${stopBtn(c)}${SHOWWORK}</div></aside>`
  }

  // T3: the run as one line along the bottom.
  const SHORT = { 'Search': 'Search', 'Read free sources': 'Read', 'Write answer v1': 'Answer', 'Name the gap': 'Gap', 'Choose what to buy': 'Choose', 'Buy': 'Buy', 'Verify delivery': 'Verify', 'Rewrite answer': 'Rewrite', 'Check again': 'Check', 'Done': 'Done' }
  function runbar(c) {
    const rows = tapeStates(c)
    const cur = rows.find(x => x.st === 'now' || x.st === 'fail')
    const stop = rows.find(x => x.meta === 'Stopped by you')
    const last = rows[rows.length - 1]
    const head = c.r('done') ? ['is-done', 'Done in ' + last.it.t, last.meta] : stop ? ['is-skip', stop.it.title, 'Stopped by you'] : cur ? ['is-' + cur.st, cur.it.title, cur.meta] : ['is-now', 'Starting', 'Opening the run…']
    const steps = rows.map(x => `<li class="is-${x.st}${x.entering ? ' n' : ''}"><i></i><span>${SHORT[x.it.title]}</span></li>`).join('')
    return `<div class="m-runbar${c.nw('takeoff', 'search')}">
      <div class="m-rb-now ${head[0]}"><i class="m-node${cur && cur.entering ? ' n' : ''}"></i><div><b>${head[1]}</b><span>${head[2]}</span></div></div>
      <ol class="m-rb-steps">${steps}</ol><span class="m-rb-clock">${clock(c)}</span>${stopBtn(c).replace('Stopped · no new purchases', 'Stopped').replace('Run finished', 'Finished')}${SHOWWORK}</div>`
  }

  // T2: an app sidebar. Past runs are placeholders until the API can list runs.
  const HISTORY = [['Johor grid queue 2027', 'S$0.00'], ['Hyperscaler PPAs in SEA', 'S$1.30'], ['Data-centre water use', 'S$0.40'], ['Batam subsea cable timing', 'S$0.00']]
  function sidebar(c, onHome) {
    const dot = st => `<span class="m-dot d-${st}"></span>`
    const runSt = c.step === 'failed' ? 'alert' : c.o === 'stopped' ? 'idle' : c.r('done') ? 'done' : 'work'
    const rows = onHome ? [] : tapeStates(c)
    const tape = !onHome && !c.tw.bar
    const enter = c.nw('takeoff', 'search')
    if (c.tw.nav === 'rail') {
      return `<aside class="m-nav is-rail${enter}"><span class="m-railbtn m-newq-i">+</span><span class="m-railbtn">${ICON.clock}${onHome ? '' : dot(runSt)}</span>
        ${tape ? `<ol class="m-tape is-dots">${rows.map(x => `<li class="is-${x.st}"><i class="m-node${x.entering ? ' n' : ''}"></i></li>`).join('')}</ol>` : ''}
        <div class="m-nav-foot"><span class="av">D</span><span class="m-collapse">»</span></div></aside>`
    }
    const active = onHome ? '' : `<div class="m-nav-run is-on">${dot(runSt)}<span class="t">${D.short}</span><span class="m">${c.r('settle') ? 'S$0.80' : 'S$0.00'}</span></div>`
    const mini = tape ? `<ol class="m-tape is-mini">${rows.map(x => `<li class="is-${x.st}"><i class="m-node${x.entering ? ' n' : ''}"></i><div><b>${x.it.title}</b>${(x.st === 'now' || x.st === 'fail') && x.meta ? `<span>${x.meta}</span>` : ''}</div></li>`).join('')}</ol>` : ''
    const hist = HISTORY.map(([t, m], i) => `${i === 2 ? '<div class="m-nav-sec">Earlier</div>' : ''}<div class="m-nav-run">${dot('idle')}<span class="t">${t}</span><span class="m">${m}</span></div>`).join('')
    return `<aside class="m-nav${enter}"><div class="m-newq"><span>+</span>New question<kbd>N</kbd></div>
      <div class="m-nav-sec">Today</div>${active}${mini}${hist}
      <div class="m-nav-foot">${tape ? stopBtn(c) + SHOWWORK : ''}<div class="m-acct"><span class="av">D</span><span><b>Demo workspace</b><small>Sign-in comes later</small></span><span class="m-collapse">«</span></div></div></aside>`
  }

  // ---------- brief ----------
  const STRIP_IDS = { inject: ['gor', 'cr', 'cs', 'eo', 'gs', 'fp'] }
  function cardState(c, s) {
    const k = c.scnKey
    if (!c.r('read')) return ['st-found', 'found', '']
    if (s.tier === 'free') return k === 'inject' && s.id === 'fp' ? ['st-flag', 'flagged', 'is-flag', ICON.flag] : ['st-read', 'read', '', ICON.check]
    const decided = c.r('verdicts') || c.r('wouldbuy') || c.r('nothing')
    if (s.id === 'gor') {
      if (k === 'zero' && c.r('wouldbuy')) return ['st-would', 'would buy · S$0.80', '']
      if (k === 'open' && c.r('nothing')) return ['st-skip', 'below the bar', '']
      if (c.r('verified')) return ['st-bought', 'bought S$0.80', 'is-bought', ICON.check]
      if (c.step === 'failed') return ['st-fail', 'paid · not delivered', '']
      if (c.r('pay402')) return ['st-buying', 'buying…', '']
    }
    if (decided) {
      if (s.id === 'gs') return ['st-cap', 'over cap · S$1.40', '']
      if (s.id === 'nw') return ['st-skip', 'low value · S$0.20', '']
      if (s.id === 'cn') return ['st-skip', 'rewrite · S$0.30', '']
    }
    return ['st-lock', money(s.price), '', ICON.lock]
  }
  function strip(c) {
    if (!c.r('search')) {
      const ghosts = Array.from({ length: 6 }, () => '<div class="m-card is-ghost"><i style="width:60%"></i><i></i><i style="width:80%"></i></div>').join('')
      return `<section class="m-strip"><div class="m-strip-h"><b>Sources</b><span class="m-count">Searching 3 publisher profiles…</span></div><div class="m-cards">${ghosts}<div class="m-more">…</div></div></section>`
    }
    const ids = STRIP_IDS[c.scnKey] || ['gor', 'cr', 'cs', 'eo', 'gs', 'nw']
    const cards = ids.map((id, i) => {
      const s = src(id)
      const [cls, label, cardCls, icon] = cardState(c, s)
      const changed = c.step === 'read' || (['verdicts', 'wouldbuy', 'nothing'].includes(c.step) && s.tier === 'paid') || (['pay402', 'verified', 'failed'].includes(c.step) && s.id === 'gor')
      const flip = c.anim && changed
      return `<div class="m-card ${cardCls}${c.nw('search')}" style="--i:${i}"><div class="m-card-top"><span class="m-mono">${s.mono}</span><span class="m-card-p">${s.pub}</span></div><div class="m-card-t">${s.title}</div><div class="m-card-s ${cls}${flip ? ' n' : ''}" style="--i:${i}">${icon || ''}${label}</div></div>`
    }).join('')
    const read = c.r('read') ? 14 : 0
    const bought = c.r('verified') ? 1 : 0
    const skipped = c.r('verdicts') ? 3 : c.r('wouldbuy') || c.r('nothing') ? 4 : 0
    return `<section class="m-strip"><div class="m-strip-h"><b>Sources</b><span class="m-count${c.nw('read', 'verified')}"><span><em>18</em> found</span><span><em>${read}</em> read</span><span class="c-b"><em>${bought}</em> bought</span><span><em>${skipped}</em> skipped</span></span></div>
      <div class="m-cards">${cards}<div class="m-more">+12</div></div></section>`
  }

  // T5: sources in one line. Initials coloured by state; only the source that matters is named.
  function pills(c) {
    const ids = STRIP_IDS[c.scnKey] || ['gor', 'cr', 'cs', 'eo', 'gs', 'nw']
    if (!c.r('search')) return `<section class="m-pills"><b>Sources</b><span class="m-stack">${ids.map(() => '<span class="m-av is-ghost"></span>').join('')}</span><span class="m-count">Searching 3 publisher profiles…</span></section>`
    const heads = ids.map((id, i) => { const s = src(id); return `<span class="m-av ${cardState(c, s)[0]}${c.nw('search')}" style="--i:${i}">${s.mono}</span>` }).join('')
    const hot = ids.map(src).map(s => [s, cardState(c, s)]).filter(([, st]) => ['st-bought', 'st-buying', 'st-fail', 'st-would', 'st-flag'].includes(st[0]))
    const named = hot.map(([s, [cls, label, , icon]]) => `<span class="m-pill ${cls}${c.nw('read', 'pay402', 'verified', 'failed', 'wouldbuy')}"><span class="m-mono">${s.mono}</span>${s.pub}<em>${icon || ''}${label}</em></span>`).join('')
    // The named pill says what was bought, so the counts skip it.
    const skipped = c.r('verdicts') ? 3 : c.r('wouldbuy') || c.r('nothing') ? 4 : 0
    return `<section class="m-pills"><b>18 sources</b><span class="m-stack">${heads}<span class="m-av more">+12</span></span>
      <span class="m-count${c.nw('read')}"><span><em>${c.r('read') ? 14 : 0}</em> read</span>${skipped ? `<span><em>${skipped}</em> skipped</span>` : ''}</span>${named}<u class="m-viewall">View all</u></section>`
  }

  // Turns "text [9] more" into words + citation chips. When animating, each token streams in.
  function stream(text, opts) {
    const { anim, newSet = new Set(), hl } = opts
    let html = esc(text)
    if (hl) html = html.replace(hl, `<mark class="m-hl${opts.hlNew ? ' n' : ''}">${hl}</mark>`)
    const parts = html.split(/(\s?\[\d+\]|<mark[^>]*>.*?<\/mark>|\s+)/).filter(Boolean)
    let k = 0
    return parts.map(p => {
      const m = p.match(/\[(\d+)\]/)
      if (m) { const n = +m[1]; return `<span class="m-cite${newSet.has(n) ? ' is-new' : ''}${opts.hover === n ? ' is-hover' : ''}${anim ? ' w' : ''}" style="--d:${k++ * 45}ms">${n}</span>` }
      if (/^\s+$/.test(p)) return ' '
      if (!anim) return p
      return `<span class="w" style="--d:${k++ * 45}ms">${p}</span>`
    }).join('')
  }

  function verdict(c) {
    if (!c.r('answer1')) {
      return `<section class="m-verdict"><div class="m-vlabel"><b>Short answer</b><span class="m-ver">reading free sources</span></div>
        <div class="m-vtext is-skel"><i style="width:92%"></i><i style="width:84%"></i><i style="width:46%"></i></div>
        <div class="m-vfoot"><span class="m-note">The first answer usually lands in about 3 seconds. Paid sources stay locked until the policy buys one.</span></div></section>`
    }
    const v2 = c.r('answer2')
    const compare = c.o === 'compare'
    const text = v2 ? D.verdictV2 : c.scnKey === 'open' ? 'Free sources are enough for a first view: demand [1] and equipment on order [7] are documented, and nothing paywalled would change the answer enough to be worth buying.' : D.verdictV1
    const label = v2 ? 'v2 · after 1 purchase' : c.o === 'fallback' ? 'v1 · fixture fallback · Groq timed out after 8 s' : 'v1 · free sources only'
    const typing = c.anim && (c.step === 'answer1' || c.step === 'answer2')
    const body = stream(text, { anim: typing, newSet: new Set([9, 10, 11]), hover: c.o === 'hover' ? 9 : 0, hl: v2 ? '240 of the 600 MW has a confirmed grid slot before 2028' : '', hlNew: c.anim && c.step === 'answer2' })
    const done = c.r('done')
    let action
    if (c.r('reportReady')) action = `<button class="m-btn m-btn-ok">Report ready · Open PDF</button><button class="m-btn">Download</button>`
    else if (c.step === 'report') action = `<span class="m-progress${c.nw('report')}"><span class="m-spin"></span>Writing report · findings, changes, receipts<i></i></span>`
    else action = `<button class="m-btn ${done ? 'm-btn-pen' : ''}" ${done ? '' : 'disabled'}>Download report ↓</button>`
    return `<section class="m-verdict${c.r('impact') ? ' has-impact' : ''}${c.anim && c.step === 'impact' ? ' thud' : ''}">
      <div class="m-vlabel"><b>Short answer</b><span class="m-ver ${c.o === 'fallback' ? 'is-warn' : ''}">${label}</span></div>
      ${v2 ? `<div class="m-vswitch"><span${compare ? ' class="on"' : ''}>v1 → v2</span><span${compare ? '' : ' class="on"'}>v2</span></div>` : ''}
      <p class="m-vtext">${body}</p>
      ${c.r('impact') ? `<div class="m-impact${c.nw('impact')}">QUALIFIES<small>impact of 1 purchase</small></div><div class="m-impact-line${c.nw('impact')}">${D.impact.line}</div>` : ''}
      <div class="m-vfoot">${action}${v2 ? '<button class="m-btn">Compare v1 → v2</button>' : ''}<span class="m-hint">${done ? 'PDF keeps these citation numbers' : 'report unlocks when the run ends'}</span></div>
    </section>`
  }

  const PEN = '<svg class="m-pen" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M14 30 C 16 10, 80 3, 120 5 C 170 7, 197 18, 193 33 C 189 51, 120 58, 78 55 C 34 52, 4 44, 9 27 C 13 16, 34 9, 58 8"/></svg>'
  function gapCard(c) {
    if (!c.r('gap')) return ''
    if (c.scnKey === 'open') return `<section class="m-gap is-minor${c.nw('gap')}"><span class="m-gap-k">GAP CHECK</span><p class="m-gap-t">Nothing material left open (12%).</p><span class="m-gap-s">The decision model still prices paywalled sources, in case one is worth it.</span></section>`
    if (c.r('answer2')) return `<section class="m-gap is-closed${c.nw('answer2')}"><span class="m-gap-k">GAP CLOSED</span><p class="m-gap-t"><mark class="m-hl">Grid energisation</mark> is now covered by the Grid Operators Report.</p><span class="m-gap-s">Bought for S$0.80 · new citations 9, 10 and 11</span></section>`
    const sub = c.scnKey === 'zero' && c.r('wouldbuy') ? 'Grid Operators Report (S$0.80) would close it. Your budget is S$0, so nothing was bought.'
      : c.step === 'failed' || c.step === 'retry' ? 'Paid for. Waiting on a verified delivery before the answer can use it.'
        : c.r('pay402') ? 'Buying Grid Operators Report to close it →'
          : c.r('decide') ? 'Pricing 4 paywalled sources that might close it →' : 'Next: a decision model prices sources that could close it.'
    return `<section class="m-gap${c.nw('gap')}"><span class="m-gap-k">OPEN GAP</span><p class="m-gap-t">No accessible evidence on <span class="m-circ">grid energisation${PEN}</span>.</p><span class="m-gap-s">${sub}</span></section>`
  }

  const GLYPH = { c: ['▼', 's-c', 'Challenges'], s: ['▲', 's-s', 'Supports'], u: ['◆', 's-u', 'Uncertain'] }
  function claims(c) {
    if (!c.r('answer1')) return ''
    const v2 = c.r('answer2')
    const list = v2 ? D.claimsV2 : D.claimsV1
    const entering = c.anim && (c.step === 'answer1' || c.step === 'answer2')
    let k = 0
    const li = (cl, gone) => `<li class="m-claim${cl.isNew ? ' is-new' : ''}${gone ? ' is-gone' : ''}${entering ? ' n' : ''}" style="--i:${k++}"><span class="m-sg ${GLYPH[cl.stance][1]}">${GLYPH[cl.stance][0]}</span><span>${cl.isNew ? '<span class="m-new">NEW</span>' : ''}${gone ? '<span class="m-new">REMOVED</span>' : ''}${esc(cl.text)}<span class="m-cite${cl.isNew ? ' is-new' : ''}">${cl.n}</span></span></li>`
    const groups = ['c', 's', 'u'].map(st => {
      const items = list.filter(cl => cl.stance === st)
      if (!items.length) return ''
      return `<div class="m-group"><h4>${GLYPH[st][2]} <em>${items.length}</em></h4><ul>${items.map(cl => li(cl)).join('')}</ul></div>`
    }).join('')
    let tail = ''
    if (v2 && c.o === 'compare') tail = `<div class="m-group"><h4>Removed in v2 <em>3</em></h4><ul>${D.claimsV1.filter(cl => D.removedInV2.includes(cl.n)).map(cl => li(cl, true)).join('')}</ul></div>`
    else if (v2) tail = '<div class="m-dropped">3 claims from v1 were dropped. <u>Compare v1 → v2</u></div>'
    return `<section class="m-claims">${groups}${tail}</section>`
  }

  function brief(c) {
    return `<main class="m-brief${c.nw('takeoff', 'search')}">
      ${c.tw.quiet ? '' : `<div class="m-eyebrow"><span>Question</span><span>·</span><span>Budget ${money(c.budget)}</span><span>·</span><span>asked 10:41</span></div>`}
      <h1 class="m-q">${D.question}</h1>
      ${c.o === 'compare' ? `${verdict(c)}${claims(c)}` : `${c.tw.pills ? pills(c) : strip(c)}${verdict(c)}${gapCard(c)}${claims(c)}`}
    </main>`
  }

  // ---------- wallet column ----------
  function wallet(c) {
    const b = c.budget
    const tag = simTag(c)
    if (b === 0) {
      return `<section class="m-panel m-wallet is-zero"><div class="m-panel-h"><b>Budget for this question</b>${tag || '<span class="mono">free only</span>'}</div>
        <div class="m-amt"><span class="m-odo">S$0.00</span><span class="m-of">nothing can be bought</span></div><div class="m-meter"></div>
        <div class="m-wl"><span>Free sources only · decisions still shown</span></div></section>`
    }
    const reserved = c.r('pay402') && !c.r('settle') ? 0.8 : 0
    const spent = c.r('settle') ? 0.8 : 0
    const left = b - spent - reserved
    const tick = c.anim && (c.step === 'pay402' || c.step === 'settle')
    const odo = c.anim && c.step === 'pay402' ? `<span class="m-odo" data-odo-from="${b}" data-odo-to="${left}">${money(b)}</span>` : `<span class="m-odo">${money(left)}</span>`
    return `<section class="m-panel m-wallet"><div class="m-panel-h"><b>Budget for this question</b>${tag || '<span class="mono">cap S$1.00 / source</span>'}</div>
      <div class="m-amt">${odo}<span class="m-of">left of ${money(b)}</span>${tick ? `<span class="m-delta n">${c.step === 'pay402' ? 'holding S$0.80' : 'settled −S$0.80'}</span>` : ''}</div>
      <div class="m-meter${tick ? ' n' : ''}"><i class="sp" style="width:${spent / b * 100}%"></i><i class="rs" style="width:${reserved / b * 100}%"></i></div>
      <div class="m-wl"><span>spent <em>${money(spent)}</em></span><span>held <em>${money(reserved)}</em></span><span>${tag ? 'cap <em>S$1.00</em> a source' : c.r('done') ? (c.o === 'budgetOut' ? 'too little left for any source' : 'unspent stays unspent') : 'nothing bought below the bar'}</span></div></section>`
  }

  const VERDICT = {
    BUY: ['s-buy', 'BUY'], OVER_CAP: ['s-cap', 'OVER CAP'], LOW_VALUE: ['s-low', 'LOW VALUE'], REWRITE: ['s-rw', 'REWRITE'],
    WOULD: ['s-would', 'WOULD BUY'], BAR: ['s-bar', 'BELOW BAR'], GAP: ['s-gap', 'NO GAP'],
  }
  // T4: once the purchase starts (or the run ends), the round folds to its results.
  function decideFold(c) {
    const k = c.scnKey
    const rows = D.candidates.map((x, i) => {
      let v = x.verdict
      if (k === 'zero' && v === 'BUY') v = 'WOULD'
      if (k === 'open') v = v === 'REWRITE' || v === 'OVER_CAP' ? v : 'BAR'
      const st = VERDICT[v]
      return `<li class="${v === 'BUY' || v === 'WOULD' ? 'is-buy' : ''}" style="--i:${i}"><span class="m-row-n">${x.name}</span><span class="m-price ${x.price > D.cap ? 'is-over' : ''}">${money(x.price)}</span><span class="m-stamp ${st[0]}">${st[1]}</span></li>`
    }).join('')
    const solo = k === 'zero' || k === 'open'
    const r2 = !solo && c.r('round2') ? `<p class="m-fold-note${c.nw('round2')}">Round 2: nothing else clears the bar. ${c.o === 'budgetOut' ? 'S$0.20 is left.' : 'S$1.20 stays unspent.'}</p>` : ''
    return `<section class="m-panel m-decide is-fold${c.nw(solo ? 'done' : 'pay402')}"><div class="m-panel-h"><b>Considered 4 paywalled sources</b><u>Why these?</u></div><ul class="m-mini">${rows}</ul>${r2}</section>`
  }
  function decide(c) {
    if (c.tw.fold && (c.r('pay402') || c.r('done'))) return decideFold(c)
    if (!c.r('decide')) {
      return '<section class="m-panel is-idle"><div class="m-panel-h"><b>What’s worth buying</b></div>A decision model will score the paywalled sources against the gap. Policy code buys only what clears the bar, inside your budget.</section>'
    }
    if (c.r('round2')) {
      const rows = D.candidates.map((x, i) => `<li class="m-row" style="--i:${i};--w:0%;--from:${Math.min(100, x.value / 0.8 * 100)}%"><span class="m-row-n">${x.name}</span><span class="m-bar"><i></i><b class="m-thr"></b></span><span class="m-stamp s-gap">NO GAP</span></li>`).join('')
      return `<section class="m-panel m-decide${c.nw('round2')}"><div class="m-panel-h"><b>Round 2 · anything else?</b><span class="mono">Clef · 0.61 s</span></div>
        <div class="m-r1"><span>Round 1</span><b>Bought Grid Operators Report · S$0.80</b></div>
        <div class="m-gapline"><span>Gap: none left open</span><em>0% material</em></div>
        <ul class="m-rows is-r2 m-r2${c.nw('round2')}">${rows}</ul>
        <p class="m-r2-msg">Nothing clears the bar, so the run stops. ${c.o === 'budgetOut' ? 'S$0.20 is left.' : 'S$1.20 stays unspent.'}</p></section>`
    }
    const k = c.scnKey
    const gm = k === 'open' ? 0.12 : D.gapMaterial
    const stamped = c.r('verdicts') || c.r('wouldbuy') || c.r('nothing')
    const order = stamped ? ['cn', 'nw', 'gs', 'gor'] : ['gor', 'gs', 'nw', 'cn']
    const stampIdx = id => order.indexOf(id)
    const rows = D.candidates.map((x, i) => {
      const value = x.value * gm / D.gapMaterial
      let v = x.verdict
      if (k === 'zero' && v === 'BUY') v = 'WOULD'
      if (k === 'open') v = x.verdict === 'REWRITE' ? 'REWRITE' : x.verdict === 'OVER_CAP' ? 'OVER_CAP' : 'BAR'
      const why = k === 'open' && v === 'BAR' ? `Value ${value.toFixed(2)} is under the 0.20 bar` : k === 'zero' && v === 'WOULD' ? 'Would buy with any budget of S$1 or more' : x.why
      const isBuy = v === 'BUY' || v === 'WOULD'
      const st = VERDICT[v]
      const foot = stamped ? `<span class="m-why">${why}</span><span class="m-stamp ${st[0]}${c.nw('verdicts', 'wouldbuy', 'nothing')}" style="--i:${stampIdx(x.id)}">${st[1]}</span>`
        : `<span class="m-probs">covers ${Math.round(x.addr * 100)}% · original ${Math.round(x.orig * 100)}% · cred ${x.cred.toFixed(1)}</span><span class="m-probs">${value.toFixed(2)}</span>`
      return `<li class="m-row ${stamped ? (isBuy ? 'is-buy' : 'is-dim') : ''}${c.nw('decide')}" style="--i:${i};--w:${Math.min(100, value / 0.8 * 100)}%">
        <span class="m-row-n">${x.name}</span><span class="m-price ${x.price > D.cap ? 'is-over' : ''}">${money(x.price)}</span>
        <span class="m-bar"><i></i><b class="m-thr"></b></span><div class="m-row-f">${foot}</div></li>`
    }).join('')
    return `<section class="m-panel m-decide${c.nw('decide')}"><div class="m-panel-h"><b>Round 1 · what’s worth buying</b><span class="mono">Clef · 0.75 s</span></div>
      <div class="m-gapline"><span>Gap: grid energisation</span><em>${Math.round(gm * 100)}% material</em></div>
      <div class="m-axis"><span style="left:0">0</span><span class="thr" style="left:25%">bar 0.20</span><span style="right:0">value 0.8</span></div>
      <ul class="m-rows">${rows}</ul>
      ${c.r('pay402') || c.r('wouldbuy') || c.r('nothing') ? '' : `<div class="m-formula">value = gap × covers gap × original × (0.5 + 0.25 × credibility)<br>buy the best value per S$ above the bar, at most S$1.00 per source</div>`}</section>`
  }

  function buy(c) {
    const k = c.scnKey
    if (k === 'zero') return c.r('wouldbuy') ? `<section class="m-panel m-buy${c.nw('wouldbuy')}"><div class="m-panel-h"><b>Would buy</b><span class="m-price">S$0.80</span></div><p class="m-note" style="margin:0">Grid Operators Report clears the bar. <b>Your S$0 budget allows no purchases</b>, so nothing was charged. Ask again with S$1 to buy it.</p></section>` : ''
    if (k === 'open') return c.r('nothing') ? `<section class="m-panel m-buy${c.nw('nothing')}"><div class="m-panel-h"><b>Nothing bought</b><span class="mono">S$2.00 unspent</span></div><p class="m-note" style="margin:0">Every paywalled source scored under the 0.20 bar, so the free answer stands.</p></section>` : ''
    if (!c.r('pay402')) return c.r('decide') ? '' : '<section class="m-panel is-idle"><div class="m-panel-h"><b>Purchases</b></div>Each purchase shows 402 → quote → settle → delivery → sha-256 here. One charge per source, even on retry.</section>'
    const short = D.quoteHash.slice(0, 6) + '…' + D.quoteHash.slice(-5)
    if (c.tw.fold && c.r('answer2')) {
      return `<section class="m-panel m-buy is-fold${c.nw('answer2')}"><div class="m-panel-h"><b>Bought · Grid Operators Report</b><span class="m-price">S$0.80</span></div>
        <div class="m-okline">✓ Delivered · sha-256 matches</div><div class="m-rcpt"><span>Receipt ${short}</span><span>charged once <u>View</u></span></div></section>`
    }
    const failed = c.step === 'failed', retry = c.step === 'retry'
    const ok = c.r('verified')
    const nodes = [
      ['402', 'Payment required', 'w402', true],
      ['Quote', 'S$0.80 held', '', true],
      ['Settle', 'simulated', '', c.r('settle')],
      [failed ? '✕' : retry ? '<span class="m-spin"></span>' : '200', failed ? 'delivery failed' : retry ? 'retrying' : 'delivered', failed ? 'wfail' : retry ? 'wspin' : 'wok', ok],
      ['sha-256', 'matches', 'wok', ok],
    ]
    const enterStep = { pay402: [0, 1], settle: [2], verified: [3, 4] }[c.step] || []
    const lis = nodes.map(([lab, sub, cls, on], i) => `<li class="${cls} ${on ? 'on' : ''}${c.anim && enterStep.includes(i) ? ' n' : ''}" style="--i:${enterStep.indexOf(i)}"><i>${lab}</i><span>${sub}</span></li>`).join('')
    const p = ok ? 80 : failed || retry ? 60 : c.r('settle') ? 40 : 20
    const packetTo = { pay402: '30%', settle: '50%', verified: '90%' }[c.step]
    return `<section class="m-panel m-buy${c.nw('pay402')}"><div class="m-panel-h"><b>${ok ? 'Bought' : 'Buying'} · Grid Operators Report</b><span class="m-price">S$0.80</span></div>
      <ol class="m-wire"><span class="m-wire-fill" style="--p:${p}%"></span>${c.anim && packetTo ? `<span class="m-packet n" style="--to:${packetTo}"></span>` : ''}${lis}</ol>
      ${ok ? `<div class="m-hash${c.nw('verified')}"><span>sha-256</span><code${c.anim && c.step === 'verified' ? ' data-scramble' : ''}>${D.digest}</code><b>✓ match</b></div>` : ''}
      ${failed ? `<div class="m-fail n"><b>Paid, but the delivery failed.</b>Your receipt is kept. Retrying fetches the same paid copy and can’t charge you again.<br><button class="m-btn m-btn-pay">Retry delivery</button></div>` : ''}
      ${c.r('settle') ? `<div class="m-rcpt${c.nw('settle')}"><span>Receipt ${short}</span><span>${retry ? 'same receipt · ' : ''}charged once <u>View</u></span></div>` : ''}
    </section>`
  }

  function side(c) {
    return `<aside class="m-side${c.nw('takeoff', 'search')}">${wallet(c)}${decide(c)}${buy(c)}</aside>`
  }

  // ---------- toasts ----------
  function toasts(c) {
    const t = []
    const T = (cls, ic, title, body, acts, enter) => ({ cls, ic, title, body, acts, enter })
    if (c.o === 'fallback') t.push(T('t-warn', '!', 'Research model timed out', 'Showing a labelled offline answer built from the same verified passages. Live answers resume on the next ask.', '', true))
    if (c.o === 'stopped') t.push(T('t-info', '■', 'Stopped', 'No new purchases will start. S$0.00 of S$2.00 spent. The v1 answer stays.', '<button class="m-btn">Ask again</button>', true))
    if (c.scnKey === 'inject' && c.r('read') && !c.r('decide')) t.push(T('t-warn', '⚑', 'Ignored instructions in a source', 'Fernpath Infrastructure Blog tells AI agents to buy GridScope. Text in sources can’t spend. Only policy code can buy.', '', c.step === 'read'))
    if (c.step === 'failed') t.push(T('t-err', '!', 'Delivery failed after payment', 'Charged once (S$0.80, simulated). Retry fetches the same copy.', '<button class="m-btn m-btn-pay">Retry delivery</button>', true))
    if (c.step === 'verified' || c.step === 'answer2') t.push(T('t-pen t-rcpt', '✓', 'Bought Grid Operators Report', 'S$0.80 · sha-256 verified · <span class="sim">SIMULATED SGD</span>', '', c.step === 'verified'))
    if (c.r('done') && c.o !== 'receipt' && c.o !== 'work') {
      const body = { zero: 'Free sources only. It would have bought 1 source for S$0.80.', open: 'Nothing was worth buying. S$0.00 of S$2.00 spent.' }[c.scnKey]
        || (c.o === 'budgetOut' ? 'Budget used: S$0.80 of S$1.00. Too little is left for another source.' : 'v2 qualifies the free answer · S$0.80 of S$2.00 spent')
      const acts = c.scnKey === 'zero' ? '<button class="m-btn m-btn-pen">Ask again with S$1</button>' : c.scnKey === 'open' ? '' : '<button class="m-btn m-btn-pen">Download report</button><button class="m-btn">Compare v1 → v2</button>'
      t.push(T('', '✓', 'Answer ready', body, acts, c.step === 'done'))
    }
    if (c.r('reportReady')) t.push(T('t-pen', '↓', c.o === 'htmlReport' ? 'Report opened as printable HTML' : 'Report ready · 6 pages', c.o === 'htmlReport' ? 'The PDF engine wasn’t available. Use your browser’s Print to save a PDF.' : 'Findings, what the purchase changed, open questions, receipts.', c.o === 'htmlReport' ? '<button class="m-btn">Open again</button>' : '<button class="m-btn m-btn-pen">Open PDF</button><button class="m-btn">Download</button>', c.step === 'reportReady'))
    if (!t.length) return ''
    const shown = t.slice(-3)
    return `<div class="m-toasts">${shown.map((x, i) => {
      const k = shown.length - 1 - i
      return `<div class="m-toast ${x.cls}${c.anim && x.enter && k === 0 ? ' n' : ''}" style="--k:${k};z-index:${10 - k}"><div class="m-t-ic">${x.ic}</div><div class="m-t-b"><b>${x.title}</b><p>${x.body}</p>${x.acts && k === 0 ? `<div class="m-t-acts">${x.acts}</div>` : ''}</div><span class="m-t-x">×</span></div>`
    }).join('')}</div>`
  }

  // ---------- overlays ----------
  function overlay(c) {
    const o = c.o
    if (o === 'passage' || o === 'locked') {
      const locked = o === 'locked'
      const body = locked
        ? `<p>Fictional demo source. Independent operator interviews and site planning records investigating energisation prerequisites and connection schedules.</p>
           <div class="m-locked"><i style="width:94%"></i><i style="width:88%"></i><i style="width:91%"></i><i style="width:60%"></i>
           <p><b>Not bought.</b> S$1.40 is over the S$1.00 per-source cap. The full text stays with the publisher until a purchase is verified for this run. These bars are placeholders, not the article.</p></div>`
        : D.passage.map(p => p.startsWith('§') ? `<p class="is-span"><mark class="m-hl">${p.slice(1)}</mark></p>` : `<p>${p}</p>`).join('')
      return `<div class="m-scrim${c.anim ? ' n' : ''}"></div><aside class="m-drawer${c.anim ? ' n' : ''}">
        <div class="m-dr-h"><div class="m-dr-top"><span>${locked ? 'PUBLIC PREVIEW' : 'EXACT PASSAGE · CITATION 9'}</span><span>Esc ×</span></div>
          <h3>${locked ? 'GridScope Asia: connection schedule investigation' : 'Grid Operators Report: capacity and energisation audit'}</h3>
          <div class="m-dr-chips">${locked ? '<span class="m-chip">grid-research · v1</span><span class="m-chip" style="color:var(--pay-ink)">S$1.40 · over cap</span>' : '<span class="m-chip">grid-research · v1</span><span class="m-chip" style="color:var(--pen)">bought S$0.80</span><span class="m-chip"><i></i>sha-256 b11dd6…a980c3</span>'}</div></div>
        <div class="m-dr-b">${body}</div>
        <div class="m-dr-f"><span>${locked ? 'Judged on public metadata and preview only' : 'Cited in: short answer, claim 9'}</span><span>synthetic corpus</span></div></aside>`
    }
    if (o === 'hover') {
      return `<div class="m-hover${c.anim ? ' n' : ''}" data-anchor style="left:548px;top:404px"><div class="m-hover-h"><span class="m-mono">GO</span>Grid Operators Report <span class="m-chip" style="margin-left:auto;color:var(--pen)">bought S$0.80</span></div>
        <q>“<mark class="m-hl">Only 240 of the announced 600 MW has a confirmed energisation slot before 2028.</mark>”</q>
        <div class="m-hover-f"><span>Capacity and energisation audit · v1</span><span>Click to open ↗</span></div></div>`
    }
    if (o === 'receipt') {
      return `<div class="m-scrim${c.anim ? ' n' : ''}"></div><div class="m-receipt${c.anim ? ' n' : ''}"><h5>RECEIPT</h5><div class="sub">ResearchAgent · run b5390658</div>
        <dl><dt>Item</dt><dd>Capacity and energisation audit</dd><dt>Publisher</dt><dd>Grid Operators Report</dd><dt>Quote</dt><dd>${D.quoteHash.slice(0, 10)}…</dd><dt>Settled</dt><dd>10:41:06 · simulated</dd><dt>Delivered</dt><dd>sha-256 ${D.digest.slice(0, 8)}… ✓</dd><dt>Charges</dt><dd>1 (retries can’t add more)</dd></dl>
        <div class="tot"><span>Total</span><span>S$0.80</span></div><div class="sim">SIMULATED SGD · NO REAL FUNDS</div></div>`
    }
    if (o === 'work') {
      const rows = D.trace.map(([t, type, label]) => {
        const cls = type === 'WIRE' ? 'w' : type === 'GRANT' ? 'g' : type === 'BUY' || type === 'PURCHASE' ? 'b' : ''
        return `<li><time>+${t.toFixed(1)} s</time><span class="tag ${cls}">${type}</span><span>${esc(label).replace('→ 402', '→ <b class="s402">402</b>')}</span></li>`
      }).join('')
      return `<div class="m-scrim${c.anim ? ' n' : ''}" style="top:56px"></div><section class="m-sheet${c.anim ? ' n' : ''}"><div class="m-sheet-h"><b>Show work</b><div class="m-seg"><span class="on">Trace</span><span>Wire</span><span>Policy</span><span>Receipts</span>${c.tw.quiet ? '<span>Models</span>' : ''}</div><span class="m-note" style="margin-left:auto">Raw, persisted events · nothing here is needed to understand the answer</span><span class="m-tab-x">Esc ×</span></div><ol class="m-log">${rows}</ol></section>`
    }
    if (o === 'presenter') {
      return `<div class="m-presenter${c.anim ? ' n' : ''}"><h5>Presenter <kbd>.</kbd></h5>
        <div class="m-pr-row"><label>Pace</label><div class="m-seg"><span>Real</span><span class="on">Stage 1×</span><span>Stage 0.5×</span></div></div>
        <div class="m-pr-row"><div class="m-toggle"><label>Fail next paid delivery</label><span class="m-switch on"></span></div></div>
        <div class="m-pr-row"><label>Corpus variant (restart)</label><code>CORPUS_VARIANT=open-sufficient npm run demo</code></div>
        <div class="m-pr-row" style="padding-bottom:0"><button class="m-btn">Reset demo data</button></div></div>`
    }
    return ''
  }

  // ---------- whole screens ----------
  function home(c) {
    const v = c.variant
    const zero = v === 'zero', err = v === 'err'
    const coin = val => `<span class="m-coin ${(zero ? 0 : 2) === val ? 'on' : ''}">S$${val}</span>`
    const consq = zero ? '<b>Free sources only.</b>You’ll still see what it would have bought.' : '<b>Up to S$2.00, at most S$1.00 per source.</b>It buys only sources that clear the bar.'
    const live = c.anim && c.step === 'home'
    const nav = c.tw.nav
    return `<div class="m-app">${top(c, false)}${c.tw.simbar ? SIMBAR : ''}${nav ? `<div class="m-homews${nav === 'rail' ? ' is-rail' : ''}">${sidebar(c, true)}` : ''}<div class="m-home${live ? ' n' : ''}${c.step === 'takeoff' && c.anim ? ' is-takeoff' : ''}">
      <h1 class="m-hero">Ask a question.<br><em>Give it a budget.</em></h1>
      <p class="m-hero-sub">It reads free sources first, then pays only for evidence worth the price.</p>
      <div class="m-composer"><div class="m-qbox ${err ? 'is-empty' : ''}">${err ? 'Ask about a company, a market or a claim…' : D.question}${live || err ? '<span class="caret"></span>' : ''}</div>
        <div class="m-comp-row"><div class="m-coins">${[0, 1, 2, 5].map(coin).join('')}</div><p class="m-consq">${consq}</p>
        <button class="m-ask ${c.step === 'takeoff' ? 'is-busy' : ''}" ${err ? 'disabled' : ''}>${c.step === 'takeoff' ? '<span class="m-spin"></span>Starting' : zero ? 'Ask free' : 'Ask'} <kbd style="font:500 11px var(--f-mono);opacity:.75">↵</kbd></button></div>
        <div class="m-comp-foot">${err ? '<span class="m-err">Type a question first. Up to 2,000 characters.</span>' : `<span>A run takes about 10 seconds. ${simTag(c, true)}</span>`}<span class="m-check on"><i></i>Tell me when it’s done</span></div></div>
      <div class="m-try"><span>Try</span><span>Vertex 600 MW by 2028?</span><span>A question free sources can answer</span><span>An article that tells agents to buy</span></div>
      ${v === 'returning' ? '<div class="m-recent"><span class="k">Last run</span><b>Vertex 600 MW by 2028?</b><span class="m-chip">v2 · qualifies</span><span class="mono" style="font-size:12px">S$0.80 of S$2.00</span><button class="m-btn">Open</button></div>' : ''}
      <div class="m-how">
        <div style="--i:0"><span class="ic ic-read">Aa</span><b>An LLM writes</b><p>Reads free sources and drafts a cited answer that names its gap.</p></div>
        <div style="--i:1"><span class="ic ic-bars"><i style="height:40%"></i><i style="height:90%"></i><i style="height:25%"></i><i style="height:60%"></i></span><b>A decision model chooses</b><p>Scores each paywalled source: does it close the gap, is it original, is it credible.</p></div>
        <div style="--i:2"><span class="ic">${mark()}</span><b>Code pays</b><p>Buys the best value per S$ inside your budget. Text in an article can’t spend.</p></div>
      </div>${live ? ICON.cursor : ''}</div>${nav ? '</div>' : ''}
      ${v === 'returning' ? '<span class="m-later">LATER · needs run history</span>' : ''}
      ${c.o === 'presenter' ? overlay(c) : ''}</div>`
  }

  function app(c) {
    if (c.view === 'launch') return `<div class="m-app"><div class="m-launch">${mark()}<span>ResearchAgent</span></div></div>`
    if (c.view === 'signin') return `<div class="m-app">${top(c, false)}<div class="m-signin"><div class="m-signin-card">${mark()}<h3>Sign in to ResearchAgent</h3><div class="m-field">you@company.com</div><button class="m-btn m-btn-pen" style="height:46px">Continue</button><span class="m-note" style="text-align:center">or <u>use the demo workspace</u></span></div></div><span class="m-later">LATER · accounts are out of scope for Oct 10</span></div>`
    if (c.view === 'osnote') return `<div class="m-app"><div class="m-otherpage"><i></i><i></i><i style="width:90%"></i><i style="width:70%"></i><i></i><i style="width:84%"></i></div>
      <div class="m-osnote${c.anim ? ' n' : ''}">${appIcon(38)}<div><b>Answer ready · Vertex 600 MW by 2028?</b><p>Only partly: 240 of 600 MW has a grid slot before 2028. Spent S$0.80 of S$2.00 (simulated).</p></div><time>now</time></div></div>`
    if (c.view === 'tabstates') {
      const row = (f, t, d) => `<div class="row"><div class="m-tab is-on"><span class="m-fav ${f ? 'f-' + f : ''}">${mark()}</span><span class="m-tab-t">${t}</span></div><p>${d}</p></div>`
      return `<div class="m-app"><div class="m-tabstates"><h3>The tab says what the run is doing.</h3>
        ${row('', 'ResearchAgent', '<b>Idle.</b> Home, or a finished run you’ve already seen.')}
        ${row('work', 'Reading sources · ResearchAgent', '<b>Working.</b> The coin in the icon flips. The title names the current step.')}
        ${row('work', 'Buying S$0.80 · ResearchAgent', '<b>Spending.</b> Any money step names the amount.')}
        ${row('done', '✓ Answer ready · ResearchAgent', '<b>Done, unseen.</b> Green dot until you come back to the tab.')}
        ${row('alert', '! Delivery failed · ResearchAgent', '<b>Needs you.</b> Orange dot until the retry succeeds.')}
      </div></div>`
    }
    if (c.step === 'home' || (c.step === 'takeoff' && c.anim)) return home(c)
    const tw = c.tw
    const left = tw.nav ? sidebar(c) : tw.bar ? '' : rail(c)
    const cls = (tw.nav ? ' has-nav' + (tw.nav === 'rail' ? ' nav-rail' : '') : tw.bar ? ' cols-2' : '') + (tw.bar ? ' has-bar' : '')
    return `<div class="m-app${tw.bar ? ' has-bar' : ''}">${top(c, true)}${tw.simbar ? SIMBAR : ''}<div class="m-ws${cls}">${left}${brief(c)}${side(c)}${tw.bar ? runbar(c) : ''}</div>${toasts(c)}${overlay(c)}</div>`
  }

  function html(spec) {
    const c = ctx(spec)
    return `<div class="m-browser${c.anim ? ' m-anim' : ''}">${chrome(c)}${app(c)}</div>`
  }

  // ---------- mounting + live effects ----------
  const fits = new Set()
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(entries => entries.forEach(e => scale(e.target))) : null
  function scale(fit) { const b = fit.firstElementChild; if (b) b.style.setProperty('--k', fit.clientWidth / 1440) }
  function mount(fit, spec) {
    fit._spec = spec
    fit.innerHTML = html(spec)
    scale(fit)
    anchor(fit)
    if (ro && !fits.has(fit)) { ro.observe(fit); fits.add(fit) }
    if (spec.animate) effects(fit)
  }
  // Place the citation preview under its chip (layout px, so the frame's scale doesn't matter).
  function anchor(fit) {
    const card = fit.querySelector('.m-hover[data-anchor]'), chip = fit.querySelector('.m-cite.is-hover'), app = fit.querySelector('.m-app')
    if (!card || !chip || !app) return
    let x = 0, y = 0, el = chip
    while (el && el !== app) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent }
    if (el !== app) return
    card.style.left = Math.max(12, x - 30) + 'px'
    card.style.top = y + chip.offsetHeight + 12 + 'px'
  }
  // Page-wide default for mocks whose spec has no tw of its own. Redraws them without replaying motion.
  function setTweaks(tw) {
    DEF = tw || {}
    fits.forEach(f => { if (!f.isConnected) return fits.delete(f); if (f._spec && !f._spec.tw) mount(f, Object.assign({}, f._spec, { animate: false })) })
  }
  function reduced() { return document.body.classList.contains('rm') || matchMedia('(prefers-reduced-motion: reduce)').matches }
  function effects(root) {
    if (reduced()) return
    root.querySelectorAll('[data-odo-from]').forEach(el => {
      const from = +el.dataset.odoFrom, to = +el.dataset.odoTo, t0 = performance.now() + 250
      const step = now => {
        const p = Math.max(0, Math.min(1, (now - t0) / 900))
        const e = 1 - Math.pow(1 - p, 3)
        el.textContent = money(from + (to - from) * e)
        if (p < 1 && el.isConnected) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
    root.querySelectorAll('[data-scramble]').forEach(el => {
      const final = el.textContent, hex = '0123456789abcdef', t0 = performance.now() + 900
      const step = now => {
        const p = Math.max(0, Math.min(1, (now - t0) / 900))
        const lock = Math.floor(final.length * p)
        el.textContent = final.slice(0, lock) + Array.from({ length: final.length - lock }, () => hex[Math.floor(Math.random() * 16)]).join('')
        if (p < 1 && el.isConnected) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    })
  }

  window.Mock = { html, mount, setTweaks, SCN, STEP, mark, appIcon, ctx, parts: { wallet, decide, buy, toasts, strip, pills, runbar, verdict, gapCard }, effects, money }
})()
