# Short description: three lengths

For the SingHacks finals form (Ripple track). Pick the tier that fits the field. Every
claim is merged and dated; the label check at the bottom maps each one to its source.
Numbers are generated into [facts.json](facts.json) (counts as of
<!--f:as_of-->11 Nov 2026<!--/f-->).

**Copy from the rendered page on GitHub**, not the raw file: the `<!--f:…-->` markers
that keep the numbers in sync are hidden there.

## ~50 words

ResearchAgent is research with a wallet. It answers from free sources, then pays writers
for the articles it is still missing, over x402 on the XRP Ledger, inside your budget.
Only policy code can spend. A writer is paid only by publishing the article's key on the
ledger. Try it live on XRPL Testnet.

## ~150 words

ResearchAgent does research with a wallet. Ask a question and set a budget: it
answers from free sources first, then buys only the articles that fill the gap, at most
one per round, paying writers over x402 on the XRP Ledger. A model recommends; only
deterministic policy code can spend, never past your budget.

New since SingHacks (<!--f:prs-->248<!--/f--> pull requests merged since
<!--f:since-->21 Sep<!--/f-->): key-reveal escrow, where a writer is paid only by
publishing the article's key on the ledger, so delivery and payment are one event;
writer-signed refunds when an article breaks its promise; answers anchored on the ledger;
and two independent receipt verifiers, TypeScript and Python.

Try it in your browser at https://ra-front-651013803640.asia-southeast1.run.app (open
13–19 Nov), or with no clone:
`npx -y <release>/researchagent-mcp-1.0.2.tgz try --testnet`. It is also an MCP server
for Claude Code and Codex.

XRPL Testnet only, no real money. Demo writers are fictional.

## ~300 words

ResearchAgent is an AI agent that does research with a wallet. You ask a question and set a budget.
It answers from free sources first, then buys only the articles that fill the gap, at most
one per round and up to three rounds, paying writers directly over x402 on the XRP Ledger.
A decision model judges what is worth buying, but only deterministic policy code can spend,
and never past your budget.

New since SingHacks (<!--f:prs-->248<!--/f--> pull requests merged since
<!--f:since-->21 Sep<!--/f-->, <!--f:releases-->13<!--/f--> releases):

- **Key-reveal escrow.** Payment is locked in a native XRPL escrow whose condition is the
  hash of the article's key. The writer is paid only by publishing that key on the ledger,
  so delivery and payment are one event. A broken promise is refunded by the writer.
- **Stablecoin-style escrow.** The same flow settles in TEST-SGD, our Testnet token.
  Official RLUSD payments work on Testnet; RLUSD escrow waits on one issuer flag, our top
  builder feedback.
- **Verify, don't trust.** Every Testnet answer is anchored on the ledger. TypeScript and
  Python verifiers re-check receipts, and a public page re-validates
  <!--f:transactions-->61<!--/f--> Testnet transactions in your browser.
- **Reachability.** A live sandbox at https://ra-front-651013803640.asia-southeast1.run.app
  (13–19 Nov); one line with no clone (`try --testnet`); an MCP server for Claude Code and
  Codex; TypeScript and Python SDKs; and a Markdown folder becomes a Testnet writer in
  about <!--f:writer_s-->33.9<!--/f--> s.
- **Honest measurement.** On a blind held-out bank it bought and cited on
  <!--f:heldout-->16/20<!--/f--> questions and bought nothing on
  <!--f:offtopic-->0/10<!--/f--> off-topic ones (fixture decision model, team-authored
  writers).

Builder feedback: <!--f:ranked-->7<!--/f--> ranked XRPL and x402 findings with runnable
repros, plus a mainnet checklist.

What is real: validated XRPL Testnet transactions, no real value. The research writers are
fictional, one team-authored writer is labelled as ours, and TEST-SGD stands in for RLUSD.
Mainnet is disabled in code.

## Label check (for whoever pastes these)

