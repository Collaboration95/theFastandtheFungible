import { mkdir, writeFile } from 'node:fs/promises'

const OUT = new URL('./', import.meta.url)
const EXPORTS = new URL('./exports/', OUT)
const now = 1789755000000
const elements = []
let seq = 0

const theme = {
  newsprint: '#f2e9dd',
  paper: '#fbf8f2',
  paperDeep: '#e9dfd1',
  ink: '#24211e',
  charcoal: '#171716',
  muted: '#655d55',
  rule: '#c9bfb2',
  salmon: '#d9a28f',
  salmonDeep: '#91503f',
  green: '#2f6b4f',
  ochre: '#9a6b20',
  red: '#9b3e35',
  blue: '#2f6fd6',
  white: '#fffdf8',
}

function id(prefix) {
  seq += 1
  return `ux01_${prefix}_${seq}`
}

function base(idValue, type, x, y, width, height, opts = {}) {
  return {
    id: idValue,
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: opts.strokeColor ?? theme.ink,
    backgroundColor: opts.backgroundColor ?? 'transparent',
    fillStyle: 'solid',
    strokeWidth: opts.strokeWidth ?? 1,
    strokeStyle: opts.strokeStyle ?? 'solid',
    roughness: 0,
    opacity: opts.opacity ?? 100,
    groupIds: [],
    frameId: null,
    index: `a${String(seq).padStart(4, '0')}`,
    roundness: opts.roundness === false ? null : { type: 3 },
    seed: 100000 + seq,
    version: 1,
    versionNonce: 200000 + seq,
    isDeleted: false,
    boundElements: [],
    updated: now,
    link: null,
    locked: false,
    customData: opts.customData ?? { codex: { role: opts.role ?? 'wireframe', issue: 'UX-01' } },
  }
}

function rect(x, y, width, height, opts = {}) {
  const item = base(id(opts.id ?? 'rect'), 'rectangle', x, y, width, height, opts)
  elements.push(item)
  return item
}

function text(x, y, value, opts = {}) {
  const lines = String(value).split('\n')
  const fontSize = opts.fontSize ?? 18
  const width = opts.width ?? Math.max(40, ...lines.map((line) => line.length * fontSize * 0.56))
  const height = opts.height ?? lines.length * fontSize * 1.25
  const item = base(id(opts.id ?? 'text'), 'text', x, y, width, height, opts)
  item.strokeColor = opts.color ?? theme.ink
  item.backgroundColor = opts.backgroundColor ?? 'transparent'
  item.text = String(value)
  item.fontSize = fontSize
  item.fontFamily = opts.fontFamily ?? (opts.mono ? 3 : 2)
  item.textAlign = opts.textAlign ?? 'left'
  item.verticalAlign = opts.verticalAlign ?? 'top'
  item.containerId = null
  item.originalText = String(value)
  item.autoResize = true
  item.lineHeight = 1.25
  elements.push(item)
  return item
}

function arrow(x, y, dx, dy, opts = {}) {
  const item = base(id(opts.id ?? 'arrow'), 'arrow', x, y, dx, dy, {
    ...opts,
    strokeWidth: opts.strokeWidth ?? 2,
    strokeStyle: opts.strokeStyle ?? 'solid',
    backgroundColor: 'transparent',
    roundness: false,
  })
  item.points = [[0, 0], [dx, dy]]
  item.lastCommittedPoint = null
  item.startBinding = null
  item.endBinding = null
  item.startArrowhead = null
  item.endArrowhead = 'arrow'
  item.elbowed = false
  elements.push(item)
  return item
}

function chip(x, y, label, color = theme.green, width = 130) {
  rect(x, y, width, 28, { backgroundColor: color, strokeColor: color, roundness: true, strokeWidth: 1 })
  text(x + 10, y + 6, label, { fontSize: 12, color: theme.white, mono: true, width: width - 20 })
}

function button(x, y, label, opts = {}) {
  const width = opts.width ?? Math.max(120, label.length * 8 + 28)
  rect(x, y, width, 36, { backgroundColor: opts.fill ?? theme.ink, strokeColor: opts.stroke ?? theme.ink, roundness: true })
  text(x + 12, y + 9, label, { fontSize: 13, color: opts.color ?? theme.white, mono: opts.mono ?? false, width: width - 24 })
  return width
}

function lineLabel(x, y, label, color = theme.muted) {
  text(x, y, label, { fontSize: 12, color, mono: true, width: 230 })
}

function card(x, y, width, height, title, body, opts = {}) {
  rect(x, y, width, height, { backgroundColor: opts.fill ?? theme.white, strokeColor: opts.stroke ?? theme.rule, roundness: true })
  text(x + 16, y + 14, title, { fontSize: opts.titleSize ?? 16, color: opts.titleColor ?? theme.ink, fontFamily: opts.serif ? 4 : 2, width: width - 32 })
  text(x + 16, y + 44, body, { fontSize: opts.bodySize ?? 13, color: opts.bodyColor ?? theme.muted, mono: opts.mono ?? false, width: width - 32 })
}

