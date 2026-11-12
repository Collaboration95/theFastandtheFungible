// Authored copy for /progress/ ("Since SingHacks"). Every number on the page is
// resolved by scripts/build-progress-data.mjs from git, gh or a committed evidence
// file; this module only holds words and pointers to those sources. A pointer that
// does not resolve stops the build.

export const REPO = 'https://github.com/Collaboration95/theFastandtheFungible'
export const SITE = 'https://collaboration95.github.io/theFastandtheFungible/'
// Counting starts the day after SingHacks (19–20 Sep 2026, per the submission deck).
export const SINCE = { date: '2026-09-21', label: '21 Sep 2026' }
export const EVENT = { label: '19–20 Sep 2026', ref: 'hackathon-baseline' }
export const TZ_OFFSET_HOURS = 8 // Singapore time for every day bucket

// Early milestones before the tagged releases. `date` is resolved from the named source.
export const milestones = [
  {
    id: 'singhacks',
    date: { fixed: '2026-09-20', source: 'docs/submission/deck/index.html', mustInclude: '<div class="crit">Progress since SingHacks · <!--f:event-->19–20 Sep 2026<!--/f--></div>' },
    label: '19–20 Sep',
    title: 'SingHacks: the prototype',
    summary: 'The prototype that took us to the finals: one web page, synthetic sources, a language model proposing what to buy, and a person approving every quote.',
    bullets: [
      'A research desk that bought synthetic premium sources within an XRP budget and wrote a cited dossier.',
      'A language model proposed each purchase and a person approved every quote before payment (manual approval was required in the event build); payment was a simulated by default, with optional development-network settlement.',
      { template: 'The frozen prototype held {baseline.files} files and {baseline.codeLines} lines of code (tag hackathon-baseline).' },
    ],
    image: { tag: 'hackathon-baseline', path: 'prototypes/ResearchAgent/assets/research-agent-dossier.png', alt: 'The SingHacks prototype: a verified dossier page with supporting and challenging evidence', caption: 'Prototype dossier, from the hackathon-baseline tag' },
    proofs: [{ label: 'Prototype tag', ref: 'tree/hackathon-baseline' }],
  },
  {
    id: 'first-testnet',
    date: { pr: 101 },
    title: 'First payment on the XRP Ledger',
    summary: 'Writers were paid at their own development-network wallets, and the run showed the ledger entry.',
    bullets: [
      'Each writer gets its own development-network wallet and is paid there directly.',
      'The run shows the ledger transaction instead of a simulated receipt.',
      'Ledger links and receipts make each recorded payment inspectable.',
    ],
    image: { path: 'site/evolution/img/ui-oct5.jpg', alt: 'The October app: a question box with a budget and suggested questions', caption: 'The app in early October' },
    proofs: [{ label: 'Pull request', pr: 101 }, { label: 'Wallet per writer', pr: 103 }],
  },
  {
    id: 'policy',
    date: { tag: 'known-good-2026-10-08' },
    title: 'Code decides what to buy, inside your budget',
    summary: 'Purchases moved from the language model to deterministic policy code, inside a budget set once.',
    bullets: [
      'A neutral search across every listed writer instead of an allowlist of sites.',
      'A decision model scores each article; only policy code can make the purchase.',
      'A five-second plan card confirms the plan; no pop-up interrupts each purchase.',
    ],
    image: { path: 'site/evolution/img/ui-oct9.jpg', alt: 'The app on 9 October with a budget picker and suggested questions', caption: 'The app on 9 October' },
    proofs: [{ label: 'Checkpoint tag', ref: 'tree/known-good-2026-10-08' }, { label: 'Design record', path: 'docs/FINAL-PUSH.md' }],
  },
  {
    id: 'ait',
    date: { fixed: '2026-10-10', source: 'docs/FINAL-PUSH.md', mustInclude: 'AI Tinkerers Singapore demo on 10 Oct' },
    title: 'AI Tinkerers Singapore talk',
    summary: 'An on-stage demo of the October build for AI Tinkerers Singapore, a separate chapter from the finals.',
    bullets: [
      'The refund story on stage: a bought article breaks its promise and the money comes back.',
      'The October build log, replayed from git and the coding agents\' logs, is kept as an archive.',
      'The talk deck and speaker notes stay on this site.',
    ],
    image: { path: 'site/evolution/img/stage.jpg', alt: 'The ResearchAgent demo on stage at AI Tinkerers Singapore', caption: 'On stage, 10 October' },
    proofs: [{ label: 'October build log', site: 'evolution/' }, { label: 'Talk slides', site: 'slides/' }],
  },
]