| Claim | Label | Source |
|---|---|---|
| "<!--f:prs-->248<!--/f--> pull requests merged since <!--f:since-->21 Sep<!--/f-->" | Merged into `main` on or after 21 Sep 2026 SGT, counted at <!--f:sha-->329b64f7<!--/f--> on <!--f:as_of-->11 Nov 2026<!--/f--> | [facts.json](facts.json) `prs` ← `site/progress/data.json` queries |
| "<!--f:releases-->13<!--/f--> releases" | Published GitHub releases reachable from the counted commit, prereleases included | same |
| Live sandbox | Shared XRPL Testnet sandbox, no real value, open 13–19 Nov 2026; one pre-funded Testnet payer, per-visitor caps; each answer labels live or fixture models | [hosted-web.md](../hosted-web.md) |
| "buys only the articles that fill the gap, at most one per round" | The plan modal's rule: at most one article per round, up to 3 rounds, within the budget; a new writer may get one labelled probe purchase up to S$0.30 | `shared/contracts/run.ts` `PURCHASE_RULE` |
| Key-reveal escrow, refund | XRPL Testnet, fixture models, fictional writers; the refund after a finish is writer-signed (the fixture writer cooperates) | [#377](https://github.com/Collaboration95/theFastandtheFungible/pull/377), [#379](https://github.com/Collaboration95/theFastandtheFungible/pull/379), [key-reveal-escrow.md](../key-reveal-escrow.md) |
| Stablecoin escrow | TEST-SGD · IOU issued by our Testnet issuer · no real value · stand-in for RLUSD | [#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381), [#384](https://github.com/Collaboration95/theFastandtheFungible/pull/384), [m1-iou](../evidence/m1-iou/README.md) |
| "Official RLUSD payments work on Testnet" | Official Testnet RLUSD issuer, UC2 0.90 paid, UC3 0.30 refunded, 3 Nov | [rlusd.md](../evidence/rlusd.md) |
| "RLUSD escrow waits on one issuer flag" | Issuer flags 2174353408 lack AllowTrustLineLocking; predicted refusal, never submitted | [BUILDER-FEEDBACK §1](../BUILDER-FEEDBACK.md#1-issuer-permission-blocks-rlusd-escrow) |
| <!--f:transactions-->61<!--/f--> Testnet transactions | Rows on the ledger page, each re-checked live and read-only in the browser | [site/ledger/transactions.json](../../site/ledger/transactions.json) |
| `try --testnet` | One cold run took <!--f:try_s-->84.2<!--/f--> s (empty npm cache, fresh faucet wallets, 7 Nov); <!--f:try_misses-->2 of 4<!--/f--> cold attempts overran the 90 s limit | [#387](https://github.com/Collaboration95/theFastandtheFungible/pull/387), [round4-j2](../evidence/round4-j2/README.md) |
| "about <!--f:writer_s-->33.9<!--/f--> s" to a writer | Cold `init` plus `publish` to a validated Credential, generated test note, public faucet | [#389](https://github.com/Collaboration95/theFastandtheFungible/pull/389), [J3](../evidence/round4-j3/slim-onboarding.json) |
| Held-out <!--f:heldout-->16/20<!--/f-->, off-topic <!--f:offtopic-->0/10<!--/f--> | <!--f:heldout_line-->v5 blind held-out: 16/20 bought and cited, 0/10 off-topic purchases (run once, 11 Nov; fixture decision model, team-authored writers, XRPL Testnet)<!--/f-->; the key fact leads in <!--f:answers_it-->7/20<!--/f-->; dev banks (tuned on) v1 <!--f:dev_v1-->16/20<!--/f-->, v3 <!--f:dev_v3-->7/20<!--/f--> | [evidence](../evidence/v4-heldout/README.md) |
| Team-authored writer | team-authored · real content · not an independent writer · Testnet | [#390](https://github.com/Collaboration95/theFastandtheFungible/pull/390) |