function annotation(view, x, y, width, content) {
  rect(x, y, width, 104, { backgroundColor: theme.paperDeep, strokeColor: theme.rule, roundness: true, role: 'annotation' })
  text(x + 14, y + 12, `ANNOTATION · ${view}`, { fontSize: 11, color: theme.salmonDeep, mono: true, width: width - 28 })
  text(x + 14, y + 34, content, { fontSize: 12, color: theme.ink, width: width - 28 })
}

const views = [
  { key: 'landing', title: '01 · LANDING', subtitle: 'Question → sources → evidence', x: 90, y: 300 },
  { key: 'wallet', title: '02 · WALLET + MANDATE', subtitle: 'Local funding boundary', x: 1220, y: 300 },
  { key: 'plan', title: '03 · APPROACH + PLAN', subtitle: 'Editable research contract', x: 2350, y: 300 },
  { key: 'workspace', title: '04 · EVIDENCE WORKSPACE', subtitle: 'Answer, gaps, and families', x: 3480, y: 300 },
  { key: 'compare', title: '05 · ARTICLE COMPARISON', subtitle: 'Value before purchase', x: 4610, y: 300 },
  { key: 'purchase', title: '06 · PURCHASE CHECKPOINT', subtitle: 'Human approval gate', x: 90, y: 1550 },
  { key: 'impact', title: '07 · IMPACT DIFF', subtitle: 'What paid evidence changed', x: 1220, y: 1550 },
  { key: 'dossier', title: '08 · DOSSIER', subtitle: 'Cited analyst output', x: 2350, y: 1550 },
  { key: 'receipt', title: '09 · EVIDENCE RECEIPT', subtitle: 'Auditable export', x: 3480, y: 1550 },
  { key: 'history', title: '10 · HISTORY / LIBRARY', subtitle: 'Local revisit shell', x: 4610, y: 1550 },
]

const W = 980
const H = 940

function shell(view) {
  const { x, y } = view
  rect(x, y, W, H, { backgroundColor: theme.paper, strokeColor: theme.ink, strokeWidth: 2, roundness: true, role: 'view', customData: { codex: { role: 'official-view', view: view.key, issue: 'UX-01' } } })
  rect(x, y, W, 76, { backgroundColor: theme.charcoal, strokeColor: theme.charcoal, roundness: true })
  text(x + 18, y + 14, 'RESEARCHAGENT', { fontSize: 17, color: theme.salmon, mono: true, width: 220 })
  text(x + 18, y + 40, view.title, { fontSize: 15, color: theme.white, mono: true, width: 480 })
  text(x + 590, y + 20, view.subtitle, { fontSize: 12, color: '#aaa097', mono: true, width: 350, textAlign: 'right' })
  rect(x + 24, y + 99, 72, H - 134, { backgroundColor: theme.paperDeep, strokeColor: theme.rule, roundness: true })
  lineLabel(x + 39, y + 122, 'NAV')
  text(x + 39, y + 160, '⌂\n≡\n◎\n▣\n↺', { fontSize: 21, color: theme.salmonDeep, mono: true, width: 35 })
  text(x + 36, y + 285, 'DESK\nMAP\nDOSSIER\nRECEIPT\nLIBRARY', { fontSize: 10, color: theme.muted, mono: true, width: 50 })
  text(x + 116, y + 104, view.subtitle, { fontSize: 13, color: theme.muted, mono: true, width: 800 })
}