// Release copy. Bullets come from CHANGELOG.md; this adds a plain-English title
// where the GitHub release name is only a version, and one image or terminal excerpt.
export const releases = {
  'v0.1.0': { title: 'Any agent can search and buy', snippet: { path: 'docs/mcp.md', fence: 0, caption: 'Connect Claude Code (docs/mcp.md, current release line)' } },
  'v0.2.0': { image: { path: 'docs/design/before/01-home.jpg', alt: 'App home with a question box, a budget and three example questions', caption: 'App home before the v0.5.0 redesign' } },
  'v0.3.0': { image: { path: 'docs/design/before/08-decisions-open.jpg', alt: 'The decisions panel listing each article the agent considered and why', caption: 'Decisions panel with the fact menu' } },
  'v0.4.0': { image: { release: 'v0.4.0', asset: 'macos-uc2.png', alt: 'The installed Mac app showing a completed answer', caption: 'Installed Mac app, from the v0.4.0 release assets' } },
  'v0.5.0': { image: { path: 'docs/design/after/05-running-buying.jpg', alt: 'A run in progress: the payments rail shows a purchase being made within the budget', caption: 'Buying, with spend shown against the budget' } },
  'v0.6.0': { image: { path: 'docs/design/ux2/12-uc3-done.jpg', alt: 'A finished answer with the lead finding, one refunded and one verified purchase', caption: 'Finished answer: one kept, one refunded' } },
  'v0.7.0': { snippet: { path: 'docs/evidence/round4-j2/python-verifier.txt', caption: 'Offline verifier output (Python), recorded 7 Nov' } },
  'v0.8.0': { image: { path: 'docs/evidence/settings/connect-an-agent.png', alt: 'Settings page: connect an agent with its own capped allowance', caption: 'Connect an agent with its own allowance (Settings, captured 7 Nov)' }, tx: { path: 'docs/evidence/agents-280.md' } },
  'v1.0.0-rc.1': { title: 'Fair exchange: the writer is paid by publishing the key', image: { path: 'docs/evidence/u1-ux/after/1440x900/15-testnet-key-reveal-done.jpg', alt: 'A finished development-network run: escrow created, writer published the key, the hash matches, the article decrypts', caption: 'Key-reveal run on development-network (captured 7 Nov)' }, tx: { ledger: 'keyReveal' } },
  'v1.0.0-rc.2': { title: 'Real development-network without cloning the repo', image: { path: 'docs/evidence/settings/zero-clone-cap-audited.png', alt: 'The zero-clone development-network app with an audited budget change', caption: 'Zero-clone development-network app, budget change audited (captured 7 Nov)' } },
  'v1.0.0': { title: 'One command to a verified purchase', snippet: { path: 'docs/evidence/round4-j2/try-output.txt', lines: [1, 7], tail: 1, caption: 'try --testnet, cold run (docs/evidence/round4-j2)' }, tx: { path: 'docs/evidence/round4-j2/try-output.txt' } },
  'v1.0.1': { title: 'Answers lead with the fact you paid for', image: { path: 'docs/evidence/u1-ux/after/1440x900/06-answer.jpg', alt: 'An answer whose first sentence is the purchased fact, with its citation', caption: 'Answer-first layout (captured 7 Nov)' } },
  'v1.0.2': { title: 'Honest states for anchors and no-purchase runs', image: { path: 'docs/evidence/r5-k/decline-state.png', alt: 'A no-purchase run listing each article considered and why none cleared the value bar', caption: 'A no-purchase run explains each decision (captured 7 Nov, before the v1.0.2 anchor label)' } },
  'v1.1.0': { title: 'A hosted demo for judges, and receipts that verify from it', image: { path: 'docs/media/readme-answer.png', alt: 'A hosted-demo answer on XRP Ledger next to its payment card: each article paid by key reveal, every step linked to its transaction', caption: 'Hosted demo, XRP Ledger, 11 Nov' } },
  'v1.1.1': { title: 'First-click fixes and hosted receipt verification', snippet: { path: 'docs/submission/evidence/v1.1.1/verify-python.txt', caption: 'Published v1.1.1 Python wheel checking the committed hosted export, read-only development-network, 11 Nov' } },
}

