/* Shipped and Review tabs: real screenshots, the stage script, the ranked list and the
   alternatives. Frames are drawn by mock.js with { ship: 1 }; custom blocks are plain HTML. */
(function () {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const M = window.Mock
  const store = { get(k) { try { return localStorage.getItem(k) } catch { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch { /* private mode */ } } }
  const attr = o => JSON.stringify(o).replace(/'/g, '&#39;')
  const BASE = { ship: 1, quiet: 1, nav: 'open', bar: 1, fold: 1, pills: 1 }

  // ---------- real screenshots ----------
  const SHOTS = [
    ['01-home', 'Home', 'Budget chip, the info dot, four demo questions in rows. Clean.'],
    ['02-clarify', 'Clarify card', 'About 5 s after Ask. It waits for a click or Skip, and pushes the box down.'],
    ['03-plan', 'Plan card', 'The 5 s plan before any spending: Edit, Cancel, Go now. The smallest card on the screen.'],
    ['04-reading', 'Reading free sources', 'Skeleton lines and “Searching…”. Nothing else moves.'],
    ['05-answer-v1', 'Free answer and the gap', 'Short answer, “1 of 2 answered”, the open gap, then claims.'],
    ['06-decision', 'Worth buying', 'Twelve rows at 11 px, one bar filling. The moment the decision model earns its place, and the hardest to read.'],
    ['07-paid', 'Paid, checking delivery', 'The budget counts down to S$1.10. The list has already collapsed to a flat list.'],
    ['08-proof', 'Proof check', '“Proof verified · 14 claims recomputed”. The bar names it; the nine segments do not.'],
    ['09-rewriting', 'Rewriting', 'The v2 answer blurs in with a yellow highlight over the whole sentence.'],
    ['10-done', 'Done', 'v2 headline repeats v1’s sentence; the “Gap closed” card splices the old gap onto “is now covered by”.'],
    ['11-receipt', 'Receipt', 'The best proof object: invoice, ledger link, “Charges 1”, striped “XRPL TESTNET · no real value”.'],
    ['12-showwork', 'Show work', 'A half-height sheet over the page, with raw event names.'],
    ['13-writers', 'Writers', 'The trust columns run off the right edge. “claimed 0.96” has no explanation.'],
  ]
  $('#shShots').innerHTML = SHOTS.map(([f, t, c]) => `<figure><button type="button" data-rimg="shipped/${f}.jpg" data-rlab="${t}" aria-label="Open screenshot: ${t}"><img src="shipped/${f}.jpg" alt="" loading="lazy"></button><figcaption><b>${t}</b>${c}</figcaption></figure>`).join('')
  const lb = $('#lightbox')
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-rimg]'); if (!b) return
    $('#lbCode').textContent = 'Shipped'
    $('#lbTitle').textContent = b.dataset.rlab
    $('#lbPlay').hidden = true
    $('#lbBody').innerHTML = `<img src="${b.dataset.rimg}" alt="${b.dataset.rlab}">`
    lb.showModal()
  })

  // ---------- script ----------
  const SCRIPT = [
    ['0:00', 'LLMs write, a decision model chooses, code pays. You give it a budget and that is the only thing that can spend.', 'Nothing yet. Stand next to the screen.'],
    ['0:30', 'Before the real demo: shout me a question. This is live, no replay.', 'Type it into the box. Hit Ask.'],
    ['1:00', 'It shows me its plan and gives me five seconds to cancel before it can spend a cent.', 'The plan card. (With a bigger card, R4.)'],
    ['1:20', 'It has nothing in its corpus about that, so it says so and spends S$0.00. It refuses to invent.', 'The open gap and the budget. Not the short answer.'],
    ['1:50', 'Now the real one. A S$2 budget is the only authority it has. The model cannot raise it.', 'Press N, click the box, click “Kestrel–TSMC outlook”, Ask.'],
    ['2:20', 'Free sources first. It finds the deal terms and names what it still does not know: analyst views.', 'The short answer, then the OPEN GAP card.'],
    ['2:50', 'A decision model scores every paywalled article against that gap. One clears the bar, an op-ed and a rewrite do not.', 'The “Worth buying” card, while the bar fills. Say it fast: it folds in 3 s.'],
    ['3:20', 'Plain code pays the writer over x402 on XRPL Testnet. Watch the number.', 'The big budget figure: S$2.00 → S$1.10.'],
    ['3:50', 'It checks the writer’s promise against what arrived, recomputes the claims, and only then reads the article.', '“Proof verified · 14 claims recomputed” in the bar.'],
    ['4:20', 'The answer changes: margins are being cut, not demand.', 'The yellow v2 headline, “Qualifies the free answer”, Compare v1 → v2.'],
    ['4:50', 'That is the receipt: one charge, a ledger transaction, labelled Testnet.', 'View receipt. Close it.'],
    ['5:30', 'Now a writer who games the system. Same question style, same budget.', 'N, “Malaysia packaging lead times”, Ask.'],
    ['6:15', 'AlphaLeak claims high relevance and is cheap, so round one buys it. Its proof fails. It is challenged and refunds on-chain.', 'The red “Proof failed”, then “Refunded S$0.30”. Say aloud: “its track record falls from 0.8 to 0.4”. The screen will not.'],
    ['7:15', 'Round two: AlphaLeak is blocked and the honest writer is bought instead.', 'The BLOCKED row (scroll the rail). The yellow v2.'],
    ['8:00', 'Ask again. AlphaLeak is never bought.', 'N, same question. BLOCKED at about 20 s.'],
    ['8:45', 'If you want to see how it decided: every article, every probability, nothing hidden.', 'W → Policy. Skip Wire.'],
    ['9:30', 'LLMs write, a decision model chooses, code pays. Questions?', 'Close. Keep Show work → Policy and the Q&A pack ready.'],
  ]
  $('#rvScript').innerHTML = '<div class="head"><span>Time</span><span>Say</span><span>Point at</span></div>' + SCRIPT.map(([t, s, p]) => `<div><span class="tm">${t}</span><span class="say">${s}</span><span class="pt"><b>Point at</b>${p}</span></div>`).join('')
    + '<div class="head"><span>If it goes wrong</span><span></span><span></span></div>'
    + [['Slow', 'The buying decision is a real model call. Give it a moment.', 'Say it once. Do not press Stop.'], ['Run over 75 s', 'Here is one I ran earlier.', 'N, then open the finished run in the sidebar.'], ['A fallback chip', 'That is the labelled fallback. It says so on screen.', 'Point at the chip. Say what it replaced.'], ['A weird random answer', 'It does not make things up. Look at the gap.', 'The OPEN GAP and S$0.00.']].map(([t, s, p]) => `<div><span class="tm">${t}</span><span class="say">${s}</span><span class="pt">${p}</span></div>`).join('')

  // ---------- ranked list ----------
  const LIST = [
    ['1', 'Put the bought fact in the v2 headline, and answer every requested fact', 'Short-answer card, research prompt', 'S', 'Bug. v2 can repeat v1; the margin cut sits under CHALLENGES. See R3.'],
    ['2', 'Fix the “Gap closed” sentence', 'Answer.tsx gap card', 'XS', 'Bug. The old gap text is spliced onto “is now covered by”. Use a short noun phrase.'],
    ['3', 'Decision list: article titles, bars and stamps stay; a writer once per row', 'DecisionPanel.tsx, WriterChip.tsx', 'S', 'Drop the “T 0.80” chip from rows. See R2.'],
    ['4', 'Name the phases on the run bar: Read, Decide, Buy, Check', 'Run bar', 'S', 'Nine unlabeled segments say nothing from the back. See R1.'],
    ['5', 'Plan card: bigger, labelled “starts in 5 s”, shows the budget', 'ActionModal.tsx', 'S', 'It is the proof that nothing spends unconfirmed. See R4.'],
    ['6', 'Clarify card: auto-skip after 3 s, or set clarify=never in the Presenter menu', 'Ask.tsx, Presenter.tsx', 'XS', 'Up to 26 s of dead air. See R5. The menu option exists today.'],
    ['7', 'Say “simulated” in words, on the money', 'InfoDot.tsx, Budget.tsx, Ask.tsx', 'XS', 'Gate 5. Re-run the v1.1 AB3 test on the info dot first. See R6.'],
    ['8', 'The UC3 beats: refund banner, “track record 0.80 → 0.40”, BLOCKED banner, net spent', 'Purchase.tsx, Budget.tsx, DecisionPanel.tsx', 'M', 'The caught-and-refunded story is carried by nine-pixel text. See R7.'],
    ['9', 'Writers tab: name, trust bar, status; fit at 1280', 'ReputationPanel.tsx', 'S', 'Columns H, C and T run off the screen. See R8.'],
    ['10', 'Stop: say what it can no longer stop', 'Run bar, status copy', 'S', 'Behaviour is safe. Words are not: “stopped by you” beside a paid, unused article. Keep Stop visible in every phase.'],
    ['11', 'Stale “Answer ready · Go back to chat” toasts', 'Toasts.tsx', 'XS', 'Suppress for the run just left; dismiss in 4 s.'],
    ['12', 'Stage pace: the interim text contradicts the server', 'App.tsx replay', 'S', '“Nothing paywalled was worth buying” shows for ~10 s after a purchase.'],
    ['13', 'UC4 wording: “found free on a focused search” after a paid purchase', 'Requested-facts line', 'XS', 'And confirm what UC4 should spend.'],
    ['14', 'N focuses the box; show a “.” hint for the Presenter menu', 'App.tsx, Ask.tsx', 'XS', 'Typing after N is silently lost.'],
    ['15', 'An out-of-scope line for questions no writer covers', 'Scope step, Answer.tsx', 'M', 'The random prompt gets a confident, irrelevant answer today.'],
    ['16', 'Show work: full height, readable verdicts, a “Pay · code” row under Models', 'ShowWork.tsx', 'S', 'SKIP_LOW_TRUST and “Credibility 0.99 / 2” are engine words. Wire layout overlaps.'],
    ['17', 'Budget popover: a click on “Free” fell through to the rows beneath', 'BudgetPopover.tsx', 'XS', 'Seen once, with scripted clicks. Check by hand first.'],
  ]
  $('#rvList').innerHTML = '<thead><tr><th>#</th><th>Change</th><th>Touches</th><th>Size</th><th>Why</th></tr></thead><tbody>' + LIST.map(([n, t, f, sz, w]) => `<tr><td>${n}</td><td><b>${t}</b></td><td><code>${f}</code></td><td class="sz">${sz}</td><td>${w}</td></tr>`).join('') + '</tbody>'

  // ---------- alternatives ----------
  const frames3 = steps => steps.map(([step, lab, overlay, crop]) => ({ step, lab, overlay, crop }))
  const stage = html => `<div class="stage">${html}</div>`
  const refund = {
    A: stage('<div class="rf rf-small"><b>Proof failed · AlphaLeak</b> ✗ claim failed<span class="t">Refunded S$0.30 · tx A23F20…2918E · XRPL TESTNET</span></div>'),
    B: stage('<div class="rf rf-banner"><span class="ic">✗</span><div><b>AlphaLeak failed its proof.</b><span>Challenged · refunded on XRPL Testnet · track record 0.80 → 0.40</span></div><span class="amt">+S$0.30</span></div>'),
    C: stage('<div class="rf rf-chain"><div><small>Paid</small><b>S$0.30</b><span>AlphaLeak</span></div><div class="bad"><small>Proof</small><b>failed</b><span>claim “lead-times-dated”</span></div><div class="good"><small>Refunded</small><b>S$0.30</b><span>on-chain · tx A23F…918E</span></div><div><small>Net spent</small><b>S$0.00</b><span>of S$2.00</span></div></div>'),
  }
  const writersB = stage(`<table class="wr"><thead><tr><th>Writer</th><th>Track record</th><th></th><th>Status</th></tr></thead><tbody>
    <tr><td>NotFinancialTimes</td><td><span class="tb"><i style="width:80%"></i></span></td><td class="raw">0.80</td><td><span class="pill ok">Trusted</span></td></tr>
    <tr class="bad"><td>AlphaLeak</td><td><span class="tb"><i style="width:40%"></i></span></td><td class="raw">0.80 → 0.40</td><td><span class="pill q">Blocked · failed a proof</span></td></tr>
    <tr><td>The Fab Floor</td><td><span class="tb"><i style="width:80%"></i></span></td><td class="raw">0.80</td><td><span class="pill ok">Trusted</span></td></tr>
    <tr><td>Kopi Contrarian</td><td><span class="tb"><i style="width:80%"></i></span></td><td class="raw">0.80</td><td><span class="pill n">Opinion</span></td></tr></tbody></table>`)
  const ALTS = [
    { id: 'R1', anchor: 'rv-seg', q: 'Progress along the bottom', why: 'The merged bar has nine unlabeled segments. The room cannot tell reading from buying without reading the small text beside it.',
      opts: [['A', 'Nine unlabeled segments (as shipped)', {}], ['B', 'Four named phases: Read, Decide, Buy, Check', { seg: 'phases' }], ['C', 'Ten named steps (the v1.1 proposal)', { seg: 'labeled' }]],
      mode: 'stack', crop: [232, 822, 1208, 78], frames: frames3([['read', 'Reading'], ['pay402', 'Buying'], ['done', 'Done']]), rec: 'B',
      task: 'On each frame: “What is it doing right now?”', measure: 'Right answers and seconds, from 3 m away.', rule: 'Ship B unless C is clearly faster; A only if nobody notices the difference.' },
    { id: 'R2', anchor: 'rv-dec', q: 'The decision list after the purchase', why: 'A flat list of twelve publisher names reads as a bug (a writer appears three times). The audience wants to know why this one was bought and not that one.',
      opts: [['A', 'Flat list of 12 publishers (as shipped)', {}], ['B', 'Titles and bars stay, four rows and “+ 8 more”', { dec: 'frozen' }], ['C', 'One Bought card, then Skipped with a reason each', { dec: 'cards' }]],
      crop: [1030, 84, 400, 740], frames: frames3([['done', 'After the purchase']]), rec: 'C',
      task: '“Why did it buy NotFinancialTimes and not MarketPulse Digest?”', measure: 'A correct answer within 20 s, without opening “Why these?”.', rule: 'Ship C if 4 of 5 answer correctly. Fall back to B if people miss the reasons.' },
    { id: 'R3', anchor: 'rv-hl', q: 'What the v2 headline says', why: 'On the live run v2’s headline was v1’s sentence, highlighted yellow as if new, and the margin cut sat under CHALLENGES. The payoff of the whole demo is not on the card.',
      opts: [['A', 'v1’s sentence again, whole sentence highlighted (as shipped)', {}], ['B', 'Headline says what was bought', { hl: 'bought' }], ['C', 'B, plus “Added by the purchase” chips with the old values', { hl: 'diff' }]],
      mode: 'stack', crop: [250, 196, 790, 400], frames: frames3([['done', 'The finished answer']]), rec: 'C',
      task: '“What did paying S$0.90 change?”', measure: 'Whether they name the margin cut without scrolling.', rule: 'Ship C. If it feels busy, B.' },
    { id: 'R4', anchor: 'rv-plan', q: 'The five-second plan card', why: 'This is the only moment before spending where the user can say no, and it is the smallest card on the screen. It also never mentions the budget.',
      opts: [['A', 'One line with a thin bar (as shipped)', {}], ['B', 'A card: “Plan · starts in 5 s”, three steps, the budget', { plan: 'big' }], ['C', 'A countdown strip: “Starting in 5 s. Nothing is spent yet.”', { plan: 'strip' }]],
      mode: 'stack', crop: [440, 150, 790, 400], frames: frames3([['home', 'Plan card', 'plan']]), rec: 'B',
      task: '“How long until it can spend money? How much? Can you stop it?”', measure: 'Three right answers from 3 m away.', rule: 'Ship B. C if the room should feel the countdown more than read the plan.' },
    { id: 'R5', anchor: 'rv-clar', q: 'The clarify card', why: 'It waits for a click, pushes the composer down about 60 px, and in one run held the demo for 26 s before anything else could start.',
      opts: [['A', 'Waits for a click or Skip (as shipped)', {}], ['B', 'Skips itself after 3 s, with a visible countdown', { clar: 'auto' }]],
      crop: [600, 160, 480, 360], frames: frames3([['home', 'Clarify card', 'clarify']]), rec: 'B',
      task: 'Ask the demo question and say nothing.', measure: 'Seconds from Ask to the plan card.', rule: 'Ship B. For the stage, also set clarify=never in the Presenter menu.' },
    { id: 'R6', anchor: 'rv-sim', q: 'Where “simulated” is said', why: 'Hard gate 5 labels everything simulated. Today it is a yellow “i” that opens a note on click, and the popover can open behind the Bought card. v1.1 AB3 required five of five viewers to say “no real money”.',
      opts: [['A', 'A yellow “i” beside the budget (as shipped)', {}], ['B', 'A visible label next to the money: “SIMULATED S$ · XRPL Testnet”', { sim: 'label' }]],
      frames: frames3([['home', 'Home: next to the box', '', [470, 255, 760, 200]], ['done', 'The budget card', '', [1030, 96, 400, 305]]]), rec: 'B',
      task: 'After the run, with the screen still up: “Did this spend real money?”', measure: 'Everyone has to say no.', rule: 'Ship A only if 5 of 5 say no. One miss and B ships.' },
    { id: 'R7', anchor: 'rv-ref', q: 'The refund beat in UC3', why: 'The caught-and-refunded story is one red card and a green line at about 11 px, and the budget stays at S$1.70 as if nothing came back. Trust 0.8 → 0.4 is never shown.',
      custom: refund, mode: 'stack', opts: [['A', 'A small red card (roughly as shipped)'], ['B', 'A full-width banner for about 4 s'], ['C', 'A chain that stays: Paid → Proof failed → Refunded → Net spent']], rec: 'B',
      task: 'After the beat: “What happened to the S$0.30? What happened to AlphaLeak?”', measure: 'Both answered from 3 m away.', rule: 'Ship B for the moment and C as the card that stays. A only if the room already gets it.' },
    { id: 'R8', anchor: 'rv-wr', q: 'The Writers tab', why: 'The trust columns (H, C, T) run off the right edge at 1440 and 1280, and “claimed 0.96” has no meaning to someone who has not read the manifesto.',
      mode: 'stack', custom: { A: stage('<img src="shipped/13-writers.jpg" alt="The Writers tab as shipped" style="display:block;width:100%">'), B: writersB }, opts: [['A', 'Proofs, challenges, relevance and trust columns (as shipped)'], ['B', 'Name, track-record bar, one status pill']], rec: 'B',
      task: '“Which writer would you not buy from, and why?”', measure: 'Seconds to answer.', rule: 'Ship B. Keep the raw columns in Show work.' },
  ]
  let votes = {}
  try { votes = JSON.parse(store.get('ra-rv') || '{}') || {} } catch { votes = {} }
  const save = () => store.set('ra-rv', JSON.stringify(votes))
  const frame = (t, v, i, f, delta) => {
    const spec = Object.assign({ scn: 'story', step: f.step, tw: Object.assign({}, BASE, { ship: 1 }, delta) }, f.overlay ? { overlay: f.overlay } : {})
    const crop = f.crop || t.crop
    return `<div class="shot-card ab-shot"><div class="m-fit" data-mock='${attr(spec)}'${crop ? ` data-crop="${crop.join(',').replace(/^/, '[').concat(']')}"` : ''} data-lb="${t.id} · ${v}${i + 1}" data-title="${f.lab}" role="button" tabindex="0" aria-label="Open ${t.id} option ${v}, ${f.lab}"></div><div class="shot-lab"><span class="mono">${v}${i + 1}</span><b>${f.lab}</b></div></div>`
  }
  $('#rvAlts').innerHTML = ALTS.map(t => {
    const head = ([v, label]) => `<div class="rv-opt-h${t.rec === v ? ' is-pick' : ''}"><span class="abv">${v}</span><b>${label}</b>${t.rec === v ? '<span class="tag t-changed">current pick</span>' : ''}</div>`
    const grid = t.custom
      ? t.opts.map(o => `<div class="rv-col${t.rec === o[0] ? ' is-pick' : ''}">${head(o)}${t.custom[o[0]]}</div>`).join('')
      : t.opts.map(head).join('') + t.frames.map((f, i) => t.opts.map(([v, , delta]) => `<div class="rv-cell${t.rec === v ? ' is-pick' : ''}">${frame(t, v, i, f, delta)}</div>`).join('')).join('')
    const stack = t.mode === 'stack' && !t.custom
    const opts = stack
      ? `<div class="rv-stack">${t.opts.map(o => `<div class="rv-row${t.rec === o[0] ? ' is-pick' : ''}">${head(o)}<div class="rv-frames">${t.frames.map((f, i) => `<div class="rv-cell">${frame(t, o[0], i, f, o[2])}</div>`).join('')}</div></div>`).join('')}</div>`
      : `<div class="rv-cmp" style="--n:${t.custom && t.mode === 'stack' ? 1 : t.opts.length}">${grid}</div>`
    return `<article class="rv-alt" id="${t.anchor}"><div class="rv-alt-h"><span class="code">${t.id}</span><h3>${t.q}</h3></div><p class="why">${t.why}</p>
      ${opts}
      <dl class="abt-plan"><dt>Task</dt><dd>${t.task}</dd><dt>Measure</dt><dd>${t.measure}</dd><dt>Decide</dt><dd>${t.rule}</dd></dl>
      <div class="abt-vote" data-rv="${t.id}"><span>Your pick</span><div class="seg" role="radiogroup" aria-label="Your pick for ${t.id}">${t.opts.map(([v]) => v).concat(['=']).map(v => `<button type="button" role="radio" data-v="${v}" aria-checked="${(votes[t.id] || {}).pick === v}">${v === '=' ? 'No difference' : v}</button>`).join('')}</div>
      <input type="text" maxlength="200" placeholder="Why? One line, optional" aria-label="Why, for ${t.id}" value="${((votes[t.id] || {}).note || '').replace(/"/g, '&quot;')}"></div></article>`
  }).join('')
  $('#rvAlts').addEventListener('click', e => {
    const b = e.target.closest('.abt-vote button[data-v]'); if (!b) return
    const id = b.closest('[data-rv]').dataset.rv
    votes[id] = Object.assign({}, votes[id], { pick: b.dataset.v }); save()
    $$('button', b.parentElement).forEach(x => x.setAttribute('aria-checked', String(x === b)))
  })
  $('#rvAlts').addEventListener('input', e => {
    const v = e.target.closest('.abt-vote'); if (!v) return
    votes[v.dataset.rv] = Object.assign({}, votes[v.dataset.rv], { note: e.target.value }); save()
  })
  $('#rvCopy').addEventListener('click', async () => {
    const pick = (t, p) => p === '=' ? 'no difference' : p ? `${p}, ${(t.opts.find(o => o[0] === p) || [])[1] || ''}` : 'no pick'
    const txt = ['ResearchAgent v1.3 stage review: my picks'].concat(ALTS.map(t => { const v = votes[t.id] || {}; return `${t.id} ${t.q} → ${pick(t, v.pick)}${v.note ? ` (${v.note})` : ''}` })).join('\n')
    const out = $('#rvOut'), btn = $('#rvCopy')
    out.value = txt; out.hidden = false
    try { await navigator.clipboard.writeText(txt); btn.textContent = 'Copied' } catch { out.select(); btn.textContent = 'Copy the text below' }
    setTimeout(() => { btn.textContent = 'Copy my picks' }, 2400)
  })

  // Lazy-mount the frames, as doc.js does for its own.
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return
    io.unobserve(e.target)
    M.mount(e.target, JSON.parse(e.target.dataset.mock))
  }), { rootMargin: '600px 0px' })
  $$('#tab-shipped [data-mock], #tab-review [data-mock]').forEach(el => io.observe(el))

  // Word counts in the clutter card (the ghost counter lives in doc.js; do it here for these spans).
  const ghost = document.createElement('div')
  ghost.className = 'm-fit'; ghost.setAttribute('aria-hidden', 'true'); ghost.style.cssText = 'position:absolute;left:-99999px;top:0;width:1440px'
  document.body.append(ghost)
  window.dispatchEvent(new Event('hashchange')) // doc.js routed before these anchors existed
  $$('#tab-review [data-words]').forEach(el => {
    if (el.textContent) return
    ghost.innerHTML = M.html(Object.assign({}, JSON.parse(el.dataset.words), { animate: false }))
    el.textContent = ghost.querySelector('.m-app').innerText.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length + ' words'
  })
})()