function renderLanding(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 160, 'What economic question\ndeserves a closer look?', { fontSize: 31, fontFamily: 4, width: 520 })
  text(x + 132, y + 240, 'Build a bounded evidence trail across open and paywalled\nfixture sources. You decide what gets purchased.', { fontSize: 14, color: theme.muted, width: 620 })
  rect(x + 132, y + 314, 600, 54, { backgroundColor: theme.white, strokeColor: theme.rule, roundness: true })
  text(x + 151, y + 332, 'e.g. Which grid constraints matter for 2028 delivery?', { fontSize: 14, color: theme.softMuted ?? '#94887c', width: 540 })
  button(x + 748, y + 323, 'Begin mandate →', { width: 180, fill: theme.ink })
  lineLabel(x + 132, y + 404, 'THE WORKFLOW')
  const steps = ['Question', 'Sources', 'Evidence', 'Approval', 'Dossier']
  steps.forEach((step, i) => {
    const sx = x + 132 + i * 148
    rect(sx, y + 438, 124, 54, { backgroundColor: i === 0 ? theme.salmon : theme.paperDeep, strokeColor: i === 0 ? theme.salmonDeep : theme.rule })
    text(sx + 12, y + 457, `${String(i + 1).padStart(2, '0')}  ${step}`, { fontSize: 13, color: theme.ink, mono: true, width: 110 })
  })
  card(x + 132, y + 532, 286, 112, 'Synthetic by default', 'Fixture publisher profiles\nNo live web crawl or real premium body.', { fill: '#f7efe5', titleColor: theme.salmonDeep })
  card(x + 438, y + 532, 286, 112, 'Manual by design', 'Nothing buys automatically.\nApproval is a visible checkpoint.', { fill: '#eef3ec', titleColor: theme.green })
  card(x + 744, y + 532, 208, 112, 'Cited output', 'Exact spans, family lineage,\nlicense + receipt.', { fill: '#f5f0e6', titleColor: theme.ochre })
  annotation('LANDING', x + 116, y + 694, 838, 'CONTENT: one question, trust boundary, five-step path. ACTIONS: begin mandate; keyboard focus remains visible. RESPONSIVE: at 768px collapse the rail and stack workflow cards; at 320px keep headline, input, and CTA in that order.')
}

function renderWallet(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 150, 'Choose a wallet boundary', { fontSize: 28, fontFamily: 4, width: 600 })
  text(x + 132, y + 198, 'Funding and purchase authority stay explicit and local.', { fontSize: 14, color: theme.muted, width: 600 })
  card(x + 132, y + 252, 350, 134, 'Partner Demo Wallet', 'Credential-free fixture balance\nS$2.00 research budget', { fill: '#eef3ec', titleColor: theme.green })
  chip(x + 148, y + 340, 'SELECTED', theme.green, 108)
  card(x + 500, y + 252, 352, 134, 'XRPL Testnet', 'Optional settlement path\nNo seed in browser or logs', { fill: '#f5f0e6', titleColor: theme.ochre })
  chip(x + 516, y + 340, 'OPTIONAL', theme.ochre, 108)
  lineLabel(x + 132, y + 424, 'MANDATE CAP')
  rect(x + 132, y + 456, 720, 160, { backgroundColor: theme.white, strokeColor: theme.rule, roundness: true })
  text(x + 156, y + 478, 'Research question\nAllowed source profiles\nPer-source ceiling\nExpires', { fontSize: 13, color: theme.muted, mono: true, width: 240 })
  text(x + 456, y + 478, 'Grid constraints for 2028\nInfrastructure specialists · market data\nS$1.00 maximum\n30 minutes from approval', { fontSize: 14, color: theme.ink, width: 350 })
  text(x + 132, y + 654, 'BALANCE  S$2.00   ·   NETWORK  PARTNER DEMO   ·   AUTO-BUY  OFF', { fontSize: 12, color: theme.green, mono: true, width: 650 })
  button(x + 700, y + 650, 'Review approach →', { width: 198 })
  annotation('WALLET + MANDATE', x + 116, y + 694, 838, 'CONTENT: selected wallet, network truth, balance, allowlist, cap, expiry. ACTIONS: choose wallet; edit cap; continue only after valid mandate. RESPONSIVE: stack wallet cards first; keep AUTO-BUY OFF and Testnet label visible without scrolling.')
}

function renderPlan(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 150, 'Shape the research approach', { fontSize: 27, fontFamily: 4, width: 600 })
  chip(x + 746, y + 150, 'DRAFT', theme.salmonDeep, 90)
  text(x + 132, y + 200, 'The plan is editable before any source is inspected or bought.', { fontSize: 14, color: theme.muted, width: 700 })
  lineLabel(x + 132, y + 252, 'QUESTION')
  rect(x + 132, y + 282, 720, 50, { backgroundColor: theme.white, strokeColor: theme.rule, roundness: true })
  text(x + 150, y + 299, 'Which constraints determine 2028 grid delivery?', { fontSize: 14, color: theme.ink, width: 660 })
  lineLabel(x + 132, y + 358, 'ORDERED APPROACH · DRAG HANDLE + KEYBOARD MOVE')
  const rows = [
    ['01', 'Open market baselines', 'independent baseline'],
    ['02', 'Infrastructure specialists', 'likely gap'],
    ['03', 'Paid comparison candidates', 'manual approval later'],
  ]
  rows.forEach((row, i) => {
    const ry = y + 390 + i * 58
    rect(x + 132, ry, 720, 46, { backgroundColor: i === 1 ? '#f7efe5' : theme.white, strokeColor: i === 1 ? theme.salmon : theme.rule, roundness: true })
    text(x + 148, ry + 14, row[0], { fontSize: 12, color: theme.salmonDeep, mono: true, width: 28 })
    text(x + 192, ry + 12, row[1], { fontSize: 14, color: theme.ink, width: 300 })
    text(x + 530, ry + 14, row[2], { fontSize: 12, color: theme.muted, mono: true, width: 260 })
    text(x + 820, ry + 13, '⋮⋮', { fontSize: 15, color: theme.muted, mono: true, width: 30 })
  })
  text(x + 132, y + 584, 'Plan checks  ·  source-family independence  ✓   ·   cap within mandate  ✓', { fontSize: 12, color: theme.green, mono: true, width: 700 })
  button(x + 682, y + 642, 'Save plan & inspect gaps →', { width: 270 })
  annotation('APPROACH + PLAN', x + 116, y + 694, 838, 'CONTENT: question, ordered source-family approach, gap intent, validation checks. ACTIONS: reorder with pointer or keyboard; save plan; revise before search. RESPONSIVE: table rows become stacked cards; drag handle gains an accessible keyboard alternative; primary CTA remains full width.')
}

