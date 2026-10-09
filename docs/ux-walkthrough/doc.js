/* Walkthrough page: tabs, audit, route map, flow spec, lightbox, player,
   motion moments, brand widgets and the toast lab. Mockups come from mock.js. */
(function () {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const M = window.Mock
  const TABS = ['overview', 'shipped', 'review', 'tweaks', 'flow', 'play', 'motion', 'brand', 'notify']
  const store = { get(k) { try { return localStorage.getItem(k) } catch { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch { /* private mode */ } } }

  // ---------- reduce motion ----------
  const rm = $('#rmToggle')
  if (store.get('ra-rm') === '1') { rm.checked = true; document.body.classList.add('rm') }
  rm.addEventListener('change', () => { document.body.classList.toggle('rm', rm.checked); store.set('ra-rm', rm.checked ? '1' : '0') })

  // ---------- recommended tweaks, page-wide ----------
  const REC = { quiet: 1, nav: 'open', bar: 1, fold: 1, pills: 1 }
  // v1.3: the page draws the shipped build (v1.2) by default; the proposals stay one click away.
  const SHIP_ALL = Object.assign({ ship: 1 }, REC)
  const PAGE = { ship: SHIP_ALL, rec: REC, v1: null }
  const pv = $('#pageVer')
  const applyPage = v => { M.setTweaks(PAGE[v]); $$('button', pv).forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v))); store.set('ra-page', v) }
  pv.addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) applyPage(b.dataset.v) })
  applyPage(store.get('ra-page') in PAGE ? store.get('ra-page') : 'ship')

  // ---------- lazy mock mounting ----------
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return
    io.unobserve(e.target)
    M.mount(e.target, JSON.parse(e.target.dataset.mock))
  }), { rootMargin: '600px 0px' })
  const watchMocks = root => $$('[data-mock]', root).forEach(el => io.observe(el))

  // ---------- audit ----------
  const AUDIT = [
    ['03-answer-v2', 'top', 'The run is over before anyone sees it', 'In fixture mode all 16 trace events land within 44 ms. Click Ask and the page jumps straight to v2. The free answer, the decision and the purchase never appear while they happen.', 'Replay the persisted trace at stage pace: a client-side queue with a minimum time per step. The server stays fast; the screen waits for people.', 'C1 P1'],
    ['04-decisions', 'top', 'The story is split across four tabs', 'Answer, Decisions, Wire and Activity are mutually exclusive. The purchase and the answer it changes are never visible together, so cause and effect has to be narrated.', 'One workspace in three zones: run tape, answer, wallet.', 'B3 F2'],
    ['05-answer-v1', 'top', 'There’s no direct answer', 'The question is close to yes-or-no. v1 opens with eight equal cards, every one marked Uncertain, and the conclusion hides behind “Full conclusion”.', 'A one-sentence short answer with citations, then the gap, then claims grouped by stance.', 'C3 F2'],
    ['04-activity', 'top', 'Engine words on the surface', 'SKIP_OVER_CAP, READ_FREE, 2026-10-05T09:24:51.712Z, amountMinor 80, /v1/profiles/[id]/…. Honest, but unreadable from the back of a room.', 'Plain verdicts (“over the S$1.00 cap”) and relative times up front; raw events in Show work.', 'D2 H5'],
    ['05-answer-v1', '50% 62%', 'The gap isn’t tied to the purchase', '“What we still need to know” sits at the bottom of v1. Nothing connects it to the decision table, so the room can’t see why the agent buys.', 'The gap card is the hinge: circled in v1, priced in Decide, filled in v2.', 'C4 F1'],
    ['07-compare', 'top', 'Removed claims disappear quietly', 'v2 drops three v1 claims. You only find out by opening “Compare v1 → v2” and reading eleven before/after boxes.', 'Inline diff: NEW tags on added claims, one line about dropped ones, strike-through in Compare.', 'F1 F3'],
    ['03b-answer-v2-full', 'top', 'A wall of 18 sources', 'Each source gets an equal card at the bottom of a 4,200 px page, most reading “Fictional demo source. Independent records examining…”. Bought, skipped and free look alike.', 'A compact strip above the answer, with counts and a state on every card.', 'C1 C2'],
    ['01-home', 'top', 'Labels read like a footer', 'Provider and simulation labels are five lines of grey text. The dev-only “Fail next delivery” link sits in the main header.', 'Provenance chips that turn amber on a fallback; dev controls move to a presenter menu.', 'G4 P1'],
    ['03-answer-v2', 'top', 'Done is silent', 'When the run ends nothing says so: no toast, no tab title, no favicon. Download report gives no confirmation either.', 'Tape, toast, tab title, favicon and an optional desktop notification.', 'G1 R2 N1 N2'],
    ['06-passage', 'top', 'The passage drawer scrolls its own header away', 'Opening a citation scrolls the highlight into view and takes the title and Close button with it.', 'A sticky drawer header; only the text scrolls.', 'H2'],
    ['report-p1', 'top', 'The PDF numbers citations differently', 'The screen numbers claims 1 to 8. The PDF shows [30], [31], [32], [10]. The same passage has two numbers.', 'Stable per-run citation numbers, shared by screen and PDF.', 'R2'],
    ['12-delivery-failed', '50% 18%', 'A failed delivery says three things', 'A red “Research paused after an error”, a separate “Delivery failed after payment” panel, and a source card reading “bought S$0.90 · Delivery pending verification”.', 'One purchase card owns the state: paid, not delivered, retry is free.', 'E4 E5'],
    ['11-s0-decisions', '50% 55%', 'S$0 explains itself three times', 'One row says SKIP_OVER_BUDGET, “Would buy · with sufficient budget” and “Would buy with a sufficient budget; S$0 authorizes no purchase”, over a budget bar of five S$0.00 values.', 'One WOULD BUY stamp and a wallet that says “free only”.', 'B1 D3'],
    ['01-home', '0 0', 'No identity yet', 'No logo, no favicon. Cream, a serif and a dark green read like a template, and nothing about the look says “wallet”.', 'A mark, a palette and a motion language built for this product.', ''],
  ]
  const linkCodes = s => s.replace(/\b([A-HNPR]\d)\b/g, '<a class="code-link" href="#scr-$1">$1</a>')
  $('#audit').innerHTML = AUDIT.map(([img, pos, t, p, fix, to], i) => `<article class="finding">
    <button class="shot" type="button" data-img="current/${img}.jpg" aria-label="Open screenshot: ${t}"><img src="current/${img}.jpg" alt="" loading="lazy" style="--pos:${pos}"></button>
    <div class="fb"><span class="fn">FINDING ${String(i + 1).padStart(2, '0')}</span><h3>${t}</h3><p>${p}</p>
    <div class="fix"><b>Fix:</b> ${fix}${to ? ` ${linkCodes(to)}` : ' <a href="#brand">Brand</a>'}</div></div></article>`).join('')

  // ---------- flow data ----------
  const S = (scn, step, overlay, extra) => Object.assign({ scn, step }, overlay ? { overlay } : {}, extra || {})
  const SCREENS = {
    A1: ['Launch', 'new', { view: 'launch' }, ['Open 127.0.0.1:5100'], [['Active run saved in this browser', 'its current screen'], ['No active run', 'A2']], ['The mark plays once: brackets part, the coin drops in, brackets close. 0.9 s, then a 0.3 s fade into Home.', 'Skipped on reloads in the same session and under Reduce Motion.', 'No spinner. If the API is down, Home opens with an inline notice instead.']],
    A2: ['Home', 'changed', S('story', 'home'), ['A1', 'New question, from any run'], [['Ask ↵', 'B3'], ['Pick S$0', 'B1'], ['Ask with no question', 'B2'], ['Try an example', 'fills the question'], ['How it works', 'expands the strip']], ['Shipped: pick one of four demo questions (a click fills the box) or type your own. The budget chip (S$2.00 by default) opens a notched slider.', 'The budget is the only spending control. A yellow “i” says the money is simulated (see R6 in Review).', 'v1 proposal: coins with a sentence under them, a “Tell me when it’s done” tick and three “how it works” cells. These did not ship.'], 'Gate 5: provider and SIMULATED SGD chips are in the top bar before anything runs.'],
    A3: ['Home, returning', 'later', S('story', 'home', '', { variant: 'returning' }), ['A1 with a finished run'], [['Open', 'G1'], ['Ask', 'B3']], ['Needs run history, which is out of scope for 10 Oct. Shown so the layout leaves room for it.']],
    A4: ['Sign in', 'later', { view: 'signin' }, ['A1, once accounts exist'], [['Continue', 'magic link, then A2'], ['Use the demo workspace', 'A2']], ['One email field and a magic link. Budgets would become per-workspace limits.', 'Not designed further until accounts are in scope.']],
    B1: ['Free only (S$0)', 'changed', S('story', 'home', '', { variant: 'zero' }), ['A2'], [['Ask free', 'B3, then D3']], ['The chosen coin fills blue; the sentence beside it cross-fades in 180 ms.', 'Ask becomes “Ask free”, so nobody expects a purchase.'], 'Gate 2: S$0 means zero purchases. The decision still runs and shows what it would have bought.'],
    B2: ['Can’t send', 'changed', S('story', 'home', '', { variant: 'err' }), ['A2 with an empty question'], [['Type a question', 'A2']], ['Ask stays disabled until there’s text. Pressing Enter anyway turns the hint orange and shakes the composer once (240 ms).', 'The 2,000-character limit is stated up front.']],
    B3: ['Workspace opens', 'new', S('story', 'takeoff'), ['A2 Ask', 'B1 Ask free'], [['First trace event', 'C1'], ['Stop buying', 'G2']], ['The composer lifts and shrinks into the question heading (420 ms). Tape, answer and wallet slide in 60 ms apart.', 'The URL becomes /run/:id, so a reload resumes the run.', 'The wallet shows the full budget at once; the tape lists every step ahead of time.']],
    C1: ['Searching', 'changed', S('story', 'search'), ['B3'], [['Results arrive', 'C2'], ['Stop buying', 'G2'], ['Show work (W)', 'H5']], ['Source cards are dealt onto the strip 85 ms apart as results arrive. Counters tick.', 'The current tape step pulses. Tab title “Reading sources”; the favicon coin flips.']],
    C2: ['Reading free sources', 'changed', S('story', 'read'), ['C1'], [['Free text read', 'C3'], ['Click a free card', 'H2'], ['Click a paywalled card', 'H3']], ['Free cards flip to “read ✓”. Paywalled cards show a lock and a price.'], 'Gate 1: paywalled cards carry public metadata and a preview only.'],
    C3: ['First answer', 'changed', S('story', 'answer1'), ['C2'], [['Answer validated', 'C4'], ['Hover a citation', 'H1'], ['Click a citation', 'H2']], ['The short answer streams word by word; citation chips pop in as their claims validate.', 'Claims sit under it, grouped by stance.', 'If every claim fails validation, the extractive fallback shows with an amber label (G4).'], 'Gate 4: only claims whose span is an exact substring of the delivered text are shown.'],
    C4: ['Gap named', 'new', S('story', 'gap'), ['C3'], [['Decision round starts', 'D1']], ['The first open gap gets its own card under the short answer. The blue pen circles the facet (0.9 s stroke).', 'Its second line always says what happens next, so the room knows why the agent might buy.']],
    D1: ['Scoring', 'changed', S('story', 'decide'), ['C4'], [['Policy applied', 'D2, D3 or D4'], ['Click a row', 'shows its probabilities'], ['Stop buying', 'G2']], ['A decision panel slides into the wallet column. Rows rise in, then each value bar grows towards or past the dashed 0.20 bar.', 'Under each bar: covers-gap, original and credibility, in mono. The formula sits at the bottom.', 'Tab title: “Choosing sources”.']],
    D2: ['Verdicts', 'changed', S('story', 'verdicts'), ['D1'], [['Policy buys the winner', 'E1']], ['Stamps land 480 ms apart, BUY last: REWRITE, LOW VALUE, LOW VALUE, BUY.', 'Each stamp has a plain reason beside it, such as “A rewrite of NotFinancialTimes (99%)”.', 'Paywalled cards on the strip pick up the same verdicts.']],
    D3: ['Would buy (S$0)', 'changed', S('zero', 'wouldbuy'), ['D1 with a S$0 budget'], [['Ask again with S$1', 'B3'], ['Run ends', 'G1']], ['The winner gets a dashed WOULD BUY stamp. The wallet reads “S$0.00 · nothing can be bought”.', 'One sentence explains it once, instead of three labels on one row.']],
    D4: ['Nothing worth buying', 'new', S('open', 'nothing'), ['D1 with CORPUS_VARIANT=open-sufficient'], [['Run ends', 'G1']], ['Every bar stops short of the 0.20 line and gets BELOW BAR.', '“Nothing bought · S$2.00 unspent” reads as a result, not an error.']],
    E1: ['Payment required', 'changed', S('story', 'pay402'), ['D2'], [['Settle', 'E2'], ['Stop buying', 'finishes this intent, starts no more']], ['A purchase card slides up. The 402 node flashes orange twice; the quote node shows S$0.90 held.', 'The wallet counts down from S$2.00 to S$1.10 with a hatched “held” segment.', 'Tab title: “Buying S$0.90”.'], 'Gate 2: spent + held ≤ budget and price ≤ cap, enforced by the server. The UI only reflects it.'],
    E2: ['Settling', 'changed', S('story', 'settle'), ['E1'], [['Delivery verified', 'E3'], ['Delivery fails', 'E4']], ['The hatched hold turns solid. A receipt line prints at the bottom of the card.'], 'Gate 3: one intent, one settlement, one receipt.'],
    E3: ['Delivered and verified', 'changed', S('story', 'verified'), ['E2', 'E5'], [['Rewrite the answer', 'F1'], ['View receipt', 'H4']], ['200 and sha-256 light green. The digest scrambles for 0.9 s, then locks left to right; “✓ match” pops.', 'The bought card gets a blue ring. A receipt toast confirms it with the SIMULATED label.'], 'Gate 1: premium text becomes readable only after this check.'],
    E4: ['Delivery failed', 'changed', S('fault', 'failed'), ['E2 with “Fail next paid delivery” armed (P1)'], [['Retry delivery', 'E5']], ['The 200 node becomes an orange ✕ and the card says: paid, not delivered, retry is free.', 'The answer keeps v1; the gap card says it is waiting on delivery. One error toast stays until resolved.', 'Tab title “! Delivery failed” with an orange favicon dot.']],
    E5: ['Retry, same receipt', 'changed', S('fault', 'retry'), ['E4'], [['Delivery verified', 'E3']], ['The receipt line reads “same receipt · charged once” while it retries.'], 'Gate 3: a retry reuses the intent and can’t settle again.'],
    F1: ['Rewriting', 'changed', S('story', 'answer2'), ['E3'], [['Impact classified', 'F2']], ['The short answer re-streams. New citations are solid blue; the new key phrase gets a highlighter sweep.', 'The gap card turns green, “Gap closed”, and names the bought source.', 'New claims lead with NEW tags. One line notes the three claims v2 dropped.']],
    F2: ['Impact', 'changed', S('story', 'impact'), ['F1'], [['Round 2', 'G1'], ['Compare v1 → v2', 'F3'], ['Hover citation 9', 'H1']], ['A QUALIFIES stamp lands on the short answer and the card nudges 2 px. STRENGTHENS is green, QUALIFIES blue, CONTRADICTS orange, UNCHANGED grey.', 'One sentence says what changed, in plain words.']],
    F3: ['Compare v1 → v2', 'changed', S('story', 'impact', 'compare'), ['F2', 'G1'], [['v2', 'F2']], ['One list, not before/after boxes: NEW claims tagged blue, removed ones struck through in orange, unchanged ones plain.']],
    G1: ['Done on its own', 'changed', S('story', 'done'), ['Round 2 finds nothing', 'D3', 'D4'], [['Download report', 'R1'], ['Compare v1 → v2', 'F3'], ['New question', 'A2']], ['Round 2 bars shrink to zero with NO GAP stamps, and the panel says why it stopped.', 'The tape completes with the total time. Stop becomes “Run finished”.', '“Answer ready” toast with the spend, “✓ Answer ready” in the tab, green favicon dot; a desktop notification if the tab is hidden (N2).']],
    G2: ['Stopped by you', 'changed', S('story', 'decide', 'stopped'), ['Stop buying, on any run screen'], [['Ask again', 'A2']], ['The current step reads “Stopped by you”; later steps read “Not run”.', 'Anything already settling finishes and keeps its receipt. Nothing new starts.'], 'Gate 2: Stop halts new purchases immediately.'],
    G3: ['Budget used up', 'new', S('story', 'done', 'budgetOut'), ['A run whose remaining budget can’t cover any eligible source'], [['Ask again with more', 'A2']], ['Like G1, but the toast and wallet say it stopped on budget, not on value.']],
    G4: ['Fallback in use', 'changed', S('story', 'answer1', 'fallback'), ['DeepSeek times out, or every claim fails validation'], [['Continue', 'C4']], ['The Research chip turns amber (“fixture fallback”) and the version pill says why.', 'One warning toast. The run carries on.'], 'Gate 5: a fallback is allowed, but always visible.'],
    H1: ['Citation preview', 'new', S('story', 'impact', 'hover'), ['Hover or focus any citation'], [['Click', 'H2']], ['After 150 ms a card shows the source, its status and the exact sentence, highlighted.']],
    H2: ['Exact passage', 'changed', S('story', 'impact', 'passage'), ['H1', 'a read or bought source card'], [['Esc or ×', 'back'], ['J / K', 'next or previous citation']], ['A 580 px drawer slides in from the right. Its header (title, status, digest) stays put; only the text scrolls.', 'The cited span is highlighted and centred, with its number in the margin.'], 'Gate 4: the highlight is an exact substring of the delivered body, or the drawer says it can’t verify it.'],
    H3: ['Locked source', 'changed', S('story', 'impact', 'locked'), ['A paywalled card that wasn’t bought'], [['Esc or ×', 'back']], ['Public preview only, then placeholder bars (shapes, not text) and the policy’s reason for not buying.'], 'Gate 1: no premium bytes in the browser before a grant.'],
    H4: ['Receipt', 'new', S('story', 'done', 'receipt'), ['View, on the purchase card or receipt toast'], [['Esc', 'back']], ['A paper receipt with perforated edges: item, publisher, quote hash, settlement, digest, charge count, and the striped SIMULATED SGD footer.'], 'Gates 3 and 5: one charge, labelled simulated.'],
    H5: ['Show work', 'changed', S('story', 'done', 'work'), ['W, or Show work on the tape'], [['Trace, Wire, Policy, Receipts', 'switch view'], ['Esc', 'back']], ['A bottom sheet with the raw persisted events and relative times (+5.5 s). Activity and Wire live here now.', 'The “pop the hood” part of the talk happens here without leaving the run.']],
    R1: ['Writing report', 'changed', S('story', 'report'), ['Download report (G1)', 'the Answer ready toast'], [['PDF ready', 'R2'], ['PDF engine fails', 'R3']], ['The button turns into a progress pill naming the sections being written. The rest of the page stays usable.']],
    R2: ['Report ready', 'changed', S('story', 'reportReady'), ['R1'], [['Open PDF', 'new tab'], ['Download', 'file']], ['A toast stacks on top of “Answer ready” with Open and Download; the pill becomes a green button.', 'The PDF keeps the screen’s citation numbers.']],
    R3: ['Printable fallback', 'changed', S('story', 'reportReady', 'htmlReport'), ['R1 when Chromium is unavailable'], [['Open again', 'new tab']], ['The toast says the report opened as printable HTML and how to save it as PDF.'], 'Gate 5: the substitution is labelled.'],
    P1: ['Presenter menu', 'new', S('story', 'verdicts', 'presenter'), ['Press “.” anywhere'], [['Pace', 'Real, Stage 1×, Stage 0.5×'], ['Fail next paid delivery', 'arms E4'], ['Reset demo data', 'A2']], ['Takes dev controls out of the product header. Hidden until opened, and only in demo builds.', 'Stage pace replays the persisted trace with a minimum dwell per step, so a 40 ms fixture run reads as a 30-second story.']],
    N1: ['Tab title and icon', 'new', { view: 'tabstates' }, ['Every run state'], [], ['The title names the current step or the result. The favicon coin flips while working and gets a green or orange dot when it needs a look.']],
    N2: ['Desktop notification', 'new', { view: 'osnote' }, ['Run ends while the tab is hidden, if “Tell me when it’s done” is ticked'], [['Click', 'focuses the tab on G1']], ['One per run, with the short answer and the spend. Never for intermediate steps.']],
  }
  const SECTIONS = [
    ['A', 'Arrive', 'Before a question is asked: first visit, and later, returning and signing in.', [['A1', 'no active run', 'A2', 'with run history', 'A3', 'accounts, later', 'A4']]],
    ['B', 'Ask', 'Setting the budget is the only authorisation. There’s no purchase dialog.', [['B1', 'clear the question', 'B2', 'type, then Ask', 'B3']]],
    ['C', 'Read', 'Layer 1. The free answer has to work every time.', [['C1', '12 sources found', 'C2', 'free text read', 'C3', 'answer names a gap', 'C4']]],
    ['D', 'Decide', 'Layer 2. A decision model scores; policy code decides.', [['D1', 'policy applied', 'D2'], ['D1', 'budget is S$0', 'D3'], ['D1', 'nothing clears the bar', 'D4']]],
    ['E', 'Buy', 'Code pays, once per intent.', [['E1', 'quote accepted', 'E2', 'delivery and digest', 'E3'], ['E2', 'delivery fails', 'E4', 'Retry delivery', 'E5']]],
    ['F', 'Better answer', 'The bought evidence changes the answer, visibly.', [['F1', 'impact classified', 'F2', 'Compare v1 → v2', 'F3']]],
    ['G', 'Finish', 'Four ways a run ends. All keep the last good answer on screen.', [['G1', 'or you press Stop', 'G2', 'or the budget runs out', 'G3', 'or a provider fails', 'G4']]],
    ['H', 'Inspect', 'Available from the first answer onwards. Nothing here is required to follow the story.', [['H1', 'click', 'H2', 'an unbought source', 'H3'], ['H4', 'press W', 'H5']]],
    ['R', 'Report', 'Layer 3. One click, a PDF with the same citations.', [['R1', 'PDF written', 'R2', 'engine unavailable', 'R3']]],
    ['P', 'Presenter', 'For the stage only. Not part of the product.', [['P1']]],
    ['N', 'Outside the tab', 'How the run reaches you when you’re looking at something else.', [['N1', 'tab hidden at the end', 'N2']]],
  ]
  const TAGNAME = { today: 'Today', changed: 'Changed', new: 'New', later: 'Later' }

  // ---------- route map ----------
  function buildMetro() {
    const MAIN = ['A1', 'A2', 'B3', 'C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'E1', 'E2', 'E3', 'F1', 'F2', 'G1', 'R1', 'R2']
    const NAME = { A1: 'Launch', A2: 'Home', B3: 'Opens', C1: 'Search', C2: 'Read', C3: 'Answer v1', C4: 'Gap', D1: 'Score', D2: 'Verdicts', E1: '402', E2: 'Settle', E3: 'Verified', F1: 'Answer v2', F2: 'Impact', G1: 'Done', R1: 'Report', R2: 'Ready', A3: 'Returning', A4: 'Sign in', B1: 'S$0', B2: 'Empty', C5: 'Injection', D3: 'Would buy', D4: 'Nothing', E4: 'Failed', E5: 'Retry', F3: 'Compare', G3: 'Budget out', H1: 'Hover', H2: 'Passage', H3: 'Locked', H4: 'Receipt', H5: 'Show work', R3: 'HTML', G2: 'Stop', G4: 'Fallback', P1: 'Presenter', N1: 'Tab', N2: 'Desktop' }
    const X = i => 60 + i * 68, Y = 182
    const pos = {}
    MAIN.forEach((c, i) => { pos[c] = [X(i), Y, 'main'] })
    Object.assign(pos, {
      A4: [X(0), 88, 'up'], A3: [X(1), 88, 'up'], H1: [X(7.5), 88, 'up'], H2: [X(8.5), 88, 'up'], H3: [X(9.5), 88, 'up'], H4: [X(10.5), 88, 'up'], H5: [X(11.5), 88, 'up'], F3: [X(13), 88, 'up'],
      B1: [X(1), 276, 'down'], B2: [X(2), 276, 'down'], D3: [X(7), 276, 'down'], D4: [X(8), 276, 'down'], E4: [X(10), 276, 'down'], E5: [X(11), 276, 'down'], G3: [X(13.5), 276, 'down'], R3: [X(15), 276, 'down'],
      G2: [X(3.5), 366, 'any'], G4: [X(5.5), 366, 'any'], P1: [X(8.5), 366, 'any'], N1: [X(11), 366, 'any'], N2: [X(12.3), 366, 'any'],
    })
    const EDGES = [['A1', 'A4'], ['A2', 'A3'], ['A2', 'B1'], ['A2', 'B2'], ['D1', 'D3'], ['D1', 'D4'], ['E2', 'E4'], ['E4', 'E5'], ['E5', 'E3'], ['F2', 'F3'], ['F2', 'G3'], ['R1', 'R3']]
    const later = c => SCREENS[c][1] === 'later'
    const curve = (a, b) => { const [x1, y1] = pos[a], [x2, y2] = pos[b]; const my = (y1 + y2) / 2; return `M${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}` }
    const W = X(16) + 70, H = 420
    let svg = `<svg class="metro" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Route map of all screens">`
    svg += `<rect x="${X(7.5) - 40}" y="12" width="${X(11.5) - X(7.5) + 80}" height="104" rx="14" fill="#F7F8FB" stroke="#E3E6EE" stroke-dasharray="4 4"/><text class="lane" x="${X(7.5) - 28}" y="32">INSPECT · ANY TIME AFTER C3</text>`
    svg += `<line x1="30" x2="${W - 30}" y1="328" y2="328" stroke="#E3E6EE"/><text class="lane" x="34" y="352">ANY STEP</text>`
    svg += EDGES.map(([a, b]) => `<path d="${curve(a, b)}" fill="none" stroke="${later(b) ? '#8A90A3' : '#AEB5C6'}" stroke-width="2" ${later(b) ? 'stroke-dasharray="5 5"' : ''}/>`).join('')
    svg += `<path d="M${X(0)} ${Y} H ${X(16)}" stroke="#2F45FF" stroke-width="6" stroke-linecap="round"/>`
    svg += Object.entries(pos).map(([c, [x, y, kind]]) => {
      const main = kind === 'main', up = kind === 'up'
      const codeY = main ? y - 18 : up ? y - 32 : y + 26
      const nameY = main ? y + 28 : up ? y - 18 : y + 40
      return `<g class="st" tabindex="0" role="link" data-code="${c}" aria-label="${c} ${NAME[c]}"><circle cx="${x}" cy="${y}" r="${main ? 9 : 7}" fill="#fff" stroke="${main ? '#0F1222' : kind === 'any' ? '#B7791F' : '#AEB5C6'}" stroke-width="${main ? 3 : 2.5}" ${later(c) ? 'stroke-dasharray="3 3"' : ''}/>
        <text class="code" x="${x}" y="${codeY}" text-anchor="middle">${c}</text><text class="nm" x="${x}" y="${nameY}" text-anchor="middle">${NAME[c]}</text></g>`
    }).join('')
    svg += '</svg>'
    $('#metro').innerHTML = svg
    $$('#metro .st').forEach(g => {
      const go = () => { location.hash = 'scr-' + g.dataset.code }
      g.addEventListener('click', go)
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } })
    })
  }

  // ---------- flow sections ----------
  const attr = o => JSON.stringify(o).replace(/'/g, '&#39;')
  function shotCard(code) {
    const [title, , spec] = SCREENS[code]
    return `<div class="shot-card"><div class="m-fit" data-mock='${attr(spec)}' data-code="${code}" role="button" tabindex="0" aria-label="Open ${code}, ${title}"></div><div class="shot-lab"><span class="mono">${code}</span><b>${title}</b></div></div>`
  }
  function specCard(code) {
    const [title, tag, , from, acts, beh, gate] = SCREENS[code]
    return `<article class="spec" id="scr-${code}"><div class="spec-h"><span class="code">${code}</span><b>${title}</b><span class="tag t-${tag}">${TAGNAME[tag]}</span></div>
      <h5>Reached from</h5><ul><li>${from.map(linkCodes).join(' · ')}</li></ul>
      ${acts.length ? `<h5>Actions</h5><ul class="acts">${acts.map(([a, t]) => `<li><span>${a}</span><span>→ ${linkCodes(t)}</span></li>`).join('')}</ul>` : ''}
      <h5>Behaviour</h5><ul class="beh">${beh.map(b => `<li>${linkCodes(b)}</li>`).join('')}</ul>
      ${gate ? `<div class="gate">${gate}</div>` : ''}
      <div class="open"><a href="#" data-open="${code}">Open ${code} large →</a></div></article>`
  }
  function buildFlow() {
    $('#flowSections').innerHTML = SECTIONS.map(([k, name, note, rows]) => {
      const codes = Object.keys(SCREENS).filter(c => c[0] === k)
      const strips = rows.map(row => `<div class="strip">${row.map((x, i) => i % 2 ? `<div class="arrow">${x}</div>` : shotCard(x)).join('')}</div>`).join('')
      return `<section class="fsec" id="flow-${k}"><div class="fsec-h"><span class="L">${k}</span><h2>${name}</h2></div><p class="sub">${note}</p>${strips}<div class="specs">${codes.map(specCard).join('')}</div></section>`
    }).join('')
    buildMetro()
  }

  // ---------- lightbox ----------
  const lb = $('#lightbox')
  let lbSpec = null
  function openShot(code) {
    const [title, , spec] = SCREENS[code]
    openSpec(code, title, spec)
  }
  function openSpec(code, title, spec) {
    lbSpec = spec
    $('#lbCode').textContent = code
    $('#lbTitle').textContent = title
    $('#lbPlay').hidden = false
    $('#lbBody').innerHTML = '<div class="m-fit" id="lbFit"></div>'
    lb.showModal()
    M.mount($('#lbFit'), spec)
  }
  function openImg(src, label) {
    lbSpec = null
    $('#lbCode').textContent = 'Today'
    $('#lbTitle').textContent = label
    $('#lbPlay').hidden = true
    $('#lbBody').innerHTML = `<img src="${src}" alt="${label}">`
    lb.showModal()
  }
  $('#lbClose').addEventListener('click', () => lb.close())
  lb.addEventListener('click', e => { if (e.target === lb) lb.close() })
  lb.addEventListener('close', () => { $('#lbBody').innerHTML = '' })
  $('#lbPlay').addEventListener('click', () => { if (lbSpec) M.mount($('#lbFit'), Object.assign({}, lbSpec, { animate: true })) })
  document.addEventListener('click', e => {
    const fit = e.target.closest('.shot-card .m-fit')
    if (fit) return fit.dataset.code ? openShot(fit.dataset.code) : openSpec(fit.dataset.lb, fit.dataset.title, JSON.parse(fit.dataset.mock))
    const op = e.target.closest('[data-open]')
    if (op) { e.preventDefault(); return openShot(op.dataset.open) }
    const shot = e.target.closest('button.shot')
    if (shot) return openImg(shot.dataset.img, shot.closest('.finding').querySelector('h3').textContent)
  })
  document.addEventListener('keydown', e => {
    const fit = e.target.closest && e.target.closest('.shot-card .m-fit')
    if (fit && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fit.click() }
  })

  // ---------- player ----------
  const CODE = { home: 'A2', takeoff: 'B3', search: 'C1', read: 'C2', answer1: 'C3', gap: 'C4', decide: 'D1', verdicts: 'D2', wouldbuy: 'D3', nothing: 'D4', pay402: 'E1', settle: 'E2', verified: 'E3', failed: 'E4', retry: 'E5', answer2: 'F1', impact: 'F2', round2: 'G1', done: 'G1', report: 'R1', reportReady: 'R2' }
  const LAB = { home: 'Home', takeoff: 'Open', search: 'Search', read: 'Read', answer1: 'Answer', gap: 'Gap', decide: 'Score', verdicts: 'Verdicts', wouldbuy: 'Would buy', nothing: 'Nothing', pay402: '402', settle: 'Settle', verified: 'Verified', failed: 'Failed', retry: 'Retry', answer2: 'v2', impact: 'Impact', round2: 'Round 2', done: 'Done', report: 'Report', reportReady: 'Ready' }
  const P = { scn: 'story', i: 0, playing: false, speed: 1, timer: 0, started: false }
  const steps = () => M.SCN[P.scn].steps
  const dur = st => M.STEP[st][0] / P.speed
  function pRender() {
    const st = steps()[P.i]
    M.mount($('#pFrame'), { scn: P.scn, step: st, animate: true })
    $('#pCode').textContent = CODE[st]
    $('#pCaption').textContent = M.STEP[st][1]
    $$('#pTimeline li').forEach((li, k) => {
      li.className = k < P.i ? 'done' : k === P.i ? 'now' : ''
      if (k === P.i) { li.style.setProperty('--t', dur(st) + 'ms'); if (!P.playing) li.classList.add('paused') }
    })
    const bar = $$('#pTimeline li')[P.i]
    if (bar) { const i = bar.querySelector('.bar i'); i.style.animation = 'none'; void i.offsetWidth; i.style.animation = '' }
  }
  function pSchedule() {
    clearTimeout(P.timer)
    if (!P.playing) return
    P.timer = setTimeout(() => {
      if (P.i < steps().length - 1) { P.i++; pRender(); pSchedule() } else { P.playing = false; $('#pPlay').textContent = 'Replay'; $$('#pTimeline li')[P.i].className = 'done' }
    }, dur(steps()[P.i]))
  }
  function pPlay(on) {
    P.playing = on
    $('#pPlay').textContent = on ? 'Pause' : 'Play'
    const now = $('#pTimeline li.now')
    if (now) now.classList.toggle('paused', !on)
    pSchedule()
  }
  function pTimeline() {
    $('#pTimeline').innerHTML = steps().map((st, k) => `<li style="--d:${M.STEP[st][0]}"><button type="button" data-k="${k}" aria-label="Jump to ${LAB[st]}"><span class="bar"><i></i></span><span class="lab">${LAB[st]}</span></button></li>`).join('')
  }
  function pReset() { P.i = 0; pTimeline(); pRender(); pPlay(true) }
  function segs(el, items, cur, on) {
    el.innerHTML = items.map(([v, l]) => `<button type="button" role="radio" aria-checked="${v === cur}" data-v="${v}">${l}</button>`).join('')
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return
      $$('button', el).forEach(x => x.setAttribute('aria-checked', x === b))
      on(b.dataset.v)
    })
  }
  segs($('#pScn'), Object.entries(M.SCN).map(([k, v]) => [k, v.label]), 'story', v => { P.scn = v; pReset() })
  segs($('#pSpeed'), [['0.5', '0.5×'], ['1', '1×'], ['2', '2×']], '1', v => { P.speed = +v; pRender(); pSchedule() })
  $('#pPlay').addEventListener('click', () => { if (!P.playing && P.i === steps().length - 1) return pReset(); pPlay(!P.playing) })
  $('#pRestart').addEventListener('click', pReset)
  $('#pTimeline').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (!b) return; P.i = +b.dataset.k; pRender(); pPlay(true) })

  // ---------- scaled component boxes (motion + widgets) ----------
  function box(host, w, h, html, anim) {
    host.innerHTML = `<div class="box" style="aspect-ratio:${w}/${h};max-width:${w}px"><div class="m-scope${anim ? ' m-anim' : ''}" style="width:${w}px;height:${h}px">${html}</div></div>`
    const b = host.firstElementChild, inner = b.firstElementChild
    const fit = () => { inner.style.transform = `scale(${Math.min(1, b.clientWidth / w)})` }
    fit()
    if (window.ResizeObserver) new ResizeObserver(fit).observe(b)
    if (anim) M.effects(inner)
    return inner
  }
  const C = (step, extra) => M.ctx(Object.assign({ scn: 'story', step, animate: true }, extra || {}))
  const Cs = (step, extra) => M.ctx(Object.assign({ scn: 'story', step }, extra || {}))
  const pt = M.parts

  // ---------- motion ----------
  const TOK = [
    ['120 ms · micro', 'chip states, toggles, checkbox', '120ms', 'cubic-bezier(.2,.8,.2,1)'],
    ['240 ms · interface', 'hover, the budget sentence cross-fade', '240ms', 'cubic-bezier(.2,.8,.2,1)'],
    ['450 ms · reveal', 'rise, drawer, sheet, toast', '450ms', 'cubic-bezier(.2,.8,.2,1)'],
    ['900 ms · signature', 'pen stroke, bars, counters, digest lock', '900ms', 'cubic-bezier(.6,0,.3,1)'],
    ['spring · pop', 'stamps, citation chips, tape nodes', '450ms', 'cubic-bezier(.34,1.56,.64,1)'],
    ['stagger', 'cards 85 ms · claims 90 ms · stamps 480 ms', '1400ms', 'steps(6, end)'],
  ]
  $('#motionTokens').innerHTML = TOK.map(([b, s, d, e]) => `<div class="tok"><b>${b}</b><span>${s}</span><div class="track"><i style="--dur:${d};--ease:${e}"></i></div><span class="mono" style="font-size:11px">${e}</span></div>`).join('')

  const MOMENTS = [
    ['The mark drops in', 'App launch (A1), and the logo on this page', '0.8 s · spring on the coin', 'Static mark', 3200, s => box(s, 360, 230, `<div class="m-launch" style="background:transparent;height:230px">${M.mark()}<span>ResearchAgent</span></div>`, true)],
    ['Budget coins', 'Choosing a budget on Home (A2, B1)', '180 ms fill · 240 ms sentence cross-fade', 'Instant swap', 4800, s => {
      const txt = { 0: '<b>Free sources only.</b>You’ll still see what it would have bought.', 1: '<b>Up to S$1.00, at most S$1.00 per source.</b>Enough for one source under the cap.', 2: '<b>Up to S$2.00, at most S$1.00 per source.</b>It buys only sources that clear the bar.', 5: '<b>Up to S$5.00, at most S$1.00 per source.</b>Room for several rounds.' }
      const inner = box(s, 640, 100, `<div class="m-comp-row" style="border:0;padding:24px 20px"><div class="m-coins">${[0, 1, 2, 5].map(v => `<span class="m-coin" data-v="${v}" style="transition:background .18s,color .18s,border-color .18s,box-shadow .18s">S$${v}</span>`).join('')}</div><p class="m-consq" style="transition:opacity .24s"></p></div>`, true)
      const seq = [2, 0, 5, 1]
      let k = 0
      const set = () => {
        const v = seq[k++ % seq.length]
        $$('.m-coin', inner).forEach(c => c.classList.toggle('on', +c.dataset.v === v))
        const p = $('.m-consq', inner); p.style.opacity = 0
        setTimeout(() => { p.innerHTML = txt[v]; p.style.opacity = 1 }, 140)
      }
      set(); const t = setInterval(set, 1200); return () => clearInterval(t)
    }],
    ['Deal, then flip', 'Search returns, then free sources are read (C1 → C2)', '550 ms per card, 85 ms apart · 400 ms pop', 'Cards appear in place', 4600, s => {
      box(s, 760, 150, pt.strip(C('search')), true)
      const t = setTimeout(() => box(s, 760, 150, pt.strip(C('read')), true), 1700); return () => clearTimeout(t)
    }],
    ['Stream with citations', 'An answer version arrives (C3, F1)', '45 ms per word · chips pop with a spring', 'Whole answer appears', 5200, s => box(s, 640, 290, pt.verdict(C('answer1')), true)],
    ['The pen circles the gap', 'The answer names its gap (C4)', '0.9 s stroke, cubic-bezier(.6,0,.3,1)', 'Circle drawn, no stroke animation', 3600, s => box(s, 520, 130, pt.gapCard(C('gap')), true)],
    ['Bars, then stamps', 'A decision round (D1 → D2)', 'bars 900 ms · stamps 450 ms, 480 ms apart, BUY last', 'Bars and stamps at rest', 6400, s => {
      box(s, 372, 450, pt.decide(C('decide')), true)
      const t = setTimeout(() => box(s, 372, 450, pt.decide(C('verdicts')), true), 2300); return () => clearTimeout(t)
    }],
    ['Money moves', 'A purchase (E1 → E2 → E3)', 'count 900 ms · 402 flash ×2 · digest lock 900 ms', 'Values jump; no flash or scramble', 7600, s => {
      const r = st => box(s, 372, 430, `<div style="display:grid;gap:14px">${pt.wallet(C(st))}${pt.buy(C(st))}</div>`, true)
      r('pay402')
      const a = setTimeout(() => r('settle'), 2200), b = setTimeout(() => r('verified'), 4200)
      return () => { clearTimeout(a); clearTimeout(b) }
    }],
    ['Highlighter fills the gap', 'Answer v2 closes the gap (F1)', '0.9 s sweep, left to right', 'Highlight at rest', 3600, s => box(s, 520, 130, pt.gapCard(C('answer2')), true)],
    ['Impact stamp', 'Impact classified (F2)', '500 ms stamp · 2 px card nudge on landing', 'Stamp at rest', 4200, s => box(s, 640, 330, pt.verdict(C('impact')), true)],
    ['Toasts stack', 'Purchase verified, answer ready, report ready', '500 ms rise · older toasts tuck 14 px and shrink 5%', 'Toasts appear in place', 6400, s => {
      const r = st => box(s, 440, 300, `<div style="position:relative;height:300px">${pt.toasts(C(st))}</div>`, true)
      r('verified')
      const a = setTimeout(() => r('done'), 2000), b = setTimeout(() => r('reportReady'), 4000)
      return () => { clearTimeout(a); clearTimeout(b) }
    }],
  ]
  function buildMoments() {
    $('#moments').innerHTML = MOMENTS.map(([t, trig, timing, red], i) => `<article class="moment"><div class="stage" data-m="${i}"></div><div class="mb"><div class="mh"><b>${t}</b><button class="btn replay" type="button" data-replay="${i}">Replay</button></div>
      <dl><dt>When</dt><dd>${trig}</dd><dt>Timing</dt><dd>${timing}</dd><dt>Reduced</dt><dd>${red}</dd></dl></div></article>`).join('')
    const live = new Map()
    const start = i => {
      stop(i)
      const stage = $(`[data-m="${i}"]`)
      const run = () => { const c = live.get(i); if (c && c.cleanup) c.cleanup(); const cleanup = MOMENTS[i][5](stage); live.set(i, { cleanup: typeof cleanup === 'function' ? cleanup : null, loop }) }
      const loop = setInterval(run, MOMENTS[i][4])
      live.set(i, { loop }); run()
    }
    const stop = i => { const c = live.get(i); if (!c) return; clearInterval(c.loop); if (c.cleanup) c.cleanup(); live.delete(i) }
    const mio = new IntersectionObserver(es => es.forEach(e => { const i = +e.target.dataset.m; if (e.isIntersecting) start(i); else stop(i) }), { threshold: .2 })
    $$('#moments .stage').forEach(s => mio.observe(s))
    $('#moments').addEventListener('click', e => { const b = e.target.closest('[data-replay]'); if (b) start(+b.dataset.replay) })
  }

  // ---------- brand ----------
  function buildBrand() {
    const live = $('#logoLive')
    const play = () => { live.innerHTML = `<div class="m-scope m-anim" style="width:100%"><div class="m-launch" style="background:transparent;padding:30px 0">${M.mark()}<span>ResearchAgent</span></div></div><button class="btn replay" type="button">Replay</button>`; $('.replay', live).onclick = play }
    play()
    const fav = (f, label) => `<figure><span class="m-fav ${f ? 'f-' + f : ''}">${M.mark()}</span><figcaption>${label}</figcaption></figure>`
    $('#favs').classList.add('m-anim')
    $('#favs').innerHTML = fav('', 'idle') + fav('work', 'working') + fav('done', 'done') + fav('alert', 'needs you') + `<figure class="appicon">${M.appIcon(64)}<figcaption>app icon</figcaption></figure>` + `<figure><span class="m-fav" style="width:16px;height:16px;border-radius:4px"><svg viewBox="0 0 32 32" style="width:14px;height:14px"><path class="br" d="M11.5 6.5H7.5v19h4M20.5 6.5h4v19h-4" style="fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"/><circle cx="16" cy="19" r="4.4" fill="#FFE45C"/></svg></span><figcaption>16 px</figcaption></figure>`

    const SW = [
      ['Paper', '#F6F7F9', 'App background. Cool, not cream.'], ['Sheet', '#FFFFFF', 'Cards, panels, drawers.'], ['Ink', '#0F1222', 'Text, completed steps.'],
      ['Agent Blue', '#2F45FF', 'The pen: brand, actions, what the agent did. 6.2:1 on white.'], ['Highlighter', '#FFE45C', 'Evidence: cited spans, the SIMULATED stripe.'], ['Verified', '#0B8A5A', 'sha-256 matches, read, gap closed.'],
      ['Payment', '#FF5A1F', '402, failed delivery, over cap. Text uses #C2410C.'], ['Fallback', '#B7791F', 'Substituted provider, flagged source.'], ['Rule', '#E3E6EE', 'Borders and tracks.'],
    ]
    $('#swatches').innerHTML = SW.map(([n, h, r]) => `<div class="sw"><i style="background:${h}"></i><div><b>${n}</b><span class="mono">${h}</span><p>${r}</p></div></div>`).join('')

    const W = []
    const add = (title, note, html, wide) => W.push(`<article class="widget${wide ? ' wide' : ''}"><div class="wstage">${html}</div><div class="wb"><b>${title}</b>${note}</div></article>`)
    const scoped = (w, h, html) => `<div class="wbox" data-w="${w}" data-h="${h}">${html}</div>`
    add('Budget coins', 'The only spending control. Selected coin fills blue with an inner rim.', `<div class="m-scope"><div class="m-coins">${[0, 1, 2, 5].map(v => `<span class="m-coin ${v === 2 ? 'on' : ''}">S$${v}</span>`).join('')}</div></div>`)
    add('Provenance chips', 'Always in the top bar. Amber when a fallback is in use; striped when money is simulated.', `<div class="m-scope wrow"><span class="m-chip"><i></i>Research · DeepSeek deepseek-flash</span><span class="m-chip is-fallback"><i></i>Research · fixture fallback</span><span class="m-chip"><i></i>Decide · OpenAI Decisions · gpt-6-luna</span><span class="m-chip is-sim">SIMULATED SGD · no real funds</span></div>`)
    add('Run tape steps', 'Done, working, waiting, failed, skipped. The line fills blue as steps complete.', `<div class="m-scope" style="width:240px"><ol class="m-tape"><li class="is-done"><i class="m-node"></i><div><b>Choose what to buy</b><span>1 of 4 clears the bar</span></div><time>0.8 s</time></li><li class="is-now"><i class="m-node"></i><div><b>Buy</b><span>402 → quote S$0.90</span></div><time></time></li><li class="is-fail"><i class="m-node"></i><div><b>Buy</b><span>Paid · delivery failed</span></div><time></time></li><li class="is-skip"><i class="m-node"></i><div><b>Check again</b><span>Stopped by you</span></div><time></time></li><li class="is-todo"><i class="m-node"></i><div><b>Done</b></div><time></time></li></ol></div>`)
    const card = (id, cls, lab, icon, cc) => { const s = window.RA.sources.find(x => x.id === id); return `<div class="m-card ${cc || ''}" style="width:118px"><div class="m-card-top"><span class="m-mono">${s.mono}</span><span class="m-card-p">${s.pub}</span></div><div class="m-card-t">${s.title}</div><div class="m-card-s ${cls}">${icon || ''}${lab}</div></div>` }
    const ck = '<svg viewBox="0 0 12 12"><path d="M2.5 6.4l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    add('Source cards', 'Found, read, paywalled, bought, skipped. The strip shows six and counts the rest.', `<div class="m-scope wrow">${card('or1', 'st-read', 'read', ck)}${card('ff', 'st-lock', 'S$0.25')}${card('nf', 'st-bought', 'bought S$0.90', ck, 'is-bought')}${card('kc', 'st-skip', 'low value · S$0.10')}${card('mp', 'st-skip', 'rewrite · S$0.20')}</div>`)
    add('Verdict stamps', 'Policy outcomes. Solid for BUY, dashed for WOULD BUY, outlined for skips.', `<div class="m-scope wrow">${[['s-buy', 'BUY'], ['s-would', 'WOULD BUY'], ['s-cap', 'OVER CAP'], ['s-low', 'LOW VALUE'], ['s-rw', 'REWRITE'], ['s-bar', 'BELOW BAR'], ['s-gap', 'NO GAP']].map(([c, l]) => `<span class="m-stamp ${c}">${l}</span>`).join('')}</div>`)
    add('Impact stamps', 'How the bought evidence changed the answer.', `<div class="m-scope wrow">${[['QUALIFIES', 'var(--pen)'], ['STRENGTHENS', 'var(--ok)'], ['CONTRADICTS', 'var(--pay-ink)'], ['UNCHANGED', 'var(--muted)']].map(([l, c]) => `<span class="m-impact" style="position:static;color:${c};border-color:${c}">${l}</span>`).join('')}</div>`)
    add('Decision panel', 'Value bars against the dashed 0.20 bar, a plain reason and a stamp per row.', scoped(372, 450, pt.decide(Cs('verdicts'))))
    add('Wallet', 'Counts down, never jumps. Held money is hatched; spent is solid.', scoped(372, 150, pt.wallet(Cs('pay402'))))
    add('Purchase card', '402 → quote → settle → 200 → sha-256, with the receipt line.', scoped(372, 250, pt.buy(Cs('verified'))))
    add('Gap card', 'Open (dashed pen, circled facet) and closed (green, highlighted).', scoped(744, 236, `<div style="display:grid;gap:12px">${pt.gapCard(Cs('decide'))}${pt.gapCard(Cs('answer2'))}</div>`), true)
    add('Citation chip and preview', 'Grey for free sources, solid blue for bought ones. Hover shows the exact sentence.', `<div class="m-scope" style="display:grid;gap:14px;justify-items:start"><p class="m-vtext" style="font-size:19px">…consensus margin falls to 55.2%<span class="m-cite is-new is-hover">9</span> after the five-year deal<span class="m-cite">1</span>.</p><div class="m-hover" style="position:relative;left:0;top:0;width:340px"><div class="m-hover-h"><span class="m-mono">NF</span>NotFinancialTimes</div><q>“<mark class="m-hl">On 1 October 2026, the average fiscal 2027 gross margin estimate across the five brokers fell to 55.2% from 58.5%.</mark>”</q><div class="m-hover-f"><span>bought S$0.90</span><span>Click to open ↗</span></div></div></div>`)
    add('Buttons', 'Primary (pen), secondary, Stop buying, and the report progress pill.', `<div class="m-scope wrow" style="gap:10px"><button class="m-btn m-btn-pen">Download report ↓</button><button class="m-btn">Compare v1 → v2</button><button class="m-stop" style="width:160px">Stop buying</button><span class="m-progress" style="min-width:0"><span class="m-spin"></span>Writing report<i></i></span></div>`)
    add('Receipt', 'Printed paper, perforated edges, one charge, striped simulated footer.', `<div class="m-scope" style="position:relative;width:340px;height:330px"><div class="m-receipt" style="right:0;top:0"><h5>RECEIPT</h5><div class="sub">run b5390658</div><dl><dt>Item</dt><dd>Analysts cut Kestrel margin estimates</dd><dt>Publisher</dt><dd>NotFinancialTimes</dd><dt>Delivered</dt><dd>sha-256 b11dd65c… ✓</dd><dt>Charges</dt><dd>1</dd></dl><div class="tot"><span>Total</span><span>S$0.90</span></div><div class="sim">SIMULATED SGD · NO REAL FUNDS</div></div></div>`)
    add('Toast', 'White card, a coloured glyph for the kind, and the next action when there is one.', `<div class="m-scope" style="position:relative;width:380px;height:130px">${pt.toasts(Cs('done')).replace('class="m-toasts"', 'class="m-toasts" style="right:0;bottom:0"')}</div>`)
    $('#widgets').innerHTML = W.join('')
    $$('#widgets .wbox').forEach(el => { const w = +el.dataset.w, h = +el.dataset.h, html = el.innerHTML; const host = el.parentElement; host.style.display = 'block'; box(host, w, h, html, false) })
  }

  // ---------- notify: toast lab ----------
  function buildToastLab() {
    const KINDS = [
      ['Source bought', 't-pen t-rcpt', '✓', 'Bought NotFinancialTimes', 'S$0.90 · sha-256 verified · <span class="sim">SIMULATED SGD</span>', '', 6000],
      ['Injected text ignored', 't-warn', '⚑', 'Ignored instructions in a source', 'Text in sources can’t spend. Only policy code can buy.', '', 8000],
      ['Fallback used', 't-warn', '!', 'Research model timed out', 'Showing a labelled offline answer from the same verified passages.', '', 8000],
      ['Delivery failed', 't-err', '!', 'Delivery failed after payment', 'Charged once (S$0.90, simulated). Retry fetches the same copy.', '<button class="m-btn m-btn-pay">Retry delivery</button>', 0],
      ['Answer ready', '', '✓', 'Answer ready', 'v2 qualifies the free answer · S$0.90 of S$2.00 spent', '<button class="m-btn m-btn-pen">Download report</button><button class="m-btn">Compare</button>', 0],
      ['Stopped', 't-info', '■', 'Stopped', 'No new purchases will start. The current answer stays.', '', 6000],
      ['Report ready', 't-pen', '↓', 'Report ready · 6 pages', 'Findings, what the purchase changed, open questions, receipts.', '<button class="m-btn m-btn-pen">Open PDF</button><button class="m-btn">Download</button>', 0],
    ]
    const stack = $('#toastStack')
    const list = []
    const layout = () => {
      const shown = list.slice(-3)
      list.slice(0, -3).forEach(t => { t.el.remove() })
      list.splice(0, Math.max(0, list.length - 3))
      shown.forEach((t, i) => {
        const k = shown.length - 1 - i
        t.el.style.setProperty('--k', k); t.el.style.zIndex = 10 - k
        t.el.style.filter = k ? 'saturate(.6)' : ''
        const acts = t.el.querySelector('.m-t-acts'); if (acts) acts.hidden = k > 0
      })
    }
    const push = i => {
      const [, cls, ic, title, body, acts, ttl] = KINDS[i]
      const el = document.createElement('div')
      el.className = `m-toast ${cls}`
      el.innerHTML = `<div class="m-t-ic">${ic}</div><div class="m-t-b"><b>${title}</b><p>${body}</p>${acts ? `<div class="m-t-acts">${acts}</div>` : ''}</div><button class="m-t-x" type="button" aria-label="Dismiss" style="border:0;background:none;cursor:pointer">×</button>`
      stack.append(el)
      const t = { el }
      list.push(t); layout()
      const kill = () => { const j = list.indexOf(t); if (j < 0) return; list.splice(j, 1); el.classList.add('out'); setTimeout(() => el.remove(), 380); layout() }
      el.querySelector('.m-t-x').onclick = kill
      if (ttl) setTimeout(kill, ttl)
    }
    $('#toastBtns').innerHTML = KINDS.map(([l], i) => `<button class="btn" type="button" data-t="${i}">${l}</button>`).join('')
    $('#toastBtns').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) push(+b.dataset.t) })
    push(0); setTimeout(() => push(4), 300)
  }


  // ---------- tweaks (feedback round 1) ----------
  const NONE = { quiet: 0, nav: 0, bar: 0, fold: 0, pills: 0 }
  const PRESETS = { v1: NONE, rec: Object.assign({}, NONE, REC) }
  const TWEAKS = [
    ['quiet', 'T1', 'Quiet top bar', 'The four chips go. SIMULATED SGD moves onto the budget card and Home. A chip appears only when a fallback is in use.'],
    ['nav', 'T2', 'App sidebar', 'New question and past runs on the left. Collapses to an icon rail.'],
    ['bar', 'T3', 'Run bar along the bottom', 'The steps become one line, with Stop buying and Show work beside them. Off with the sidebar on: the steps sit under the run instead.'],
    ['fold', 'T4', 'Fold after the moment', 'Bars, stamps and the wire track play in full, then fold to results: bought, skipped, receipt.'],
    ['pills', 'T5', 'Sources in one line', 'Initials coloured by state and the bought source named. View all opens the cards.'],
  ]
  // Words inside the app (below the browser bar), counted on an offscreen copy.
  const ghost = document.createElement('div')
  ghost.className = 'm-fit'
  ghost.setAttribute('aria-hidden', 'true')
  ghost.style.cssText = 'position:absolute;left:-99999px;top:0;width:1440px'
  document.body.append(ghost)
  const words = spec => {
    ghost.innerHTML = M.html(Object.assign({}, spec, { animate: false }))
    return ghost.querySelector('.m-app').innerText.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length
  }
  $$('[data-words]').forEach(el => { el.textContent = words(JSON.parse(el.dataset.words)) + ' words' })

  const TW = Object.assign({}, PRESETS.rec)
  const RUN = M.SCN.story.steps.slice(0, M.SCN.story.steps.indexOf('done') + 1)
  let twStep = 'impact', twTimer = 0
  const twSpec = anim => ({ scn: 'story', step: twStep, tw: Object.assign({}, TW), animate: anim })
  function twRender(anim) {
    M.mount($('#twFrame'), twSpec(!!anim))
    const now = words(twSpec(false)), was = words({ scn: 'story', step: twStep, tw: {} })
    const d = Math.round((was - now) / was * 100)
    $('#twWords').innerHTML = `<b>${now}</b><span>words on screen</span><em>v1 at this moment: ${was}${d ? ` · ${d > 0 ? '−' : '+'}${Math.abs(d)}%` : ''}</em>`
    $$('#twList [data-k]').forEach(row => {
      const k = row.dataset.k
      row.classList.toggle('on', !!TW[k])
      const sw = $('.sw', row)
      if (sw) sw.setAttribute('aria-checked', String(!!TW[k]))
      $$('button[data-v]', row).forEach(b => b.setAttribute('aria-checked', String(String(TW[k] || 0) === b.dataset.v)))
    })
    $$('#twMoment button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === twStep)))
    $$('#twPreset button').forEach(b => b.setAttribute('aria-checked', String(Object.keys(NONE).every(k => PRESETS[b.dataset.v][k] === TW[k]))))
  }
  function twStop() { clearTimeout(twTimer); twTimer = 0; $('#twPlay').textContent = 'Play the run' }
  function twPlay() {
    if (twTimer) return twStop()
    let i = 0
    $('#twPlay').textContent = 'Stop'
    const tick = () => {
      twStep = RUN[i++]
      twRender(true)
      if (i < RUN.length) twTimer = setTimeout(tick, M.STEP[twStep][0]); else twStop()
    }
    tick()
  }
  function buildTweaks() {
    $('#twList').innerHTML = TWEAKS.map(([k, code, t, d]) => `<div class="tw-item" data-k="${k}"><div class="tw-h"><span class="code">${code}</span><b>${t}</b>${k === 'nav'
      ? '<div class="seg seg-sm" role="radiogroup" aria-label="Sidebar"><button type="button" role="radio" data-v="0">Off</button><button type="button" role="radio" data-v="open">Open</button><button type="button" role="radio" data-v="rail">Rail</button></div>'
      : `<button class="sw" type="button" role="switch" aria-label="${t}"></button>`}</div><p>${d}</p></div>`).join('')
    $('#twList').addEventListener('click', e => {
      const row = e.target.closest('[data-k]'), k = row && row.dataset.k
      if (!k) return
      const b = e.target.closest('button[data-v]')
      if (k === 'nav' && b) TW.nav = b.dataset.v === '0' ? 0 : b.dataset.v
      else if (e.target.closest('.sw')) TW[k] = TW[k] ? 0 : 1
      else return
      twStop(); twRender(true)
    })
    segs($('#twPreset'), [['v1', 'v1 as proposed'], ['rec', 'Recommended']], 'rec', v => { Object.assign(TW, PRESETS[v]); twStop(); twRender(true) })
    segs($('#twMoment'), [['read', 'Reading'], ['verdicts', 'Deciding'], ['pay402', 'Buying'], ['impact', 'Impact'], ['done', 'Done']], twStep, v => { twStep = v; twStop(); twRender(true) })
    $('#twPlay').addEventListener('click', twPlay)
    twRender(false)
    buildAB()
  }

  // ---------- A/B flows ----------
  const AB = [
    { id: 'AB1', q: 'Where should progress live?', why: 'The run bar answers the critique, but a bar along the bottom is out of the way. The purchase has to be noticed: it’s the point of the demo.',
      a: ['Steps under the run, in the sidebar', { bar: 0 }], b: ['Run bar along the bottom', {}], rec: 'B',
      frames: [['read', 'Reading'], ['pay402', 'Buying'], ['done', 'Done']], arrows: ['it decides to buy', 'it finishes'],
      task: 'On each screen: “What is it doing right now?” At the end: “Did it buy anything? What?”', measure: 'Right answers, and seconds to answer.', rule: 'Ship B unless fewer people notice the purchase than with A.' },
    { id: 'AB2', q: 'Should the right panel fold after the purchase?', why: 'Folding removes the bars and the wire track once they’ve played. The risk is that people can no longer say why it bought what it bought.',
      a: ['Folds to results', {}], b: ['Stays open: bars, stamps, wire track', { fold: 0 }], rec: 'A',
      frames: [['verdicts', 'Verdicts'], ['verified', 'Verified'], ['done', 'Done']], arrows: ['it pays', 'it rewrites the answer'],
      task: '“Why did it buy NotFinancialTimes and not MarketPulse Digest?”', measure: 'A correct answer within 20 seconds, and whether they needed “Why these?”.', rule: 'Ship A if at least 4 of 5 answer correctly without opening “Why these?”.' },
    { id: 'AB3', q: 'Where should “simulated” be said?', why: 'Gate 5 is a hard rule, so this test has a stricter bar: one miss is a fail.',
      a: ['On the money: budget card, Home, receipts, toasts', {}], b: ['One striped strip under the top bar', { simbar: 1 }], rec: 'A',
      frames: [['home', 'Home'], ['pay402', 'Buying'], ['done', 'Done']], arrows: ['Ask', 'the run ends'],
      task: 'After the run, with the screen still up: “Did this spend real money?”', measure: 'Everyone has to say no.', rule: 'Ship A only if 5 of 5 say no. One miss and B ships.' },
    { id: 'AB4', q: 'Sidebar open or collapsed on a first visit?', why: 'Open shows history and New question; collapsed gives the answer about 170 px more width.',
      a: ['Open, with past runs', {}], b: ['Collapsed to icons', { nav: 'rail' }], rec: 'A',
      frames: [['home', 'Home'], ['impact', 'Impact'], ['done', 'Done']], arrows: ['Ask', 'the run ends'],
      task: '“Start a new question.” Then: “Go back to the question you asked yesterday.”', measure: 'Seconds to each click, and whether the answer felt cramped.', rule: 'Ship B only if both tasks are as fast and nobody hunts for history.' },
  ]
  let votes = {}
  try { votes = JSON.parse(store.get('ra-ab') || '{}') || {} } catch { votes = {} }
  const saveVotes = () => store.set('ra-ab', JSON.stringify(votes))
  function buildAB() {
    const shot = (t, v, i, spec, lab) => `<div class="shot-card ab-shot"><div class="m-fit" data-mock='${attr(spec)}' data-lb="${t.id} · ${v}${i + 1}" data-title="${lab}" role="button" tabindex="0" aria-label="Open ${t.id} variant ${v}, ${lab}"></div><div class="shot-lab"><span class="mono">${v}${i + 1}</span><b>${lab}</b></div></div>`
    const flow = (t, v, delta) => `<div class="strip">${t.frames.map(([step, lab], i) => (i ? `<div class="arrow">${t.arrows[i - 1]}</div>` : '') + shot(t, v, i, { scn: 'story', step, tw: Object.assign({}, REC, delta) }, lab)).join('')}</div>`
    const row = (t, v, [label]) => `<div class="abt-row"><span class="abv v-${v}">${v}</span><b>${label}</b>${t.rec === v ? '<span class="tag t-changed">current pick</span>' : ''}</div>`
    $('#abTests').innerHTML = AB.map(t => `<article class="abt" id="ab-${t.id}"><div class="abt-h"><span class="code">${t.id}</span><h3>${t.q}</h3></div><p class="abt-why">${t.why}</p>
      ${row(t, 'A', t.a)}${flow(t, 'A', t.a[1])}${row(t, 'B', t.b)}${flow(t, 'B', t.b[1])}
      <dl class="abt-plan"><dt>Task</dt><dd>${t.task}</dd><dt>Measure</dt><dd>${t.measure}</dd><dt>Decide</dt><dd>${t.rule}</dd></dl>
      <div class="abt-vote" data-ab="${t.id}"><span>Your pick</span><div class="seg" role="radiogroup" aria-label="Your pick for ${t.id}">${[['A', 'A'], ['B', 'B'], ['=', 'No difference']].map(([v, l]) => `<button type="button" role="radio" data-v="${v}" aria-checked="${(votes[t.id] || {}).pick === v}">${l}</button>`).join('')}</div>
      <input type="text" maxlength="200" placeholder="Why? One line, optional" aria-label="Why, for ${t.id}" value="${((votes[t.id] || {}).note || '').replace(/"/g, '&quot;')}"></div></article>`).join('')
    $('#abTests').addEventListener('click', e => {
      const b = e.target.closest('.abt-vote button[data-v]'); if (!b) return
      const id = b.closest('[data-ab]').dataset.ab
      votes[id] = Object.assign({}, votes[id], { pick: b.dataset.v }); saveVotes()
      $$('button', b.parentElement).forEach(x => x.setAttribute('aria-checked', String(x === b)))
    })
    $('#abTests').addEventListener('input', e => {
      const v = e.target.closest('.abt-vote'); if (!v) return
      votes[v.dataset.ab] = Object.assign({}, votes[v.dataset.ab], { note: e.target.value }); saveVotes()
    })
    $('#abCopy').addEventListener('click', async () => {
      const pick = (t, p) => p === 'A' ? 'A, ' + t.a[0] : p === 'B' ? 'B, ' + t.b[0] : p === '=' ? 'no difference' : 'no pick'
      const txt = ['ResearchAgent v1.1 tweaks: my A/B picks'].concat(AB.map(t => { const v = votes[t.id] || {}; return `${t.id} ${t.q} → ${pick(t, v.pick)}${v.note ? ` (${v.note})` : ''}` })).join('\n')
      const out = $('#abOut'), btn = $('#abCopy')
      out.value = txt; out.hidden = false
      try { await navigator.clipboard.writeText(txt); btn.textContent = 'Copied' } catch { out.select(); btn.textContent = 'Copy the text below' }
      setTimeout(() => { btn.textContent = 'Copy my picks' }, 2400)
    })
  }

  // ---------- side nav + routing ----------
  function sideNav(tab) {
    const sec = $('#tab-' + tab)
    const items = tab === 'flow'
      ? [['fl-map', '', 'Route map'], ['fl-moves', '', 'Moving between screens']].concat(SECTIONS.map(([k, n]) => ['flow-' + k, k, n]))
      : $$('h2[id]', sec).map(h => [h.id, '', h.textContent])
    $('#sideNav').innerHTML = items.map(([id, k, t]) => `<a href="#${id}"><span class="k">${k}</span>${t}</a>`).join('')
  }
  let current = ''
  function show(tab) {
    if (tab !== current) {
      TABS.forEach(t => { $('#tab-' + t).hidden = t !== tab; $('#t-' + t).setAttribute('aria-selected', String(t === tab)) })
      sideNav(tab)
      current = tab
    }
    if (tab !== 'tweaks') twStop()
    if (tab === 'play') { if (!P.started) { P.started = true; pReset() } else pPlay(true) } else if (P.started) pPlay(false)
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1)) || 'overview'
    if (TABS.includes(h)) { show(h); window.scrollTo(0, 0); return }
    const el = document.getElementById(h)
    if (!el) { show('overview'); return }
    const tab = el.closest('.tab')
    show(tab ? tab.id.slice(4) : 'overview')
    requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }))
  }

  // In-page links go through location.hash. Hosts like htmlpreview add a <base> pointing at
  // raw GitHub, which would otherwise turn "#x" into a link to the page's source.
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]')
    const h = a && a.getAttribute('href')
    if (!h || h === '#') return
    e.preventDefault()
    if (e.metaKey || e.ctrlKey) return void window.open(location.href.split('#')[0] + h, '_blank', 'noopener')
    if (location.hash === h) route(); else location.hash = h
  })

  buildFlow()
  buildMoments()
  buildBrand()
  buildToastLab()
  buildTweaks()
  watchMocks(document)
  window.addEventListener('hashchange', route)
  route()
})()
