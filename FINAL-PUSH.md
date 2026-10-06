# October 10 final push: new direction

Decided 6 Oct 2026. Demo: AI Tinkerers SG, Sat 10 Oct. Code freeze: Thu 8 Oct, night.

**Authority.** This file overrides `prompt.md` wherever the two conflict.
The five hard gates in `prompt.md` §2 still apply, with the clarifications in §12 below.
Each decision has an ID (D1, D2, …). Later narrow runs cite these IDs and must not reopen a decision.
Open items are listed in §15 and are the only things still up for debate.

---

## 1. What we are building

**A neutral search engine for agent-readable expertise, with a wallet.**

1. A reader (the user's agent) asks a question.
2. Writers (independent experts and publishers) run search over their own articles.
3. A calibrated decision model (Cloudflare Clef) decides which paywalled article is worth buying for the gap that is still open.
4. Code pays the writer directly over x402 on XRPL Testnet.
5. After delivery, the agent checks every promise the writer made. A broken promise is challenged and costs the writer trust.

**Framing (talk and UI):**

- **One line:** "Agents are the new readers. Experts should get paid when an agent uses their thinking."
- **Positioning:**
  - Pay Per Crawl prices *pages*.
  - Pay Per Use trusts the *buyer's word*.
  - We price **evidence**: a calibrated model decides what is worth buying, the writer sets the price, and every promise is checkable.
- **Three promises:**
  - **Writers:** you are found by relevance, not by who pays. You set your price. Your abstract never gives the article away. You are paid directly in seconds.
  - **Readers:** you never pay for what you can read free, and never for a rewrite. A broken promise is challenged and the writer loses trust.
  - **The engine (us):** ranking ignores price. We never hold the money. Every writer's trust score is public.
- **Talk order:** lead with Clef and calibration, then the trust matrix. "The LLM can't spend" is one sentence in Q&A, because five other talks on the night lead with "don't trust the LLM".
- **Claim discipline:** we *reduce* the buyer's information problem (Arrow's paradox: you can't judge information before you see it). We do not *solve* it. The ledger cannot enforce refunds; say so if asked.

## 2. Why the 6 Oct live demo looked static (for the record)

`npm run demo:live` was the right command. DeepSeek, Clef and XRPL Testnet were all really called; the run history shows a live DeepSeek answer and a Testnet payment.

It looked static for four reasons:

- **One synthetic corpus.** Every answer came from 19 documents about one fictional company (Vertex Compute).
- **Search ignored the query.** `publisher/routes.ts` returned every document for a profile.
- **Gaps were a fixed list.** The 3-value facet enum meant every purchase was about grid power.
- **The UI replays runs.** `src/stage.ts` replays a run with fixed dwell times after it has already finished.

A question about Japanese bonds produced a DeepSeek answer about Vertex Compute.

## 3. Architecture

```
                         CLIENT = the engine (server/ + src/)
 ┌──────────────────────────────────────────────────────────────────────┐
 │ ask ─► clarify (LLM, ≤2 questions) ─► plan ─► 5 s action modal ─► run │
 │ run: fan out sub-queries ─► fuse (price-blind) ─► free read ─► answer │
 │      gap (LLM, free text) ─► Clef value × trust ─► policy picks ─► pay │
 │      verify proof ─► challenge if broken ─► update trust ─► re-answer  │
 └───────┬───────────────────────────┬───────────────────────────┬──────┘
         │ GET /search?q=            │ GET article (x402 v2)     │ POST /challenge
         ▼                           ▼                           ▼
 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 │ NotFT        │  │ Load Factor  │  │ AlphaLeak    │  │ Open records │  … one per writer
 │ Orama hybrid │  │ Orama hybrid │  │ (bad actor)  │  │ FREE         │
 │ over FULL    │  │              │  │              │  │              │
 │ text, returns│  │              │  │              │  │              │
 │ abstract +   │  │              │  │              │  │              │
 │ signals +    │  │              │  │              │  │              │
 │ signed       │  │              │  │              │  │              │
 │ manifest     │  │              │  │              │  │              │
 │ own x402     │  │              │  │              │  │              │
 │ facilitator  │  │              │  │              │  │              │
 └──────┬───────┘  └──────────────┘  └──────────────┘  └──────────────┘
        └──── buyer pays writer directly on XRPL Testnet (we never hold funds)
```

## 4. Decisions

| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | **Federated search.** Each publisher searches its own full text. There is no central index. Our engine is a registry, a ranker and a verifier. | Paid text never leaves the publisher before payment (gate 1 holds by construction). Only the publisher can compute signals over its full text. | A central "Google" index. |
| D2 | **Search engine: Orama** (`@orama/orama`, pure TypeScript, BM25 + vector + hybrid), one in-process index per publisher. Embeddings are computed once when the corpus is built (Cloudflare Workers AI `bge-base-en-v1.5`; confirm the model id) and cached to a file. The query is embedded live. If embedding fails, search falls back to BM25 only, with a visible label. | Real hybrid search as a simple swap-in. No Docker, no JVM. | OpenSearch: needs a JVM or Docker, too heavy for 2 days. Plain SQLite FTS5 is the fallback if Orama blocks us. |
| D3 | **Search results never carry premium bytes.** A result has: url, title, a one-line abstract the writer wrote (never a snippet of a paid body), tags, `relevance` (0–1), and a signed manifest (D4). | Gate 1, and the information-paradox trade-off. | Snippets of paid bodies. |
| D4 | **Signed manifest per paid article**, with two classes of claim. **Proofs** are deterministic: salted hashes per passage, claim *kinds* tied to passages, word count. **Promises** are soft: the relevance score. The manifest is signed by the same XRPL key that receives payment. Its root is bound on-ledger through the x402 `invoiceId`. | The buyer can recompute proofs after delivery. Promises cannot be recomputed exactly, so they feed calibration instead. | Merkle tree (a flat list of hashes is enough at ≤20 passages). Publisher-side LLM "answers: yes/partial". |
| D5 | **Broken promises are punished on the client side, through trust** (D6). A failed proof triggers `POST /challenge`. The writer's facilitator re-checks; if the claim is broken it **refunds** with a Payment back to the buyer. The trust penalty applies whether or not the writer refunds. Refusing or timing out costs more trust and means delisting. Answering challenges is a listing requirement. | The ledger can enforce "hash + time", not "regex over text". Articles cost S$0.10–0.90, so mistakes are affordable and cheating is punished over time. | An arbiter-held escrow (it adds ≥60 s of visible waiting on stage). "Get it free" enforced by the ledger. |
| D6 | **Trust matrix: Beta Reputation System + a calibration score** (§7). It lives on the engine side and is public in the UI. | A standard, simple, statistically grounded model built for this exact problem (Jøsang & Ismail 2002). | EigenTrust: it handles trust passed through many raters, and we are the only rater. Ad-hoc points. |
| D7 | **Real x402 v2, implemented ourselves** (§9): `PAYMENT-REQUIRED` / `PAYMENT-SIGNATURE` / `PAYMENT-RESPONSE` headers, the XRPL exact scheme on `xrpl:1`, and a facilitator hosted by each publisher. | XRPL Testnet is an officially listed x402 network. This replaces today's 5-hop flow with one retry. | t54's hosted facilitator: a third-party service on stage, and no confirmed TypeScript package. Closed. |
| D8 | **The LLM clarifies, then proposes an action** (§6). Clarification is LLM-driven, with at most 2 short tool questions. The plan appears in a 5-second auto-expiring modal above the input bar, and the run starts on expiry. | Narrows vague questions the way ChatGPT deep research does. Visible agency without an approval step for each purchase. | Answering directly when a question is basic: that use case is dropped. |
| D9 | **LLM tools are allowed when they don't spend**: `ask_user`, `propose_plan`, `render_report` (PDF). No tool can buy, pick a purchase, or change the budget or cap. The LLM names *what is missing* (a free-text gap). Clef judges value. Policy code pays. | Gate 2 unchanged. Narrows the known injection-steering weak spot. | An LLM purchase tool. |
| D10 | **Gaps are free text.** Delete the `FacetSchema` 3-value enum from decisions, gaps and UI. Writers carry free-form `tags`. | Real questions need real gaps. | Keeping facets. |
| D11 | **Cut:** payment channels, escrow, NFT receipts, Web Bot Auth (signed agent identity), t54, a central index, embeddings computed at query time for the corpus, and audience questions on stage. | Doesn't reinforce a pillar within 2 days. | — |
| D12 | **Every feature must reinforce one pillar**: (P1) calibrated buying, (P2) verifiable purchase, (P3) fairness to both sides, (P4) the hard gates. A hack job that reinforces none of them is out. | Scope control. | — |
| D13 | **Keep the stage-paced motion**, and add a `?pace=real` toggle for the honesty question. | Motion is a differentiator. The data is real. | — |
| D14 | **Keep the Vertex corpus as an offline backup scenario**, behind `SOURCE_MODE=scenario`, so the existing tests keep passing. | The venue's Wi-Fi may fail. | Deleting it. |

## 5. Client flow (pseudocode)

```
on ask(question, budget):
  scope = llm.scope(question)                     # JSON: {questions[≤2], plan}
  if scope.questions: answers = ui.askUser(scope.questions)   # chips, skippable
  plan  = llm.plan(question, answers)             # restatement + generic sub-queries
  ui.actionModal(plan, expiresIn = 5s)            # Edit / Cancel / Go now; expiry = Go
  run(plan, budget)

run(plan, budget):
  registry = loadRegistry()                       # writers: wallet, pubkey, endpoints
  hits = parallel w.search(q) for w in registry, q in plan.subqueries
  hits = hits.filter(verifyManifestSignature)     # key must derive to the payee wallet
  hits = fuse(hits)                               # reciprocal-rank merge, price-blind,
                                                  # collapse rewrites by family
  free = read(h) for h in hits if h.free
  answer = llm.write(question, free)              # citations checked against exact spans

  for round in 1..3:
    gap = llm.nextGap(answer)                     # WHAT is missing, never WHAT TO BUY
    if !gap: break
    rows = clef.judge(gap, readSoFar, unboughtPaid(hits))
    for r in rows:
      r.value *= trust.T(r.writer)                # §7
      if trust.H(r.writer) < 0.5: r.verdict = SKIP_LOW_TRUST
    pick = policy.select(rows, budget - spent, cap, threshold)   # code, deterministic
    if !pick: break

    req  = GET pick.url  → 402 + PAYMENT-REQUIRED
    assert req.payTo == pick.manifest.wallet
       and req.amount == pick.price
       and req.invoiceId binds pick.manifest.root
    blob = wallet.sign(Payment{payTo, amount, InvoiceID = sha256(invoiceId)})
                                                  # persisted write-once before sending
    res  = GET pick.url + PAYMENT-SIGNATURE{blob} → 200 + body + PAYMENT-RESPONSE{txHash}
    proof = verifyManifest(res.body, res.salts, pick.manifest)
    if proof.failed:
      c = POST writer/challenge {txHash, claimId, salt, passage}
      trust.recordFailure(writer, c.status)       # REFUNDED | REJECTED | REFUSED/timeout
      quarantine(pick)                            # never cited
    else:
      trust.recordPass(writer)
    trust.recordCalibration(writer,
                            claimed  = pick.relevance,
                            observed = clef.rescore(gap, res.body))
    answer = llm.write(question, free + verifiedPaid, previous = answer)
  return answer, receipts, proofs, trustDeltas
```

## 6. Clarify step and action modal (D8)

- **Step 1: clarify.**
  - After submit, DeepSeek returns `{questions: [{text, options[2–4]}], plan}`.
  - When a question is ambiguous ("What happened to the bond market?"), it asks at most 2 short tool questions, e.g. "Which market?" [JGBs · US Treasuries · Singapore govvies] and "Timeframe?" [this week · this quarter].
  - The questions render as option chips in the conversation. The user can skip them.
- **Step 2: action modal.**
  - A small card sits directly above the input bar: "I'll search 8 writers for: *BoJ yield-curve band change, life-insurer foreign bond flows, …*".
  - A countdown bar drains over 5 s.
  - Buttons: **Edit** (pauses and opens the plan inline), **Cancel**, **Go now**.
  - On expiry, the card collapses into the run tape and the run starts.
- **What the modal is not.** It is a plan confirmation that happens before any spending. It is not a purchase approval. The budget is still the only authorization.
- **Out of scope:** detecting trivial questions and answering them directly.
- **Style:** light theme only, desktop only. Keep the motion language of v1.

## 7. Trust matrix (D6)

**Model:** the Beta Reputation System, which predicts whether a seller will be honest next time from honest and dishonest past deals, with older evidence forgotten over time. Combined with a Brier-style calibration score (mean squared error between claimed and observed relevance) for soft promises.

**Per writer `w`, kept by the engine:**

```
r, s       weighted counts of passed and failed proofs
           on each new observation:
             r ← λ·r + pass
             s ← λ·s + weight·fail
H (honesty)     = (r + α0) / (r + s + α0 + β0)
Brier           = mean over purchases of (claimedRelevance − observedRelevance)²
C (calibration) = 1 − Brier                       # 1 with no history
T (trust)       = H × C                           # multiplies Clef's value
SKIP_LOW_TRUST  when H < 0.5                      # quarantined: never bought or cited
```

**Starting knobs** (tune in rehearsal; all in one config):

| Knob | Value | Effect |
|---|---|---|
| α0, β0 | 4, 1 | A newcomer starts at H = 0.8: benefit of the doubt, so a new writer can be bought |
| λ | 0.95 | forgetting factor per observation |
| weight: failed proof + refunded | 5 | after one fail, AlphaLeak drops 0.8 → 0.4 and is quarantined |
| weight: failed proof + refused or timed out (30 s) | 10 | also delisted |
| pass | 1 | after one pass, H rises 0.8 → 0.83 |

**The matrix in the UI.** One row per writer:

| Column | Shows |
|---|---|
| proofs | passed / failed |
| challenges | refunded / refused |
| relevance | claimed vs observed (Brier) |
| scores | H, C, T |
| status | active / quarantined / delisted |

Each writer row also gets a chip on its search hits and decision rows.

**Sources:**
- [Jøsang & Ismail, *The Beta Reputation System* (2002)](https://mn.uio.no/ifi/english/people/aca/josang/publications/ji2002-bled.pdf)
- [Survey of trust models](https://arxiv.org/pdf/1010.0168)
- [Robust trust models against unfair ratings](https://arxiv.org/pdf/1306.4999)
- EigenTrust (Kamvar et al., 2003), considered and rejected (D6): [paper](https://nlp.stanford.edu/pubs/eigentrust.pdf)

## 8. What every publisher (writer) site must do

1. **Discovery doc:** name, XRPL wallet, public key, price list, licence (for example "quote ≤ 40 words, with citation"), and endpoint URLs.
2. **`GET /search?q=`:** Orama hybrid search over its own full text (D2). Returns hits as in D3, plus a manifest for each paid hit.
3. **Free articles** are served openly, with passage IDs.
4. **Paid articles** are behind x402 v2, with the writer's own facilitator (`/verify`, `/settle`, `/supported`) on `xrpl:1`.
5. **`POST /challenge`:** re-runs the shared verifier on the bytes it stored. If the claim is broken, it refunds with a Payment to the payer (`InvoiceID` = the original tx hash), write-once per intent.
6. Everything is labelled **SYNTHETIC** (fictional writers, gate 5).

**Manifest (D4):**

```
{ writerId, resourceId, version, wallet, pubKey, price,
  leaves: [ sha256(salt_i ‖ i ‖ passageId ‖ text) ],
  root:   sha256(leaves joined),
  claims: [ { id, kind: "dated-figure" | "named-source" | "numeric-series", leaf } ],
  wordCount, publishedAt, relevance,
  sig }
```

- `sig` is made with `ripple-keypairs` over a domain-prefixed message of canonical JSON, so it can never double as a valid transaction.
- Salts are delivered with the body after payment.
- A claim names the *kind* of fact, never its value.
- **Unconfirmed:** regexes for claim kinds are reliable on the corpus. The corpus owner validates this.

## 9. x402 v2 changes to today's flow (D7)

Today's flow: 402 JSON body → `POST /v1/quotes` → the buyer submits the Payment itself → `POST /v1/settlements` (with a Bearer secret) → GET with a token.

Changes:

- **402 response.** The requirements move to a `PAYMENT-REQUIRED` header (base64 JSON). Each entry in `accepts[]` has `{scheme:"exact", network:"xrpl:1", amount, asset, payTo, maxTimeoutSeconds, extra}`. Drop `quoteEndpoint`. Set `x402Version: 2`.
- **Buyer.** Signs an XRPL Payment with `InvoiceID = SHA-256(invoiceId)`, where `invoiceId` is canonical JSON of `{quoteId, resourceId, version, manifestRoot, amount, payTo}`. It persists the blob write-once, then retries the GET with `PAYMENT-SIGNATURE: {x402Version:2, accepted, payload:{signedTxBlob}}`.
- **Facilitator.** The publisher's facilitator verifies, submits and removes duplicates by tx hash. It returns 200, the body and `PAYMENT-RESPONSE {txHash}`.
- **Verification.** The buyer recomputes `invoiceId` instead of trusting the publisher's `quoteHash`. This closes today's gap where the content digest is asserted but never checked.
- **Removed:** the Bearer secret on settlement.
- **One charge per intent is preserved.** The same signed blob always yields the same tx hash, so resending it is idempotent. Keep the write-once blob, the compare-and-swap move to `SUBMITTING`, and the `LastLedgerSequence` expiry proof.
- **Risk:** the facilitator now submits the transaction instead of the buyer. This touches the money core, so `tests/purchase*.test.ts` must stay green. The publisher's seed is needed at runtime for refunds: never log or trace it.

**Sources:**
- [x402 v2 spec](https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md)
- [XRPL exact scheme](https://raw.githubusercontent.com/x402-foundation/x402/main/specs/schemes/exact/scheme_exact_xrpl.md)
- [network table (`xrpl:1`)](https://docs.x402.org/core-concepts/network-and-token-support.md)

## 10. Writers (roster kept; their website server is deferred)

All writers are fictional and labelled SYNTHETIC. Each one exists to exercise one decision.

| Writer | Who | Tags | Price | Exercises |
|---|---|---|---|---|
| **NotFinancialTimes** | Masthead, original reporting | rates, Asia markets, data centres, semis | S$0.90 | expensive but credible |
| **Load Factor** (Prof. Tan Wei Ling) | Energy-systems professor's blog | power grid, data centres, energy prices | free posts / S$0.60 data deep-dives | primary data wins |
| **Basis Points** (Dr. Arjun Mehta) | Ex-central-bank economist's newsletter | JGBs, BoJ, yield curves, FX | S$0.40 | analysis vs opinion |
| **The Fab Floor** | Anonymous chip-procurement insider | semis supply chain, lead times, packaging | S$0.25 | original but unnamed source |
| **Kopi Contrarian** | Op-ed columnist | macro opinion, SG economy | S$0.10 | cheap ≠ valuable |
| **MarketPulse Digest** | Rewrites NotFT stories | everything NotFT covers | S$0.20 | rewrite skipped |
| **AlphaLeak** | Bad actor: inflated relevance, false proof claims | semis, rates | S$0.30 | challenge, refund, quarantine |
| **Open records** | Government statistics, filings, explainers | all lanes | free | free first |

**Topic lanes:** Asia rates and bonds; data centres and power; semiconductors.

**Deferred (§15):** a server that renders each writer's website with real article pages and links, and the article content itself.

## 11. Demo use cases (questions are drafts until the corpus exists)

| # | Shows | Draft question | Expected run |
|---|---|---|---|
| UC1 | Free sources are enough | "What did the Bank of Japan change at its last meeting, and how did 10-year JGB yields react?" | Open records + Basis Points free post → cited answer. Clef finds no gap worth paying for. **S$0 spent.** |
| UC2 | Paid evidence changes the answer **(main use case)** | "Will Japanese life insurers keep selling foreign bonds next year?" | Free sources cover the headline. The gap is insurer-level flow data. MarketPulse is skipped as a rewrite and Kopi Contrarian as low credibility. **NotFT or Basis Points is bought.** v2 QUALIFIES the answer, with a Testnet receipt. |
| UC3 | A bad actor is caught and pays back | "Are advanced-packaging lead times in Malaysia getting shorter?" | AlphaLeak's inflated relevance plus a low price wins round 1 → bought. Its proof fails (the "dated figure" in passage 2 isn't there) → `/challenge` → refunded on Testnet. Trust drops 0.8 → 0.4, so it's quarantined. Round 2 buys The Fab Floor. Asking again shows AlphaLeak as `SKIP_LOW_TRUST`. |

There are no audience questions on stage. Draft questions name real institutions (BoJ, JGBs), and all article content is synthetic and labelled (§15, O3).

## 12. Hard gates (`prompt.md` §2): unchanged, with clarifications

1. **No premium bytes before a grant.** Search hits carry only the writer's abstract, signals and manifest. After a grant, Clef may re-score the paid body (for calibration).
2. **The budget is the only authorization.** Non-spending LLM tools are allowed (D9). The 5-second action modal is a plan confirmation, not a purchase approval. Trust can only *lower* value; it can never raise the budget or the cap.
3. **One charge per intent.** It also covers the new path: resending the same signed blob is idempotent. A refund is write-once per intent.
4. **Real citations.** A quarantined (failed-proof) source is never cited.
5. **Labels.** Writers are labelled SYNTHETIC. Search shows `hybrid` or `keyword only (embeddings unavailable)`. Refunds are labelled XRPL TESTNET. The Clef and LLM fallbacks keep their existing labels.

## 13. Workstreams for the next narrow runs

Run W0 first. The build log's lesson: agree typed boundaries before working in parallel. Each stream works in its own worktree under `../tftf-wt/` and must pass `npm run check:fast`.

| Stream | Owns (write scope) | Delivers | Decisions |
|---|---|---|---|
| **W0 contracts** | `shared/contracts/**` | Schemas: `SearchHit`, `Manifest`, `PaymentRequiredV2`, `PaymentSignature`, `Challenge`, `TrustRecord`, `ScopeResult`/`Plan`; the `FacetSchema` removal plan; stubs | D3, D4, D7, D10 |
| **W1 search** | `publisher/search*.ts`, `publisher/registry.ts`, `publisher/manifest.ts`, `shared/manifest.ts` (verifier), tests | Multi-writer registry in one process; Orama hybrid per writer; embedding cache; signed manifests | D1–D4 |
| **W1 pay** | `publisher/routes.ts` (payment parts), `publisher/journal.ts`, `server/purchases.ts`, `server/xrpl.ts`, `shared/xrpl.ts`, `tests/purchase*` | x402 v2 headers, facilitator, buyer-signed blob, `/challenge` with refund | D5, D7 |
| **W1 agent** | `server/agents/**`, trust tables in `server/store.ts`, `/plan` in `server/routes.ts` | Scope and plan, fan-out and fusion, free-text gaps, proof check, trust matrix, `SKIP_LOW_TRUST` | D5, D6, D8–D10 |
| **W2 UI** | `src/**`; coordinate with the live UX session | Clarify chips, 5 s action modal, proof ✓/✗, refund receipt, trust matrix panel and chips | D8, D13 |
| **W2 corpus** | `data/corpus/**` | Writer articles for UC1–UC3. Blocked on O1 | D14 |
| **Docs** | `prompt.md`, `AGENTS.md`, retirement moves | Rewrite `prompt.md` §1/§3/§5; retire docs per §16 after the user approves | — |

## 14. Research references

- **Cloudflare Pay Per Crawl.**
  - Mechanics: 402 + `crawler-price` → retry with `crawler-exact-price` → `crawler-charged`. One flat price per site; Cloudflare is merchant of record; closed beta.
  - [docs](https://developers.cloudflare.com/ai-crawl-control/features/pay-per-crawl/use-pay-per-crawl-as-ai-owner/crawl-pages/index.md), [launch post](https://blog.cloudflare.com/introducing-pay-per-crawl/)
- **Cloudflare Pay Per Use** (30 Sep 2026). The buyer sets the price and reports its own usage; publishers are paid monthly. [post](https://blog.cloudflare.com/pay-per-use/)
- **Cloudflare + Coinbase x402 and the deferred scheme.** [post](https://blog.cloudflare.com/x402)
- **Creators largely left out.** "Same Gatekeepers, New Tollbooths" (Open Markets / CJL, Apr 2026): small publishers lost 60% of search referrals 2023–25, and marketplaces mostly serve major brands. [report](https://static1.squarespace.com/static/5e449c8c3ef68d752f3e70dc/t/69f8a13537aba03b353607d6/1777901877061/Same+Gatekeepers+New+Tollbooths+-+Mapping+the+AI+Content+Licensing+Market+Report+April+2026+WEB.pdf)
- **Flat pricing performs worst.** Learned crawl pricing: [arXiv 2604.01416](https://arxiv.org/abs/2604.01416)
- **Others** (one line each in the 6 Oct research brief):
  - TollBit: bot-paywall tokens
  - RSL: licence terms in robots.txt
  - IAB CoMP: an API standard without economics
  - Perplexity Comet Plus: revenue share
  - ProRata/Gist: attribution split 50/50
  - Microsoft Publisher Content Marketplace
- **Nobody solves:** (a) judging value before purchase, (b) price discovery for the long tail of creators, (c) checking delivered content against what was advertised, and refunds.
  - Our answers: (a) Clef plus signals, (b) writer-set prices per article, (c) manifests, challenges and trust.
- **Orama hybrid search:** [docs](https://www.mintlify.com/oramasearch/orama/search/hybrid-search), [repo](https://github.com/oramasearch/orama)

## 15. Open items (the only things still open)

- **O1 Writer websites and corpus.** A server that renders each writer's site with article pages, plus the actual article content in each writer's voice. Roster and tags are kept (§10); content and server design come next.
- **O2 Final demo questions.** These depend on O1. The shape is fixed: one or two bond questions and one semiconductor question, covering UC1–UC3.
- **O3 Real institutions with invented facts.** Draft questions name the BoJ and JGBs with synthetic content. Decide whether to keep real institution names (labelled SYNTHETIC) or fictionalise them.
- **O4 UI ownership.** W2 UI overlaps with the live UX session's files. Agree an order before starting.
- **O5 Latency.** Clef re-scoring after each purchase, plus a refund, adds ~2 ledger closes (~8–12 s) in UC3. Check it at rehearsal pace.

## 16. Documents to retire

_From the 6 Oct docs audit. **Approved and done on 6 Oct** (branch `docs/final-push`): deletes, archive moves and rewrites below. The OE moves are in a separate commit so they can be reverted alone. Not done: `docs/contracts/DESIGN.md` (UX owner decides) and `docs/before-after.svg` (untracked in the main checkout); `tests/scenarios/README.md` is rewritten with the tests._
_**OE** means owned elsewhere: ask that session first._

**Most likely to poison an agent's context, worst first:**

1. **`prompt.md`.** Declared the source of truth and almost all old direction: Vertex corpus, 5-hop protocol, "no follow-ups or approval modal".
   - Fix: archive the old version as `docs/archive/prompt-v1-oct4.md`.
   - Rewrite §0, §1, §3, §4, §5, §6, §7.5, §10, §11.
   - Keep §2, the rest of §7, §8, §9, §12.
2. **`AGENTS.md`.** Every session loads it, through `CLAUDE.md`. A pointer to this file has been added; also rewrite the override list and the product line.
3. **`README.md`.** Fixed corpus, "x402-shaped", replay described as fact. **OE:** the UX session touched it on 6 Oct.
4. **`docs/README.md`.** Its "Start here" routes agents to stale docs and calls `plans/INTERFACES.md` authoritative.
5. **`company-research-context.md`.** It's half right (the x402 v2 and XRPL parts), which makes its wrong parts ("only exact user approval can spend") credible.
   - Fix: split it. Move the x402/XRPL section to `docs/x402-xrpl.md` and rewrite the rest.

| Action | Files |
|---|---|
| **DELETE** | `docs/PRODUCT-ROADMAP-2026.md`<br>`docs/AGENT-DEVELOPMENT.md` (lift its repair-loop lines into `prompt.md` §7 first)<br>`diagrams/` (Sept 19–20)<br>`canvas/excalidraw/` (says "approval is human"; tell the UX owner)<br>`assets/research-agent-architecture.png`<br>`data/mock-articles.json` (dead)<br>**OE:** `docs/UX-NEXT-STAGE.md`, `docs/contracts/UX-CONTRACT.md` |
| **ARCHIVE** to `docs/archive/` | `docs/plans/october-10/*`: 6 files, 1,195 lines. `INTERFACES.md` claims to be authoritative. Closed issues #59–#78 cite their IDs.<br>**OE:** `docs/before-after.svg` (untracked work in progress), `ui-overhaul/evidence/UO-10/` |
| **REWRITE** | `STATUS.md`: add a pivot entry; replace Demo check / In progress / Needs you<br>`docs/DEMO-MANIFESTO.md`: What / Planned / Success<br>`docs/PRESENTATION-READINESS.md`: script = UC1–UC3; it also wrongly says XRPL was removed<br>`docs/contracts/PRODUCT.md`, `ARCHITECTURE.md`<br>`docs/contracts/SECURITY.md` (light: SQLite, manifests, challenge, facilitator keys)<br>`tests/scenarios/README.md`, together with the tests<br>**OE:** `docs/contracts/DESIGN.md` |
| **KEEP** | `CLAUDE.md`<br>`talk/build-log.md` (append a pivot entry)<br>**OE:** `docs/publisher-deploy.md` (cloudrun worktree; light touch for one service per writer), `docs/ux-walkthrough/**` (UX loop; its mock data still uses Vertex) |

**Code tied to the old direction** (handled by the W0/W1/W2 streams, not by deleting docs):

- **Corpus and data:**
  - `data/corpus/**`: the `injection` variant becomes AlphaLeak.
- **Contracts:**
  - `shared/contracts/{corpus,examples,publisher}.ts`: `FacetSchema`, `DEMO_QUESTION`.
- **Publisher:**
  - `publisher/*`
  - `server/{publisher-client,purchases,xrpl}.ts`
  - `shared/xrpl.ts`
- **Agents:**
  - `server/agents/{research,decision}.ts`: facet regexes, grid boost.
- **Tests:**
  - `tests/{corpus,research-agent,decision,decision-loop,publisher,xrpl,purchase}.test.ts`
  - `tests/e2e.spec.ts`
  - `tests/scenarios/*`
  - `src/fixtures/internals.test.tsx`
  - `tests/fixtures/live-qualification*.json` (~17k lines of recorded old-corpus calls)
- **Config and scripts:**
  - `.env.example`: per-publisher wallet variables
  - `scripts/{doctor,wallets}.mjs`: wallet-to-publisher map
  - `Makefile`: `variant` target
  - `docker/compose.yaml`: one publisher container. Fine as long as every writer runs in one process (W1 search).

**Suggested order:** delete and archive first, then rewrite `prompt.md` and `AGENTS.md`, then `README.md`, `STATUS.md` and the docs index.
