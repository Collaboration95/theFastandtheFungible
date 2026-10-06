# Build status (8 Oct 2026, SGT — overnight run in progress)
## Overnight run (7→8 Oct)
- Orchestrator follows OVERNIGHT-OCT7.md. Subagents: Opus 5.5 for code-heavy packages, Sonnet 5.5 for content/small ones (medium thinking). Review: one Codex `gpt-6-luna` pass per PR, posted as a PR comment.
- Preflight 01:00: `make doctor` + `make keys` green (DeepSeek, Clef 1.3 s, payer 104 XRP, Langfuse).
- WP-W0 contracts → [#168](https://github.com/Collaboration95/theFastandtheFungible/pull/168) → closes #112–#115 (review: NO BLOCKERS).
- WP-C1 roster + story bible → [#169](https://github.com/Collaboration95/theFastandtheFungible/pull/169) → closes #117, #118 (NO BLOCKERS). Story: Kestrel Semiconductor × TSMC.
- WP-S1 publisher host + Orama + search → [#170](https://github.com/Collaboration95/theFastandtheFungible/pull/170) → closes #122–#124 (review: 3 blockers — roster fallback, story-bible questions in leak test, golden-ranking test; fixed in one commit). Search knobs live in `SEARCH_TUNING` (`publisher/search.ts`).
- WP-C2 corpus generator → [#171](https://github.com/Collaboration95/theFastandtheFungible/pull/171) → closes #119 (review: 1 blocker — call cap must count provider requests; fixed).
- WP-S2 manifests + AlphaLeak → [#172](https://github.com/Collaboration95/theFastandtheFungible/pull/172) → closes #125, #126 (NO BLOCKERS).
- WP-A1 scope/plan/retrieval/gaps → [#174](https://github.com/Collaboration95/theFastandtheFungible/pull/174) → closes #136–#139 (review: 1 blocker — fixture plan label lost; fixed, plus the verified manifest now rides on each PAID candidate). Knobs: `RETRIEVAL` (rrfK 60, perPublisherK 5) in `server/agents/research.ts`.

## Pivot (6 Oct)
- Direction changed: see [FINAL-PUSH.md](FINAL-PUSH.md). The v1 live demo was real (DeepSeek, Clef, XRPL Testnet) but looked static because every answer came from the 19-doc Vertex corpus and publisher search ignored the query.
- Next: W0 contracts, then W1 search / pay / agent in parallel (FINAL-PUSH §13). Wednesday-night milestone in prompt.md §10.
- Old docs retired: `docs/archive/` holds the 4 Oct prompt, plans and company context; roadmap, agent guide, diagrams and canvas deleted (history in git).
## Decisions I made (overnight)
- `.env` has `LLM_PROVIDER=groq`; the first corpus run (120 calls) went to Groq and hit its 8k TPM limit (4 articles written). Corpus generation now forces `LLM_PROVIDER=deepseek` and `LLM_SYNTHESIS_TIMEOUT_MS=180000` (1,400-word articles exceed the 45 s default). Groq calls do not count against the DeepSeek budget.
- Payments: the buyer now *requires* the verified search manifest before signing (Codex blocker on #173); the invoice root is never trusted from the 402 alone.
## Needs you
- O1: writer websites and article content (FINAL-PUSH §15) before W2 corpus can start.
- O3: keep real institution names (BoJ, JGBs) with synthetic content, or fictionalise them.
- O4: agree the order of W2 UI with the live UX session.
- Thu 8 Oct after the 20:00 freeze: record a labelled fallback video (fixture run, plus one live run with its Langfuse trace).
- Fri 9 Oct: rehearse 3× with `make live` on the presenting laptop over a phone hotspot, then tag `demo-oct10`.
- Before rehearsals: `make doctor` (keys, Testnet wallets, Langfuse); `make wallets` re-funds Testnet wallets after a Testnet reset.
- Cloud Run publisher: in progress on `feat/cloud-run` (separate session); the local publisher stays the fallback.
- Decide on the unmerged old branches `codex/research-agent` (10 commits) and `miul/new-branch` (1 commit): keep or delete.
## Decisions made (5 Oct, owner)
- Writing moved from Groq to DeepSeek `deepseek-flash` (#99/#100): the Groq key's 8k tokens/minute cap forced fixture fallbacks. DeepSeek runs with thinking disabled.
- XRPL Testnet settlement is back (#98): quote hash = InvoiceID, signed hash stored before submit, ledger-verified receipts (#101); one wallet per publisher and a Ledger panel (#103).
- Observability on Langfuse Cloud (US, free tier) instead of self-hosting (#102): traces (#104), scores and a dashboard (#105). Custom `deepseek-flash` model price with off-peak/peak tiers.
## Done since last check-in
- Tooling: `make` targets, doctor, port offset, CI [#97](https://github.com/Collaboration95/theFastandtheFungible/pull/97).
- DeepSeek gateway [#100](https://github.com/Collaboration95/theFastandtheFungible/pull/100); XRPL Testnet [#101](https://github.com/Collaboration95/theFastandtheFungible/pull/101) and per-publisher wallets [#103](https://github.com/Collaboration95/theFastandtheFungible/pull/103).
- Langfuse tracing [#104](https://github.com/Collaboration95/theFastandtheFungible/pull/104); scores and the "ResearchAgent · live health" dashboard [#105](https://github.com/Collaboration95/theFastandtheFungible/pull/105).
- Housekeeping: 24 merged branches deleted.
## In progress
- UI/UX design walkthrough (separate session, `docs/ux-walkthrough/`).
- Cloud Run publisher (separate session).
## Demo check
- PASS (5 Oct): `make live` S$2 → DeepSeek v1 → Clef buys the Grid Operators Report → 0.08 XRP validated on the Testnet in ~5–7 s → v2 QUALIFIES → PDF; ~18–25 s end to end, fully live, traced to Langfuse with 15 scores. S$0 run: no spend. `make verify`: 137 unit + 2 browser tests + build.
