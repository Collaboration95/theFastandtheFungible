# Build status (5 Oct 2026, 20:55 SGT)
## Needs you
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
