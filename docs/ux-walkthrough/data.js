/* Content for the mockups. Since v1.2 (9 Oct 2026) this is the real UC2 story on the
   final-push corpus: prices, probabilities and article text come from a live run on
   main (OpenAI Decisions, gpt-6-luna, threshold 0.20). The corpus is fictional and all
   money is SIMULATED SGD. Citation numbers, the one-sentence short answers and the
   plain-words verdict lines are proposed copy; the receipt hashes are placeholders. */
window.RA = {
  question: "What’s the analyst outlook on Kestrel Semiconductor’s latest deal with TSMC?",
  short: 'Kestrel–TSMC outlook',
  budget: 2.0,
  cap: 1.0,
  threshold: 0.2,
  buy: { id: 'nf', name: 'NotFinancialTimes', price: 0.9, title: 'Analysts cut Kestrel margin estimates as the TSMC deal lands' },
  counts: { found: 12, free: 8, paid: 4, more: 6 },

  // Sources of the run. tier: free | paid. Only the first six are drawn on the strip. The live run found 12 candidates (some writers twice); the four paid sources that matter are kept.
  sources: [
    { id: 'nf', pub: 'NotFinancialTimes', mono: 'NF', title: 'Analysts cut Kestrel margin estimates as the TSMC deal lands', tier: 'paid', price: 0.9, profile: 'notfinancialtimes' },
    { id: 'or1', pub: 'Open Records', mono: 'OR', title: 'Kestrel exchange filing: TSMC capacity agreement', tier: 'free', profile: 'open-records' },
    { id: 'or2', pub: 'Open Records', mono: 'OR', title: 'What a wafer-capacity prepayment is', tier: 'free', profile: 'open-records' },
    { id: 'or3', pub: 'Open Records', mono: 'OR', title: 'Kestrel exchange filings, 25 July 2026', tier: 'free', profile: 'open-records' },
    { id: 'ff', pub: 'The Fab Floor', mono: 'FF', title: 'Where Kestrel’s 24,000 wafers come from', tier: 'paid', price: 0.25, profile: 'the-fab-floor' },
    { id: 'kc', pub: 'Kopi Contrarian', mono: 'KC', title: 'Another ‘deal of the decade’', tier: 'paid', price: 0.1, profile: 'kopi-contrarian' },
    { id: 'mp', pub: 'MarketPulse Digest', mono: 'MP', title: 'Kestrel’s TSMC deal: analysts trim margins', tier: 'paid', price: 0.2, profile: 'marketpulse-digest', rewriteOf: 'NotFinancialTimes' },
  ],

  // Stable per-run citation numbers, shared by the UI and the PDF.
  claimsV1: [
    { n: 1, src: 'or1', stance: 's', text: 'On 29 September 2026 Kestrel announced a five-year agreement with TSMC for N3P wafer capacity.' },
    { n: 2, src: 'or1', stance: 's', text: 'The agreement covers 24,000 wafers a month from Q3 2027, up from 16,000 under the previous contract.' },
    { n: 3, src: 'or1', stance: 'u', text: 'Kestrel will pay a US$1.1 billion prepayment and gave no margin guidance.' },
    { n: 4, src: 'or2', stance: 'u', text: 'Advance payments to foundries are not new; they can be refundable or non-refundable.' },
    { n: 5, src: 'or3', stance: 'u', text: 'Kestrel’s gross margin was 48.7% in the June quarter, down from 51.2% a year earlier.' },
    { n: 6, src: 'or3', stance: 'u', text: 'Net revenue for the quarter was NT$142.3 billion; net income was NT$31.4 billion.' },
    { n: 7, src: 'or1', stance: 'u', text: 'The filing was published before the opening of trading.' },
    { n: 8, src: 'or2', stance: 'u', text: 'Public disclosures rarely include the full contract, so the terms are known only to the parties.' },
  ],
  claimsV2: [
    { n: 9, src: 'nf', stance: 'c', isNew: true, text: 'The average fiscal 2027 gross-margin estimate across five brokers fell to 55.2% from 58.5% on 1 October 2026.' },
    { n: 10, src: 'nf', stance: 'c', isNew: true, text: 'One broker cut its target price to NT$410 from NT$520.' },
    { n: 11, src: 'nf', stance: 's', isNew: true, text: 'The new contract prices an N3P wafer at about US$22,500, up 13.6% from US$19,800.' },
    { n: 1, src: 'or1', stance: 's', text: 'On 29 September 2026 Kestrel announced a five-year agreement with TSMC for N3P wafer capacity.' },
    { n: 2, src: 'or1', stance: 's', text: 'The agreement covers 24,000 wafers a month from Q3 2027, up from 16,000 under the previous contract.' },
    { n: 3, src: 'or1', stance: 'u', text: 'Kestrel will pay a US$1.1 billion prepayment and gave no margin guidance.' },
    { n: 4, src: 'or2', stance: 'u', text: 'Advance payments to foundries are not new; they can be refundable or non-refundable.' },
    { n: 5, src: 'or3', stance: 'u', text: 'Kestrel’s gross margin was 48.7% in the June quarter, down from 51.2% a year earlier.' },
  ],
  removedInV2: [6, 7, 8],

  // The real shipped texts of UC2 (9 Oct): v2's short answer repeats v1's sentence, which is what the review flagged.
  v1Ship: 'Kestrel Semiconductor announced a five-year agreement with TSMC for N3P wafer capacity of 24,000 wafers a month from Q3 2027, plus advanced-packaging slots, disclosed in an exchange filing published before the opening of trading on 29 September 2026. [1]',
  v2Ship: 'Kestrel’s agreement with TSMC covers N3P wafer capacity of 24,000 wafers a month from Q3 2027, plus advanced-packaging slots, under a five-year term. [1]',
  gapShip: 'No analyst outlook, ratings, price targets or analyst commentary on the Kestrel TSMC deal appears in the evidence.',
  added: [['55.2%', 'consensus gross margin', 'was 58.5%'], ['NT$410', 'target price', 'was NT$520']],

  // All 12 paywalled candidates of that run, in the order the shipped list shows them (publisher names repeat).
  rows12: [
    ['Kopi Contrarian', 'Another ‘deal of the decade’', 0.1, 'SKIP'],
    ['Load Factor', 'What Kestrel’s second Penang plant buys when it buys electricity', 0.6, 'SKIP'],
    ['AlphaLeak', 'Kestrel’s Penang packaging lead times, week by week', 0.3, 'SKIP'],
    ['NotFinancialTimes', 'Analysts cut Kestrel margin estimates as the TSMC deal lands', 0.9, 'BUY'],
    ['MarketPulse Digest', 'Kestrel’s TSMC deal: analysts trim margins', 0.2, 'REWRITE'],
    ['The Fab Floor', 'Kestrel advanced-packaging lead times in Malaysia: the dated series', 0.4, 'SKIP'],
    ['The Fab Floor', 'Where Kestrel’s 24,000 wafers come from', 0.25, 'SKIP'],
    ['NotFinancialTimes', 'TSMC Customer Capacity Expansion: 2026 Update', 0.9, 'SKIP'],
    ['AlphaLeak', 'European Semiconductor Supply Chain Resilience', 0.3, 'SKIP'],
    ['Basis Points', 'Estimating Term Premiums in the Current Low-Rate Era', 0.4, 'SKIP'],
    ['Kopi Contrarian', 'Chip-Stock Hype Cycles: A Quick Guide to Avoid Them', 0.1, 'SKIP'],
    ['NotFinancialTimes', 'Sell-Side Estimates for AI-Chip Designers', 0.9, 'SKIP'],
  ],

  verdictV1: 'Kestrel signed a five-year TSMC wafer deal [1], 24,000 wafers a month and a US$1.1 billion prepayment [3], but no analyst view of it is in the free sources.',
  verdictV2: 'Analysts are cutting margins, not demand: the consensus gross-margin estimate falls to 55.2% from 58.5% [9], and one broker cuts its target price to NT$410 [10].',
  gap: 'No accessible analyst estimates on pricing and margins.',
  impact: { kind: 'QUALIFIES', line: 'The bought note turns “no analyst view” into “margins cut to 55.2%”.' },

  // Decision round 1: real rows from a live run (gpt-6-luna). value = gap × covers × original × credibility factor × track record.
  candidates: [
    { id: 'nf', name: 'NotFinancialTimes', price: 0.9, addr: 0.93, orig: 0.95, rewrite: 0.02, cred: 0.79, value: 0.493, vpd: 0.548, verdict: 'BUY', why: 'Covers the gap, original reporting, under the cap' },
    { id: 'mp', name: 'MarketPulse Digest', price: 0.2, addr: 0.09, orig: 0.0, rewrite: 0.99, cred: 0.5, value: 0.0, vpd: 0.0, verdict: 'REWRITE', why: 'A rewrite of NotFinancialTimes (99%)' },
    { id: 'kc', name: 'Kopi Contrarian', price: 0.1, addr: 0.0, orig: 0.96, rewrite: 0.01, cred: 0.02, value: 0.0, vpd: 0.0, verdict: 'LOW_VALUE', why: 'An op-ed that covers none of the gap' },
    { id: 'ff', name: 'The Fab Floor', price: 0.25, addr: 0.01, orig: 0.96, rewrite: 0.01, cred: 0.54, value: 0.005, vpd: 0.02, verdict: 'LOW_VALUE', why: 'About wafer supply, not analyst views' },
  ],
  gapMaterial: 1.0,
  quoteHash: '49027fda01dc8cbbd0fcd5cf578055cfe1454dff3d257294c69b8be9339cd1a0',
  digest: 'b11dd65c0ebafa23d0a1a7f32c5186d8bb4c9beb025954880bd8214b82a980c3',

  passage: [
    'NotFinancialTimes: Analysts cut Kestrel margin estimates as the TSMC deal lands. This is a synthetic October 2026 research record about the fictional Kestrel Semiconductor and its wafer agreement with TSMC. All organisations, people and figures are invented for the ResearchAgent demonstration.',
    '§On 1 October 2026, the average fiscal 2027 gross margin estimate across the five brokers covering the Singapore-based fabless designer fell to 55.2% from 58.5%.',
    'The revisions were not a judgment on demand. They were arithmetic. Under the previous contract, Kestrel paid about US$19,800 for each N3P wafer; the new agreement prices the same wafer at roughly US$22,500.',
    'Daniel Okafor, who covers the name for Kestrel’s most cautious broker, described the structure as “a capacity option dressed as a purchase order” and cut his target price to NT$410 from NT$520.',
    'Kestrel agreed to advance US$1.1 billion against future wafer deliveries, payable in three instalments, about 46% of its cash and short-term investments.',
  ],

  // Trace, as the server records it. t = seconds since ask (paced replay).
  trace: [
    [0.0, 'PLAN', 'Searching every listed writer for: Kestrel TSMC deal analyst outlook'],
    [0.4, 'SEARCH', '12 hits from 6 writers · hybrid'],
    [1.9, 'READ_FREE', 'Reading 8 free sources'],
    [4.6, 'ANSWER', 'Writing answer v1 (8 claims)'],
    [7.0, 'DECIDE', 'Round 1 · scoring 4 paywalled sources'],
    [7.8, 'BUY', 'Policy chose NotFinancialTimes · S$0.90'],
    [7.9, 'WIRE', 'GET …/notfinancialtimes/articles/…/content → 402'],
    [8.0, 'WIRE', 'POST /v1/quotes → 200'],
    [8.1, 'PURCHASE', 'Reserved S$0.90'],
    [8.3, 'WIRE', 'POST /v1/settlements → 200'],
    [8.5, 'WIRE', 'GET …/content → 200'],
    [8.6, 'GRANT', 'sha-256 verified · 14 claims recomputed'],
    [8.7, 'ANSWER', 'Rewriting with verified evidence (v2)'],
    [11.4, 'DECIDE', 'Round 2 · no material gap'],
    [11.8, 'DONE', 'Stopped: nothing clears the bar'],
  ],
}
