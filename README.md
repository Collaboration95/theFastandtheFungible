<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/brand/lockup-on-dark.svg">
    <img src="design/brand/lockup.svg" alt="ResearchAgent" height="48">
  </picture>
</p>

<h3 align="center">Research with a wallet.</h3>

<p align="center">
  ResearchAgent answers from free sources first, then pays writers for the articles it is still missing,
  over x402 on the XRP Ledger, inside a budget you set. The writer is paid only by publishing the
  article's key on the ledger.
</p>

<p align="center">
  <a href="https://ra-front-651013803640.asia-southeast1.run.app"><b>Try it live →</b></a>
  &nbsp;·&nbsp;
  <a href="https://collaboration95.github.io/theFastandtheFungible/demo/">Watch a recorded run</a>
  &nbsp;·&nbsp;
  <a href="https://collaboration95.github.io/theFastandtheFungible/progress/">Progress since SingHacks</a>
</p>

<p align="center">
  <a href="https://github.com/Collaboration95/theFastandtheFungible/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/Collaboration95/theFastandtheFungible?style=flat-square&label=release&color=24211E"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-24211E?style=flat-square"></a>
  <a href="docs/x402-xrpl.md"><img alt="XRPL Testnet" src="https://img.shields.io/badge/XRPL-Testnet-24211E?style=flat-square"></a>
</p>

The live sandbox is open **13–19 Nov 2026** on XRPL Testnet with no real value and nothing to
install. The recorded run works any time. Or run the whole money path yourself, with no clone and
no account (Node ≥ 22.13):

```sh
REL=https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1
npx -y $REL/researchagent-mcp-1.1.1.tgz try --testnet
```

<p align="center">
  <img src="docs/media/readme-answer.png" width="900" alt="The hosted demo after an XRPL Testnet run. Question: what HTTP headers does x402 use on XRPL, and how does the server know the payment actually settled? The lead finding: an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; the client chooses supported terms, authorizes payment and retries with PAYMENT-SIGNATURE. The payment card shows a net cost of S$0.80 of a S$2.00 budget for two articles, each paid by key reveal: payment locked in escrow, writer released the key, key matches the escrow lock, article unlocked. The answer is anchored on XRPL Testnet.">
</p>
<p align="center"><sub>The live sandbox, 11 Nov 2026 · XRPL Testnet · live answers, rule-based buying · team-authored writers · no real value · <a href="docs/evidence/hosted-export-nov11/README.md">its five transactions and receipts</a></sub></p>

## What it does

- **Ask with a budget.** From the browser, Claude Code or Codex over MCP, TypeScript or Python,
  or the Mac app. Every question carries its own spending limit.
- **Free sources first, then buy only what fills the gap.** Writers search their own articles and
  sign promises about what each one contains. A decision model (or fixed rules, as in the live
  sandbox), weighted by each writer's trust score, judges which paid article is worth it: at most
  one per round, up to three rounds. Only policy code can pay, within your budget.
- **The writer is paid by revealing the key.** Policy code locks payment in a native XRPL escrow
  that only the article's key can open. Publishing the key on the ledger is what pays the writer,
  so delivery and payment are one event.
- **Every claim has a receipt.** The answer cites the exact passages it bought. A broken promise
  is refunded, each answer is anchored on the ledger, and anyone can re-check the receipts offline.

## How it works

![Key-reveal escrow in five steps: policy code locks payment to the hash of the article key; the writer publishes the key in EscrowFinish and is paid; the buyer decrypts and checks every signed promise; a broken promise is refunded by the writer; the answer is anchored on the ledger](docs/media/key-reveal.svg)