// Then → now. `prs` resolve to the merge date and the first release tag containing them.
export const capabilities = [
  { name: 'Who decides to buy', then: 'A language model proposed; a person approved every quote', now: 'Policy code buys within the budget you set, after one plan confirmation; a decision model only scores', prs: [], tag: 'known-good-2026-10-08', evidence: 'docs/FINAL-PUSH.md' },
  { name: 'Payment', then: 'A simulated by default; development-network optional', now: 'Each writer paid at its own development-network wallet, one charge per intent', prs: [101, 103] },
  { name: 'Agents', then: 'One web page', now: 'An MCP server any agent can reach by URL, an x402 paid endpoint and TypeScript and Python SDKs', prs: [266, 333, 523, 538] },
  { name: 'Refunds', then: 'None', now: 'Quality refunds need the writer’s signature (cooperative); no-show refunds use automatic EscrowCancel after the deadline', prs: [308] },
  { name: 'Mac app', then: 'None', now: 'An installable Mac app with keys in the Keychain (unsigned)', prs: [303] },
  { name: 'Proof', then: 'Citations checked inside the app', now: 'An offline verifier anyone can run, a protocol model, simulated crash schedules, and a large batch of real purchases each re-read from a public node', prs: [322, 530, 533] },
  { name: 'Sources', then: 'Synthetic sources only', now: 'The real XRPL and x402 documentation, plus ledger reports signed to a validated ledger', prs: [527, 536, 537] },
  { name: 'Writers', then: 'Team-run only', now: 'Anyone can publish a folder of notes, or a note from a phone through moderation, as a paid writer', prs: [300, 389, 532] },
  { name: 'Fair exchange', then: 'Pay first, then read', now: 'Key-reveal escrow: the writer is paid only by publishing the key', prs: [369] },
  { name: 'Stablecoin path', then: 'XRP only', now: 'Token escrow in TEST-SGD, our stand-in: official RLUSD issuers have escrow locking off, so RLUSD cannot be escrowed yet', prs: [381, 384, 525] },
  { name: 'Audit trail', then: 'None', now: 'Validated answer anchors are recorded on the ledger, even when nothing is bought; pending or unavailable anchors are labelled', prs: [366, 403] },
  { name: 'First try', then: 'Clone, install, add a model key', now: 'One npx command ends in RESULT PASS with six ledger links', prs: [387] },
]

// Failures kept on purpose. Each `measure` reads committed evidence; see the builder.
export const misses = [
  { id: 'try-cold', kind: 'Missed', title: 'Two of four cold first-try runs overran 90 seconds', did: 'Kept the timeouts beside the passes; the 90 s limit stayed unchanged.', source: 'docs/evidence/round4-j2/README.md' },
  { id: 'heldout', kind: 'Measured', title: 'Most v4 blind held-out questions did not end in a purchase', did: 'Reported the blind number instead of the dev bank, then froze and ran a new blind bank (v5, 11 Nov).', source: 'docs/evidence/v4-heldout/README.md' },
  { id: 'v2-superseded', kind: 'Superseded', title: 'We replaced our own better-looking number', did: 'The v2 held-out score was written after the team notes; a blind v4 bank replaced it everywhere.', source: 'docs/evidence/j5-coverage/README.md' },
  { id: 'soak', kind: 'Missed', title: 'The loaded-host soak failed its loop-delay gate', did: 'Kept the failure; a quiet-host rerun passed all five gates. No threshold changed.', source: 'docs/evidence/soak-nov4-ab/README.md' },
  { id: 'iou-cold', kind: 'Missed', title: 'First stablecoin-escrow start was slow', did: 'Show provisioning progress in the app; the target stays.', source: 'docs/evidence/r5-a/README.md' },
  { id: 'threshold', kind: 'Missed', title: 'No buy threshold met the waste ceiling', did: 'Kept the default 0.20 and recorded that no value passes every constraint.', source: 'docs/evidence/p1-threshold/README.md' },
  { id: 'fact-menu', kind: 'Regressed', title: 'Signed fact menus raised wasted spend', did: 'Shipped the better selection, logged the regression and opened a follow-up.', source: 'CHANGELOG.md' },
]

export const next = [
  { status: 'Done', title: 'Hosted sandbox for judges, 13–19 Nov', body: 'A public web version on development-network, live since 11 Nov, so nothing needs installing.' },
  { status: 'Next', id: 'v5', title: 'Blind held-out v5', body: null },
  { status: 'Next', title: 'Publish to npm, PyPI and the MCP Registry', body: 'Packages are built and tested from a clean install on GitHub Releases; registry publishing comes next.' },
  { status: 'Not claimed', title: 'Mainnet', body: 'See the README Status and limits for deployment readiness.' },
  { status: 'Not claimed', id: 'writers', title: 'Independent writers', body: null },
  { status: 'Not claimed', title: 'A signed Mac app', body: 'The DMG is unsigned and not notarised.' },
]