function renderWorkspace(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 150, 'Evidence workspace', { fontSize: 27, fontFamily: 4, width: 600 })
  chip(x + 746, y + 150, 'LIVE WORKSPACE', theme.green, 150)
  card(x + 132, y + 204, 720, 116, 'Working answer · open-source baseline', 'Grid interconnection remains the gating constraint for delivery. [C1] [C2]\nCitations open source records and exact accessible spans.', { fill: theme.white, titleColor: theme.ink })
  rect(x + 132, y + 346, 720, 74, { backgroundColor: '#f7efe5', strokeColor: theme.salmon, roundness: true })
  text(x + 152, y + 363, 'EVIDENCE GAP', { fontSize: 11, color: theme.salmonDeep, mono: true, width: 200 })
  text(x + 152, y + 386, 'Regional queue lead times are not evidenced by an independent specialist.', { fontSize: 13, color: theme.ink, width: 650 })
  lineLabel(x + 132, y + 458, 'SOURCE FAMILIES · EXACT SPANS')
  card(x + 132, y + 490, 226, 130, 'Market data', 'Open · family A\n[C1] 2026 outlook span', { fill: '#eef3ec', titleColor: theme.green })
  card(x + 378, y + 490, 226, 130, 'Infrastructure', 'Premium · family B\nLocked until approval', { fill: '#f5f0e6', titleColor: theme.ochre })
  card(x + 624, y + 490, 228, 130, 'Policy', 'Open · family C\n[C2] interconnection rule', { fill: '#eef0f6', titleColor: theme.blue })
  text(x + 132, y + 654, '🔒 Premium body stays server-only · preview + metadata only until unlock', { fontSize: 12, color: theme.red, mono: true, width: 700 })
  annotation('EVIDENCE WORKSPACE', x + 116, y + 694, 838, 'CONTENT: working answer, evidence gap, family cards, exact span/citation affordances, locked premium state. ACTIONS: inspect family; open source record; continue to compare. RESPONSIVE: answer first, then gap, then cards; preserve lock/citation labels at 320px.')
}

function renderCompare(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 150, 'Which article closes the gap?', { fontSize: 27, fontFamily: 4, width: 640 })
  text(x + 132, y + 200, 'Ranked by expected evidence impact, not by price alone.', { fontSize: 14, color: theme.muted, width: 620 })
  const cards = [
    ['Northstar Markets', 'RECOMMENDED', theme.green, 'S$0.60', 'Adds independent\ncapacity benchmarks', 'family B · original'],
    ['GridScope Asia', 'ABOVE CAP', theme.red, 'S$1.40', 'High relevance, but\nmandate ceiling blocks', 'family B · original'],
    ['Energy Daily', 'REDUNDANT', theme.ochre, 'S$0.35', 'Repeats existing\nopen evidence', 'family A · dependent'],
  ]
  cards.forEach((item, i) => {
    const cx = x + 132 + i * 242
    card(cx, y + 272, 222, 290, item[0], `${item[3]}\n\n${item[4]}\n\n${item[5]}`, { fill: theme.white, titleColor: theme.ink, bodySize: 13 })
    chip(cx + 14, y + 518, item[1], item[2], item[1] === 'RECOMMENDED' ? 142 : item[1] === 'ABOVE CAP' ? 115 : 118)
    text(cx + 14, y + 588, 'Preview + license\nExact quote shown after approval', { fontSize: 11, color: theme.muted, mono: true, width: 190 })
  })
  text(x + 132, y + 654, 'DECISION RULE  ·  one source max  ·  same-family duplicates stay blocked', { fontSize: 12, color: theme.salmonDeep, mono: true, width: 650 })
  annotation('ARTICLE COMPARISON', x + 116, y + 694, 838, 'CONTENT: article preview, price, relevance/novelty, family lineage, license, and recommendation state. ACTIONS: inspect; choose one; skip or block redundant/over-cap sources. RESPONSIVE: cards stack with status chips above fold; keep price, cap, and family visible.')
}

