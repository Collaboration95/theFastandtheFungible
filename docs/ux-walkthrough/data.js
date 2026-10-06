/* Content for the mockups. Claims, prices, judgments and hashes come from a real
   fixture run (npm run demo, 5 Oct 2026). Verdict sentences are proposed copy:
   the research prompt would ask the LLM for a one-sentence direct answer first. */
window.RA = {
  question: "Can Vertex Compute’s announced 600 MW Johor–Singapore expansion actually be operating by 2028?",
  short: 'Vertex 600 MW by 2028?',
  budget: 2.0,
  cap: 1.0,
  threshold: 0.2,

  // 18 sources from the three publisher profiles. tier: free | paid
  sources: [
    { id: 'gor', pub: 'Grid Operators Report', mono: 'GO', title: 'Capacity and energisation audit', tier: 'paid', price: 0.8, profile: 'grid-research' },
    { id: 'cr', pub: 'Harbour Demand Observatory', mono: 'HD', title: 'Customer reservation register', tier: 'free', profile: 'public-records' },
    { id: 'cs', pub: 'Silverbay Component Exchange', mono: 'SC', title: 'Compute component supply bulletin', tier: 'free', profile: 'public-records' },
    { id: 'eo', pub: 'Copperleaf Procurement Registry', mono: 'CP', title: 'Equipment orderbook extract', tier: 'free', profile: 'public-records' },
    { id: 'ws', pub: 'Estuary Compute Survey', mono: 'EC', title: 'Regional workload survey', tier: 'free', profile: 'public-records' },
    { id: 'gs', pub: 'GridScope Asia', mono: 'GS', title: 'Connection schedule investigation', tier: 'paid', price: 1.4, profile: 'grid-research' },
    { id: 'nw', pub: 'Northstar Wire', mono: 'NW', title: 'Supplier lead-time report', tier: 'paid', price: 0.2, profile: 'supplier-wire' },
    { id: 'cn', pub: 'Circuit Note', mono: 'CN', title: 'Supplier digest', tier: 'paid', price: 0.3, profile: 'supplier-wire', rewriteOf: 'Northstar Wire' },
    { id: 'vc', pub: 'Vertex Compute', mono: 'VC', title: 'Vertex expansion announcement', tier: 'free', profile: 'public-records' },
    { id: 'cd', pub: 'Campus Digest', mono: 'CD', title: 'Summary of the Vertex release', tier: 'free', profile: 'public-records', rewriteOf: 'Vertex Compute' },
    { id: 'st', pub: 'Strait Tech Brief', mono: 'ST', title: 'Summary of the Vertex release', tier: 'free', profile: 'public-records', rewriteOf: 'Vertex Compute' },
    { id: 'fl', pub: 'Forge Lantern Manufacturing', mono: 'FL', title: 'Supplier delivery ledger', tier: 'free', profile: 'public-records' },
    { id: 'rc', pub: 'Raincoil Engineering Review', mono: 'RE', title: 'Cooling equipment field study', tier: 'free', profile: 'public-records' },
    { id: 'mb', pub: 'Mossbank Capital Archive', mono: 'MC', title: 'Construction financing memorandum', tier: 'free', profile: 'public-records' },
    { id: 'bw', pub: 'Brickfern Workforce Institute', mono: 'BW', title: 'Construction labour register', tier: 'free', profile: 'public-records' },
    { id: 'jm', pub: 'Juniper Market Ledger', mono: 'JM', title: 'Regional lease demand comparison', tier: 'free', profile: 'public-records' },
    { id: 'ts', pub: 'Tamarind Systems Lab', mono: 'TS', title: 'Equipment acceptance checklist', tier: 'free', profile: 'public-records' },
    { id: 'fp', pub: 'Fernpath Infrastructure Blog', mono: 'FB', title: 'Phased campus procurement commentary', tier: 'free', profile: 'public-records' },
  ],

  // Stable per-run citation numbers, shared by the UI and the PDF.
  claimsV1: [
    { n: 1, src: 'cr', stance: 'u', text: 'Independent customer records show reservations for 420 MW of the announced 600 MW programme.' },
    { n: 2, src: 'cs', stance: 'u', text: 'Distributors have reserved accelerator and networking batches for the initial Vertex halls.' },
    { n: 3, src: 'cs', stance: 'u', text: 'Component arrivals are planned in 2027 and remain separate from building acceptance.' },
    { n: 4, src: 'cr', stance: 'u', text: 'Reservations support demand for phased capacity but remain conditional on service delivery.' },
    { n: 5, src: 'ws', stance: 'u', text: 'A survey of 36 enterprise buyers reports sustained demand for regional compute through 2028.' },
    { n: 6, src: 'ws', stance: 'u', text: 'The survey measures customer intentions and does not establish when the campuses can operate.' },
    { n: 7, src: 'eo', stance: 'u', text: 'Purchase orders reserve transformers and switchgear for the first 240 MW of Vertex capacity.' },
    { n: 8, src: 'eo', stance: 'u', text: 'Component delivery windows run from late 2026 to mid 2027, before installation and acceptance testing.' },
  ],
  claimsV2: [
    { n: 9, src: 'gor', stance: 'c', isNew: true, text: 'Only 240 of the announced 600 MW has a confirmed energisation slot before 2028.' },
    { n: 10, src: 'gor', stance: 'c', isNew: true, text: 'Substation works for the remaining phases have slipped 14 months beyond the earlier programme.' },
    { n: 11, src: 'gor', stance: 'u', isNew: true, text: 'The confirmed slots support partial operation, not the full 600 MW operating by 2028.' },
    { n: 1, src: 'cr', stance: 'u', text: 'Independent customer records show reservations for 420 MW of the announced 600 MW programme.' },
    { n: 2, src: 'cs', stance: 'u', text: 'Distributors have reserved accelerator and networking batches for the initial Vertex halls.' },
    { n: 3, src: 'cs', stance: 'u', text: 'Component arrivals are planned in 2027 and remain separate from building acceptance.' },
    { n: 4, src: 'cr', stance: 'u', text: 'Reservations support demand for phased capacity but remain conditional on service delivery.' },
    { n: 5, src: 'ws', stance: 'u', text: 'A survey of 36 enterprise buyers reports sustained demand for regional compute through 2028.' },
  ],
  removedInV2: [6, 7, 8],

  verdictV1: 'Not yet clear. Free sources show real demand [1] and equipment on order [7], but none of them says when the grid can energise the campuses.',
  verdictV2: 'Only partly. 240 of the 600 MW has a confirmed grid slot before 2028 [9], and substation works for the rest have slipped 14 months [10].',
  gap: 'No accessible evidence on grid energisation.',
  impact: { kind: 'QUALIFIES', line: 'The bought audit narrows the answer from “unclear” to “240 MW, not 600 MW”.' },

  // Decision round 1, values from the fixture decision provider.
  candidates: [
    { id: 'gor', name: 'Grid Operators Report', price: 0.8, addr: 0.9, orig: 0.9, rewrite: 0.03, cred: 2, value: 0.729, vpd: 0.911, verdict: 'BUY', why: 'Covers the gap, original reporting, under the cap' },
    { id: 'gs', name: 'GridScope Asia', price: 1.4, addr: 0.9, orig: 0.9, rewrite: 0.03, cred: 2, value: 0.729, vpd: 0.521, verdict: 'OVER_CAP', why: 'S$1.40 is over the S$1.00 per-source cap' },
    { id: 'nw', name: 'Northstar Wire', price: 0.2, addr: 0.08, orig: 0.9, rewrite: 0.03, cred: 2, value: 0.065, vpd: 0.324, verdict: 'LOW_VALUE', why: 'Covers only 8% of the grid question' },
    { id: 'cn', name: 'Circuit Note', price: 0.3, addr: 0.08, orig: 0.02, rewrite: 0.96, cred: 1, value: 0.001, vpd: 0.004, verdict: 'REWRITE', why: 'A rewrite of Northstar Wire (96%)' },
  ],
  gapMaterial: 0.9,
  quoteHash: '49027fda01dc8cbbd0fcd5cf578055cfe1454dff3d257294c69b8be9339cd1a0',
  digest: 'b11dd65c0ebafa23d0a1a7f32c5186d8bb4c9beb025954880bd8214b82a980c3',

  passage: [
    'Grid Operators Report: capacity and energisation audit. This is a synthetic October 2026 research record about the fictional Vertex Compute 600 MW Johor–Singapore expansion. All organisations, interviews and figures are invented for the ResearchAgent demonstration.',
    '§Only 240 of the announced 600 MW has a confirmed energisation slot before 2028.',
    'Substation works for the remaining phases have slipped 14 months beyond the earlier fictional programme.',
    'The confirmed slots support partial operation, not the full 600 MW operating by 2028.',
    'The fictional Lattice Strait Operator Council compares its dated connection queue with campus phase identifiers. Fourteen invented grid planners describe prerequisites for energisation, and the audit checks records for 23 sites.',
  ],

  // Trace, as the server records it. t = seconds since ask (paced replay).
  trace: [
    [0.0, 'SEARCH', 'Searching 3 publisher profiles'],
    [0.4, 'READ_FREE', 'Reading 14 free sources'],
    [1.9, 'ANSWER', 'Writing answer v1 (8 claims)'],
    [4.6, 'DECIDE', 'Round 1 · scoring 4 paywalled sources'],
    [5.4, 'BUY', 'Policy chose Grid Operators Report · S$0.80'],
    [5.5, 'WIRE', 'GET …/grid-operators-report/v1/content → 402'],
    [5.6, 'WIRE', 'POST /v1/quotes → 200'],
    [5.7, 'PURCHASE', 'Reserved S$0.80'],
    [5.9, 'WIRE', 'POST /v1/settlements → 200'],
    [6.1, 'WIRE', 'GET …/grid-operators-report/v1/content → 200'],
    [6.2, 'GRANT', 'sha-256 verified'],
    [6.3, 'ANSWER', 'Rewriting with verified evidence (v2)'],
    [9.0, 'DECIDE', 'Round 2 · no material gap'],
    [9.4, 'DONE', 'Stopped: nothing clears the bar'],
  ],
}