Key reveal makes *delivery* atomic, not quality: if an article breaks its promise after the key is
out, the refund is a payment the writer signs. Our fixture writer cooperates; a real one could
refuse, so the buyer keeps a fraud proof anyone can check and the writer's trust score drops.
[Mechanism](docs/key-reveal-escrow.md) · [architecture](docs/capabilities.md#how-a-run-works).

### Hard guarantees

Every gate has regression tests and a [read-only audit rule](scripts/gate-audit.ts):

| Guarantee | Enforcement test | Audit rule |
|---|---|---|
| No premium bytes before a grant | [Purchase boundary](tests/purchase.test.ts), [raw leak audit](tests/gate-audit.test.ts) | `premium_leak` |
| Only policy code spends, within the prompt budget | [Budget and stop cases](tests/purchase.test.ts) | `purchase_without_policy`, `over_budget` |
| One charge per intent | [Parallel pays and restart cases](tests/purchase.test.ts) | `duplicate_settlement` |
| Real citations to delivered passages | [Grant and proof cases](tests/purchase.test.ts) | `citation_without_verified_grant` |
| Simulated or substituted work is labelled | [Rail label regression](tests/gate-audit.test.ts) | `missing_rail_label` |

## Use it from your agent

Give Claude Code a research wallet on XRPL Testnet. The caps live in the environment, where the
calling model cannot raise them:

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-mcp-1.1.1.tgz --testnet
```

Or call it from code:

```sh
npm i https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-sdk-1.1.1.tgz
pip install https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-1.1.1-py3-none-any.whl
```

- **Agent hires agent.** Another agent pays ResearchAgent over x402, and cited writers get
  royalties: append `--hire` to the `try --testnet` line · [how](docs/hire.md).
- **Writers.** A Markdown folder becomes a payable Testnet writer with an XRPL Credential in two
  commands · [publishing](docs/publishing.md).
- **Everything else:** Codex and Claude Desktop, TEST-SGD escrow, the zero-clone web app, the Mac
  app and a full checkout are in the [install guide](docs/install.md).

## Verify it yourself

<details>
<summary>Six Testnet transactions from one recorded run, and how to re-check them</summary>

| Step | Transaction on XRPL Testnet |
|---|---|
| Escrow created for AlphaLeak (fictional writer) | [319923F5…2AA3EB](https://testnet.xrpl.org/transactions/319923F5F4863F3E1505424E6FC8F20B365E7A926F1086197CB68DF6842AA3EB) |
| Key published; the article then broke its promise | [57BA72D4…EC4B2B8C](https://testnet.xrpl.org/transactions/57BA72D45D4A6B39097B678E06CF9F8FF38F426879791138461425CEEC4B2B8C) |
| Refund, signed by the writer | [BB71016D…16B2DA82](https://testnet.xrpl.org/transactions/BB71016D63ACF759E8C5B4B99E118C17DDD1E7C01F3770327C5C316864B2DA82) |
| Escrow created for The Fab Floor (fictional writer) | [7FC899B5…6CA94C60](https://testnet.xrpl.org/transactions/7FC899B54AC439BB7FC3DC7BF9A57837FB06BAECF998D92F86841DA61CA94C60) |
| Key published · sha256(K) = Condition ✓ | [8A8A3A8E…A947E366](https://testnet.xrpl.org/transactions/8A8A3A8E1770BE5FD5FD5192DF1C37E84854320373D91BDBB4D806E5A947E366) |
| Answer anchored (memo = audit head) | [7501BAD9…F37A4BE1](https://testnet.xrpl.org/transactions/7501BAD9994552932D7F52AA96A53313163207C86438C9C01D33B069F37A4BE1) |

Re-check the whole run with Python and no Node (read-only lookups on s.altnet), after the
`pip install` above:

```sh
curl -LO https://raw.githubusercontent.com/Collaboration95/theFastandtheFungible/v1.1.1/docs/evidence/lane-b3/UC3.receipts.json
researchagent verify UC3.receipts.json --ledger
```

It ends with `RESULT PASS`. The same command checks the `receipts.json` you export from any run
in the [live sandbox](https://ra-front-651013803640.asia-southeast1.run.app) (use v1.1.0 or later;
v1.0.2 cannot recompute the newer answer commitment). Without Python:
`npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-mcp-1.1.1.tgz verify receipts.json --ledger`. The [ledger page](https://collaboration95.github.io/theFastandtheFungible/ledger/)
re-validates all <!--f:transactions-->61<!--/f--> recorded Testnet transactions from your browser.
TypeScript and Python verifiers, written separately, agree on all <!--f:vectors-->224<!--/f-->
shared conformance cases ([receipt format](docs/receipt-spec.md)).

</details>

## Numbers

| What we measured | Result | Scope and date |
|---|---|---|
| Blind held-out judge questions (<!--f:heldout_bank-->v5<!--/f-->) | <!--f:heldout-->16/20<!--/f--> bought and cited; <!--f:offtopic-->0/10<!--/f--> off-topic purchases; <!--f:heldout_violations-->0<!--/f--> gate violations | run once on <!--f:heldout_on-->11 Nov<!--/f--> on XRPL Testnet; fixture research and decision models, answers written offline (the hosted demo writes live with DeepSeek); team-authored writers |
| One line to a verified purchase | <!--f:try_s-->84.2<!--/f--> s cold; <!--f:try_misses-->2 of 4<!--/f--> cold runs overran 90 s | one Mac, empty npm cache, 7 Nov |
| Network fees per key-reveal purchase | <!--f:fee_drops-->435<!--/f--> drops: <!--f:fee_create-->12<!--/f--> paid by the buyer to lock, <!--f:fee_finish-->423<!--/f--> by the writer to reveal | XRPL Testnet, measured as we sign |
| Progress since SingHacks | <!--f:prs-->270<!--/f--> PRs merged since <!--f:since-->21 Sep<!--/f-->; <!--f:releases-->15<!--/f--> releases | counted at <!--f:sha-->bd52beff<!--/f--> on <!--f:as_of-->11 Nov 2026<!--/f--> |

Development banks we tuned on, the synthetic-corpus scorecard, cost and latency:
[docs/numbers.md](docs/numbers.md). What shipped when, with the misses we kept:
[progress page](https://collaboration95.github.io/theFastandtheFungible/progress/).

## Builder feedback

<!--f:feedback_line-->7 ranked findings with runnable repros · 35 numbered findings (B01–B35) · 15 submissions on 4–5 Sep · 8 upstream drafts, 0 filed<!--/f-->.
The top three: the RLUSD issuer lacks the flag that token escrow needs; an issued amount must be
checked as the delivered amount; a signed IOU quote overflowed the 1 KiB Memo limit.
[Read it in 90 seconds](docs/BUILDER-FEEDBACK.md) · [mainnet checklist](docs/BUILDER-FEEDBACK.md#mainnet-readiness-checklist).

## Status and limits

- **XRPL Testnet only, no real value.** Mainnet is disabled in code; readiness is a
  [checklist](docs/BUILDER-FEEDBACK.md#mainnet-readiness-checklist), not a claim.
- **Writers.** The demo's research writers are fictional. Two team-authored writers (our own XRPL
  build notes and sourced explainers) are labelled as ours and are not independent. No independent
  writers yet: consenting writers will be listed as **real person · Testnet · no real value**
  ([list](docs/evidence/real-writers.json)).
- **New writers get one labelled probe.** A new writer's best matching article may get one probe
  purchase of up to S$0.30 inside your budget, shown as *probe purchase · new writer*.
- **TEST-SGD stands in for RLUSD** in token escrow (CLI and evidence; the live sandbox pays in Testnet XRP); official RLUSD payments work on Testnet.
- **Live sandbox.** One shared Testnet payer, per-visitor caps, owner controls off. Answers are
  written live by DeepSeek; purchases are decided by the rule-based model, as the header chip says,
  and an answer says so if it falls back to a labelled fixture. Open 13–19 Nov 2026.
- **Packages** are on GitHub Releases, not yet on npm, PyPI or the MCP Registry. The Mac app is an
  unsigned DMG.
- `theFastandtheFungible` is the team and repository name; the product is **ResearchAgent**.

[Docs](docs/README.md) · [Install](docs/install.md) · [Capabilities](docs/capabilities.md) ·
[Numbers](docs/numbers.md) · [Engineering](docs/engineering.md) ·
[Progress](https://collaboration95.github.io/theFastandtheFungible/progress/) ·
[Deck (PDF)](docs/submission/ResearchAgent-SFF-deck.pdf) ·
[Explainers](https://collaboration95.github.io/theFastandtheFungible/) ·
[Changelog](CHANGELOG.md) · [Contributing](.github/CONTRIBUTING.md) · [Security](.github/SECURITY.md) ·
[MIT license](LICENSE)
<!-- Video slot: once the demo video is uploaded, add a "Video" link after "Progress" in the line above (see VIDEO_URL in docs/submission/README.md). -->