function renderPurchase(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 150, 'Approve one purchase', { fontSize: 28, fontFamily: 4, width: 620 })
  chip(x + 746, y + 150, 'WAITING', theme.ochre, 100)
  text(x + 132, y + 200, 'This is the only place an article can be unlocked.', { fontSize: 14, color: theme.muted, width: 620 })
  rect(x + 132, y + 252, 720, 208, { backgroundColor: theme.white, strokeColor: theme.ink, strokeWidth: 2, roundness: true })
  text(x + 156, y + 276, 'Northstar Markets · The queue is the constraint', { fontSize: 18, color: theme.ink, fontFamily: 4, width: 620 })
  text(x + 156, y + 320, 'Exact quote      S$0.60\nRemaining cap   S$1.00\nWallet           Partner Demo Wallet\nLicense          local fixture / research preview', { fontSize: 13, color: theme.muted, mono: true, width: 360 })
  chip(x + 604, y + 324, 'PREMIUM LOCKED', theme.red, 150)
  text(x + 604, y + 370, 'Preview only.\nFull body is never\nclient-visible before\nsettlement + unlock.', { fontSize: 13, color: theme.red, width: 205 })
  rect(x + 132, y + 490, 720, 70, { backgroundColor: '#f7efe5', strokeColor: theme.salmon, roundness: true })
  text(x + 152, y + 507, 'MANUAL APPROVAL REQUIRED', { fontSize: 11, color: theme.salmonDeep, mono: true, width: 250 })
  text(x + 152, y + 530, 'No auto-buy · no silent retry · user must confirm exact quote and source.', { fontSize: 13, color: theme.ink, width: 630 })
  button(x + 132, y + 604, 'Approve & unlock', { width: 196, fill: theme.green })
  button(x + 342, y + 604, 'Skip for now', { width: 150, fill: theme.paperDeep, color: theme.ink, stroke: theme.rule })
  text(x + 132, y + 654, 'On error: quote expired / cap exceeded / settlement unavailable → remain locked and explain why.', { fontSize: 12, color: theme.red, mono: true, width: 720 })
  annotation('PURCHASE CHECKPOINT', x + 116, y + 694, 838, 'CONTENT: exact quote, remaining cap, wallet/network, license, locked state, approval language. ACTIONS: approve one, skip, or recover from a surfaced error; no automatic path. RESPONSIVE: keep approval + skip adjacent on desktop, stacked with error text above on mobile.')
}

function renderImpact(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 150, 'Evidence impact', { fontSize: 28, fontFamily: 4, width: 500 })
  chip(x + 742, y + 150, 'UNLOCKED', theme.green, 110)
  text(x + 132, y + 200, 'Only validated, cited spans can change the answer.', { fontSize: 14, color: theme.muted, width: 620 })
  lineLabel(x + 132, y + 256, 'CLAIM-LEVEL DIFF')
  card(x + 132, y + 288, 326, 244, 'BEFORE · open evidence', 'Delivery risk is material,\nbut timing is uncertain.\n\n[C1] [C2] exact spans\nfamily A + family C', { fill: '#f7efe5', titleColor: theme.salmonDeep })
  arrow(x + 480, y + 404, 90, 0, { strokeColor: theme.green, id: 'impact-change' })
  text(x + 488, y + 376, 'paid span\nvalidated', { fontSize: 11, color: theme.green, mono: true, width: 80, textAlign: 'center' })
  card(x + 608, y + 288, 244, 244, 'AFTER · cited', 'Regional queues\nshow an 18–36 month\nenergisation window.\n\n[C3] paid exact span\nfamily B · licensed', { fill: '#eef3ec', titleColor: theme.green })
  rect(x + 132, y + 570, 720, 76, { backgroundColor: theme.white, strokeColor: theme.rule, roundness: true })
  text(x + 152, y + 588, 'CHANGED CLAIM', { fontSize: 11, color: theme.green, mono: true, width: 180 })
  text(x + 152, y + 612, 'Timing moves from uncertain to bounded; price and license are recorded beside the span.', { fontSize: 13, color: theme.ink, width: 650 })
  annotation('IMPACT DIFF', x + 116, y + 694, 838, 'CONTENT: baseline, paid exact span, claim-level before/after, family and license lineage. ACTIONS: open citation; inspect source; continue to dossier. RESPONSIVE: stack BEFORE then AFTER with connector retained as text; do not rely on color alone for changed status.')
}

function renderDossier(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 150, 'Cited dossier', { fontSize: 28, fontFamily: 4, width: 500 })
  chip(x + 742, y + 150, 'READY', theme.green, 90)
  rect(x + 132, y + 210, 720, 370, { backgroundColor: theme.white, strokeColor: theme.rule, roundness: true })
  text(x + 160, y + 236, 'GRID DELIVERY · ANALYST MEMO', { fontSize: 11, color: theme.muted, mono: true, width: 500 })
  text(x + 160, y + 268, 'Interconnection timing is the\nprimary constraint for 2028 delivery.', { fontSize: 22, fontFamily: 4, width: 640 })
  text(x + 160, y + 356, 'The open evidence establishes demand and policy context [C1][C2].\nThe approved specialist source bounds the delivery window at 18–36 months [C3].\n\nKey uncertainty · project-specific queue position remains unresolved.\nMethod · fixture corpus; premium excerpt unlocked only after approval.', { fontSize: 13, color: theme.ink, width: 640 })
  rect(x + 160, y + 500, 640, 54, { backgroundColor: '#eef3ec', strokeColor: theme.green, roundness: true })
  text(x + 178, y + 518, 'Each citation opens source + exact span + license/family lineage.', { fontSize: 12, color: theme.green, mono: true, width: 600 })
  button(x + 132, y + 612, 'Export dossier', { width: 164, fill: theme.ink })
  button(x + 310, y + 612, 'Open receipt →', { width: 164, fill: theme.paperDeep, color: theme.ink, stroke: theme.rule })
  annotation('DOSSIER', x + 116, y + 694, 838, 'CONTENT: conclusion, claim-level citations, uncertainty, method, and premium access boundary. ACTIONS: open cited span; export; open receipt. RESPONSIVE: paper becomes one column; keep conclusion and uncertainty before long claim lists; export controls stay reachable by keyboard.')
}

function renderReceipt(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 150, 'Evidence Receipt', { fontSize: 28, fontFamily: 4, width: 580 })
  chip(x + 714, y + 150, 'VERIFIED', theme.green, 118)
  text(x + 132, y + 200, 'A compact, machine-readable record of what was evaluated and unlocked.', { fontSize: 14, color: theme.muted, width: 690 })
  rect(x + 132, y + 250, 720, 300, { backgroundColor: theme.white, strokeColor: theme.rule, roundness: true })
  text(x + 156, y + 274, 'RECEIPT ID  ER-2026-0107\nRUN           local-fixture-0042\nMANDATE       mnd_9a3… · cap S$1.00\nDECISION      approved one source\nSETTLEMENT    Partner Demo Wallet · simulated\nLICENSE       fixture research preview\nFAMILY        infrastructure specialists\nSPANS         C1, C2, C3 · exact offsets recorded', { fontSize: 13, color: theme.ink, mono: true, width: 650 })
  rect(x + 132, y + 580, 720, 68, { backgroundColor: '#f7efe5', strokeColor: theme.salmon, roundness: true })
  text(x + 152, y + 596, 'TRUTHFUL BOUNDARY', { fontSize: 11, color: theme.salmonDeep, mono: true, width: 220 })
  text(x + 152, y + 620, 'Fixture settlement is visibly non-real; premium body is excluded from receipt/export.', { fontSize: 12, color: theme.ink, width: 650 })
  button(x + 132, y + 688, 'Download JSON', { width: 156, fill: theme.ink })
  button(x + 302, y + 688, 'Print receipt', { width: 144, fill: theme.paperDeep, color: theme.ink, stroke: theme.rule })
  annotation('EVIDENCE RECEIPT', x + 116, y + 768, 838, 'CONTENT: receipt ID, mandate/quote hashes, settlement truth, license/family lineage, exact spans, and excluded premium body. ACTIONS: download JSON; print; revisit dossier. RESPONSIVE: key/value rows stack; keep truth boundary and export buttons above the fold on mobile.')
}

function renderHistory(v) {
  const { x, y } = v
  shell(v)
  text(x + 132, y + 150, 'History / library', { fontSize: 28, fontFamily: 4, width: 580 })
  button(x + 682, y + 146, '+ New research', { width: 170, fill: theme.ink })
  text(x + 132, y + 200, 'Local runs and receipts only. Clear reset never fabricates or deletes a receipt silently.', { fontSize: 14, color: theme.muted, width: 720 })
  const entries = [
    ['Grid delivery · 2028', 'DOSSIER READY · 2 sources · ER-2026-0107', theme.green],
    ['Battery storage pricing', 'OPEN BASELINE · no purchase · local-fixture-0039', theme.ochre],
    ['Hydrogen corridor risk', 'BLOCKED · cap exceeded · local-fixture-0034', theme.red],
  ]
  entries.forEach((entry, i) => {
    const ey = y + 260 + i * 92
    rect(x + 132, ey, 720, 70, { backgroundColor: theme.white, strokeColor: theme.rule, roundness: true })
    text(x + 154, ey + 15, entry[0], { fontSize: 15, color: theme.ink, width: 330 })
    text(x + 154, ey + 40, entry[1], { fontSize: 11, color: entry[2], mono: true, width: 500 })
    text(x + 790, ey + 25, '→', { fontSize: 20, color: theme.salmonDeep, width: 24 })
  })
  rect(x + 132, y + 566, 720, 82, { backgroundColor: theme.paperDeep, strokeColor: theme.rule, roundness: true })
  text(x + 154, y + 584, 'LOCAL STORAGE / RESET', { fontSize: 11, color: theme.muted, mono: true, width: 300 })
  text(x + 154, y + 608, 'Reset workspace  ·  preserve exported receipts  ·  start a clean run', { fontSize: 13, color: theme.ink, width: 580 })
  button(x + 132, y + 688, 'Open selected run', { width: 174, fill: theme.ink })
  annotation('HISTORY / LIBRARY', x + 116, y + 768, 838, 'CONTENT: local run list, dossier/receipt status, blocked/error history, reset boundary. ACTIONS: reopen, export, start new research, safe reset. RESPONSIVE: list rows become full-width cards; status text remains explicit; destructive reset requires confirmation and keyboard focus.')
}

views.forEach((view) => {
  if (view.key === 'landing') renderLanding(view)
  if (view.key === 'wallet') renderWallet(view)
  if (view.key === 'plan') renderPlan(view)
  if (view.key === 'workspace') renderWorkspace(view)
  if (view.key === 'compare') renderCompare(view)
  if (view.key === 'purchase') renderPurchase(view)
  if (view.key === 'impact') renderImpact(view)
  if (view.key === 'dossier') renderDossier(view)
  if (view.key === 'receipt') renderReceipt(view)
  if (view.key === 'history') renderHistory(view)
})

// Primary route: the ten official views read left-to-right, then wrap to the second row.
const primary = [
  [views[0], views[1], 'begin mandate'],
  [views[1], views[2], 'review approach'],
  [views[2], views[3], 'inspect gaps'],
  [views[3], views[4], 'compare candidates'],
  [views[4], views[5], 'choose one'],
  [views[5], views[6], 'approval → impact'],
  [views[6], views[7], 'synthesize'],
  [views[7], views[8], 'export receipt'],
  [views[8], views[9], 'save locally'],
]
primary.forEach(([from, to, label], i) => {
  const wrap = i === 4
  if (!wrap) {
    const startX = from.x + W + 10
    const startY = from.y + 252
    const endX = to.x - 12
    arrow(startX, startY, endX - startX, 0, { strokeColor: theme.salmonDeep, id: `primary-${i}` })
    text(startX + 8, startY - 28, label, { fontSize: 11, color: theme.salmonDeep, mono: true, width: 150 })
  } else {
    // Route around the error pills between rows so the wrap transition stays legible.
    const railX = 5680
    const railY = from.y + H + 160
    const targetX = to.x + 360
    const targetY = to.y - 12
    arrow(from.x + W + 10, from.y + H + 10, railX - (from.x + W + 10), 0, { strokeColor: theme.salmonDeep, id: 'primary-wrap-right' })
    arrow(railX, from.y + H + 10, 0, railY - (from.y + H + 10), { strokeColor: theme.salmonDeep, id: 'primary-wrap-down' })
    arrow(railX, railY, targetX - railX, 0, { strokeColor: theme.salmonDeep, id: 'primary-wrap-left' })
    arrow(targetX, railY, 0, targetY - railY, { strokeColor: theme.salmonDeep, id: 'primary-wrap-enter' })
    text(railX - 240, railY - 28, label, { fontSize: 11, color: theme.salmonDeep, mono: true, width: 220, textAlign: 'right' })
  }
})

// Error/recovery transitions are explicit and remain outside the happy path.
const errors = [
  ['landing', 'No question or source profile selected', 'landing-error'],
  ['wallet', 'Wallet unavailable / invalid mandate', 'wallet-error'],
  ['plan', 'Plan violates cap or family independence', 'plan-error'],
  ['workspace', 'Fixture retrieval partial / cite gap', 'workspace-error'],
  ['compare', 'Duplicate family / source above cap', 'compare-error'],
  ['purchase', 'Quote expired / settlement unavailable', 'purchase-error'],
  ['impact', 'Missing exact span / no changed claim', 'impact-error'],
  ['dossier', 'Unverified claim blocks export', 'dossier-error'],
  ['receipt', 'Local write unavailable / retry', 'receipt-error'],
  ['history', 'Reset requires confirmation', 'history-error'],
]
errors.forEach(([key, label, slug]) => {
  const view = views.find((item) => item.key === key)
  const ex = view.x + 116
  const ey = view.y + H + 20
  rect(ex, ey, 838, 58, { backgroundColor: '#fbeceb', strokeColor: theme.red, strokeStyle: 'dashed', roundness: true, role: 'error-state' })
  text(ex + 14, ey + 9, `ERROR / RECOVERY  ·  ${label}`, { fontSize: 12, color: theme.red, mono: true, width: 790 })
  arrow(view.x + 490, view.y + H - 118, 0, 124, { strokeColor: theme.red, strokeStyle: 'dashed', id: slug })
})

// Board title, legend, and review key.
rect(48, 44, 5600, 180, { backgroundColor: theme.charcoal, strokeColor: theme.charcoal, roundness: true, role: 'board-header' })
text(86, 70, 'ResearchAgent · official view contract', { fontSize: 32, color: theme.salmon, fontFamily: 4, width: 820 })
text(86, 122, 'UX-01 · editable Excalidraw wireframes · local paywalled-finance-research critique path', { fontSize: 14, color: theme.white, mono: true, width: 1200 })
text(3100, 76, 'READING KEY', { fontSize: 12, color: theme.salmon, mono: true, width: 220 })
text(3100, 108, 'salmon arrow  = primary path\nred dashed arrow = error / recovery\ncream note = content · action · responsive priority', { fontSize: 13, color: '#e9dfd1', mono: true, width: 480 })
text(4400, 76, 'NON-NEGOTIABLES', { fontSize: 12, color: theme.salmon, mono: true, width: 300 })
text(4400, 108, 'manual approval · locked premium body\nexact spans + license/family lineage\nfixture settlement + truthful Testnet labels', { fontSize: 13, color: '#e9dfd1', mono: true, width: 600 })

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function svgText(item) {
  const lines = item.text.split('\n')
  const font = item.fontFamily === 4 ? 'Georgia, serif' : item.fontFamily === 3 ? 'IBM Plex Mono, ui-monospace, monospace' : 'IBM Plex Sans, Arial, sans-serif'
  const anchor = item.textAlign === 'right' ? 'end' : item.textAlign === 'center' ? 'middle' : 'start'
  const x = item.textAlign === 'right' ? item.x + item.width : item.textAlign === 'center' ? item.x + item.width / 2 : item.x
  return `<text x="${x}" y="${item.y + item.fontSize}" fill="${item.strokeColor}" font-family="${font}" font-size="${item.fontSize}" text-anchor="${anchor}">${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : item.fontSize * 1.25}">${esc(line)}</tspan>`).join('')}</text>`
}

function renderSvg() {
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="5700" height="2900" viewBox="0 0 5700 2900" role="img" aria-labelledby="title desc">`, '<title id="title">ResearchAgent official UX-01 wireframes</title>', '<desc id="desc">Ten editable official product views with primary and error transitions.</desc>', `<rect width="5700" height="2900" fill="${theme.newsprint}"/>`, '<defs><marker id="arrow-salmon" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#91503f"/></marker><marker id="arrow-red" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#9b3e35"/></marker></defs>']
  for (const item of elements) {
    if (item.type === 'rectangle') {
      const dash = item.strokeStyle === 'dashed' ? ' stroke-dasharray="9 7"' : ''
      const radius = item.roundness ? 10 : 0
      out.push(`<rect x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" rx="${radius}" fill="${item.backgroundColor === 'transparent' ? 'none' : item.backgroundColor}" stroke="${item.strokeColor === 'transparent' ? 'none' : item.strokeColor}" stroke-width="${item.strokeWidth}"${dash}/>`)
    } else if (item.type === 'text') {
      out.push(svgText(item))
    } else if (item.type === 'arrow') {
      const color = item.strokeColor
      const dash = item.strokeStyle === 'dashed' ? ' stroke-dasharray="9 7"' : ''
      const marker = color === theme.red ? 'arrow-red' : 'arrow-salmon'
      out.push(`<line x1="${item.x}" y1="${item.y}" x2="${item.x + item.width}" y2="${item.y + item.height}" stroke="${color}" stroke-width="${item.strokeWidth}" marker-end="url(#${marker})"${dash}/>`)
    }
  }
  out.push('</svg>')
  return out.join('\n')
}

await mkdir(EXPORTS, { recursive: true })
const scene = {
  type: 'excalidraw',
  version: 2,
  source: 'codex-excalidraw-canvas',
  elements,
  appState: { viewBackgroundColor: theme.newsprint, currentItemFontFamily: 2, gridSize: 20, name: 'ResearchAgent official UX-01 views' },
  files: {},
}
await writeFile(new URL('./scene.excalidraw', OUT), JSON.stringify(scene, null, 2) + '\n')
await writeFile(new URL('./exports/official-researchagent-views.svg', OUT), renderSvg() + '\n')
