<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/brand/lockup-on-dark.svg">
    <img src="design/brand/lockup.svg" alt="ResearchAgent" height="48">
  </picture>
</p>

<h3 align="center">Paid on delivery. Proven on the ledger.</h3>

<p align="center">
  ResearchAgent is research with a wallet. Policy can buy articles within your budget over x402
  on XRPL Testnet. Writers collect by publishing article keys; your browser checks the key
  against its escrow lock on the public ledger.
</p>

<p align="center">
  <a href="https://ra-front-651013803640.asia-southeast1.run.app"><b>Check a recorded run — no question used →</b></a>
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

**Verify a recorded run without asking a question** in the judges’ corner. A payment’s
**Check the key yourself** recomputes `sha256(key) = lock`. A match proves key reveal,
not quality or identity; pending/unavailable is not a pass.

Shared Testnet demo: **13–19 Nov 2026**, no real value. Or run locally (Node ≥ 22.13):

```sh
REL=https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1
npx -y $REL/researchagent-mcp-1.1.1.tgz try --testnet
```

<p align="center">
  <img src="docs/media/readme-answer.png" width="900" alt="The hosted demo after an XRPL Testnet run. Question: what HTTP headers does x402 use on XRPL, and how does the server know the payment actually settled? The lead finding: an HTTP 402 response offers payment requirements in PAYMENT-REQUIRED; the client chooses supported terms, authorizes payment and retries with PAYMENT-SIGNATURE. The payment card shows a net cost of S$0.80 of a S$2.00 budget for two articles, each paid by key reveal: payment locked in escrow, writer released the key, key matches the escrow lock, article unlocked. The answer is anchored on XRPL Testnet.">
</p>
<p align="center"><sub>Historical screenshot: the live demo, 11 Nov 2026 · XRPL Testnet · live answers, rule-based buying · team-authored writers · no real value · <a href="docs/evidence/hosted-export-nov11/README.md">its five transactions and receipts</a></sub></p>

## One useful paid answer · hosted Testnet run

**“How does the writer get paid, and what stops the agent from reading the article and then refusing to pay?”**

| Free evidence → missing fact → paid evidence → final answer | HOSTED-12, 12 Nov 2026 |
|---|---|
| Free draft | No citable answer; <!--f:paid_before-->2<!--/f--> recorded open gaps. |
| Missing fact | What binds key publication to payment? |
| Bought passage | [Team-authored passage p3](data/corpus/v2/articles/team-xrpl-explainers/product-writer-paid.json): validated EscrowFinish publishes the key and releases payment together. |
| Final answer | The writer publishes the key to collect escrow payment; <!--f:paid_after-->0<!--/f--> recorded open gaps. This is the run’s answer record, not independent quality scoring. |
| Same-run cost and time | <!--f:paid_articles-->1<!--/f--> article, <!--f:paid_passages-->4<!--/f--> passages; S$<!--f:paid_spend-->0.40<!--/f--> = <!--f:paid_principal-->40,000<!--/f--> Testnet drops at the fixed demo rate, not FX; no refunds. <!--f:paid_seconds-->65.8<!--/f--> s Start→Done, excluding planning and the five-second confirmation modal. Buyer create <!--f:paid_create-->12<!--/f--> drops; writer finish <!--f:paid_finish-->423<!--/f-->; buyer anchor another <!--f:paid_anchor-->12<!--/f-->. Model cost: **<!--f:paid_model_cost-->unmeasured<!--/f-->** (usage not retained). |

One hosted run on 12 Nov, DEPLOY-3 · live DeepSeek plan/final answer, rule-based buying ·
initial draft fixture · keyword fallback · team-authored writer · XRPL Testnet XRP, no real value.
No new held-out or general quality claim. [Evidence and receipts](docs/submission/evidence/hosted-answer-nov12/README.md) ·
[lock](https://testnet.xrpl.org/transactions/CB872E5FEF205F8E31BB522A57EF5CFCC7F815DE4770F29A9856EA1F724E04A6) ·
[key/payment](https://testnet.xrpl.org/transactions/EF66F5C9FD1DE68E8167189CF4FAF5DB94ABD3FA561C65F9D4DACA8828177930) ·
[anchor](https://testnet.xrpl.org/transactions/EC4ABD3FBCAFC035E71D5BA74C01529D9AA52D45D9A228896A24BD8C44187EF6).

## What it does

- **Ask with a budget** in the browser, over MCP, through SDKs or the Mac app.
- **Free sources first; policy judges whether to buy.** Signed writer promises and trust
  inform selection. Only policy code spends: one article per round, up to three rounds.
- **Check delivery and payment receipts.** The answer cites delivered passages. A broken
  promise can receive a writer-signed refund; a real writer could refuse. No-show recovery
  requires validated EscrowCancel after the deadline. Completed Testnet answers can be
  anchored; claim anchoring only after validation.

## How it works

![Key-reveal escrow: policy locks payment; writer publishes the key to collect; buyer checks signed promises and cites delivered passages](docs/media/key-reveal.svg)

Key reveal proves delivery, not quality. [Mechanism and refund limits](docs/key-reveal-escrow.md) ·
[architecture](docs/capabilities.md#how-a-run-works).

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

Give Claude Code a Testnet research wallet. The model cannot raise environment caps:

```sh
claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-mcp-1.1.1.tgz --testnet
```

Or call it from code:

```sh
npm i https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-sdk-1.1.1.tgz
pip install https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.1.1/researchagent-1.1.1-py3-none-any.whl
```

- **Agent hires agent.** Add `--hire`: Testnet service fee and writer royalties · [how](docs/hire.md).
- **Writers.** Publish Markdown notes on Testnet · [publishing](docs/publishing.md).
- [Install guide](docs/install.md): Codex, Claude Desktop, TEST-SGD, web and Mac apps.

## Verify it yourself

[Open the judges’ corner](https://ra-front-651013803640.asia-southeast1.run.app) →
**Check our work · recorded run and ledger** → **Run the checks**. Read pass/skip groups
separately. The page, receipt file and public node must be reachable.

<details>
<summary>Featured run: one hosted run, 12 Nov · all five gates Held</summary>

**One hosted run, 12 Nov:** 09:07:38.656–09:08:09.738 SGT; **31.1 s, S$0.40,
1 article, no refund; five gates Held** (grant 1953 < reads 1954–1957).
Browser/TS **24 passed / 0 failed / 2 skipped**; wheel **25/0/2**; Testnet **6/6**.
[Receipts, labels and timing scope](docs/evidence/hosted-export-nov12/README.md) ·
[lock](https://testnet.xrpl.org/transactions/F4A608E20BE054B77F4FF2D4B1ED3EBC3EF54FC7D0A144CE56975163C6E7D795) ·
[key/payment](https://testnet.xrpl.org/transactions/01A6A7E07652216B102DFD1FED13462539D43475DFFBBA5A3C6E0FB12F643F1D) ·
[anchor](https://testnet.xrpl.org/transactions/E71B20085CBF1DE65153462931D5BAD7F40D23AA54A372D70DF547AFD2722ECA).

</details>

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
in the [live demo](https://ra-front-651013803640.asia-southeast1.run.app) (use v1.1.0 or later;
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
| Progress since SingHacks | <!--f:prs-->299<!--/f--> PRs merged since <!--f:since-->21 Sep<!--/f-->; <!--f:releases-->15<!--/f--> releases | counted at <!--f:sha-->8c6b9018<!--/f--> on <!--f:as_of-->12 Nov 2026<!--/f--> |

[Numbers and limitations](docs/numbers.md) · [Progress and retained misses](https://collaboration95.github.io/theFastandtheFungible/progress/).

## Builder feedback

<!--f:feedback_line-->7 ranked findings with runnable repros · 35 numbered findings (B01–B35) · 15 submissions on 4–5 Sep · 8 upstream drafts, 0 filed<!--/f-->.
Top finding: [unsigned rippled probes](docs/evidence/dry-run-nov12/README.md) returned
`tecNO_PERMISSION` for RLUSD escrow on Testnet and Mainnet; TEST-SGD control `tesSUCCESS`
on Testnet. Nothing signed or submitted.
[Read it in 90 seconds](docs/BUILDER-FEEDBACK.md) · [mainnet checklist](docs/BUILDER-FEEDBACK.md#mainnet-readiness-checklist).

## Status and limits

- **XRPL Testnet only, no real value.** Mainnet signing is disabled. [Readiness gaps](docs/BUILDER-FEEDBACK.md#mainnet-readiness-checklist).
- **Writers.** Two team-authored writers, Build notes and XRPL explainers, supply paid notes;
  Open Records supplies free records. These three team writers hold accepted XRPL Testnet
  Credentials from our operator issuer; a Testnet Permissioned Domain lists accepted issuers;
  identity only, not KYC or quality. Fictional writers stay unverified; hosted badges require configuration. **No independent writers, customers,
  pilots or revenue yet.** Consenting writers will be labelled **real person · Testnet · no real value**. ([Identity evidence](docs/evidence/writer-credentials-nov12/README.md)).
- **New writers get one labelled probe.** Policy may buy one matching article up to S$0.30, inside your budget (*probe purchase · new writer*).
- **TEST-SGD stands in for RLUSD** in token escrow (CLI and evidence; the live demo pays in Testnet XRP); official RLUSD payments work on Testnet.
- **Live demo.** Live answers, rule-based buying; fixture fallbacks labelled. One shared payer, visitor caps, owner controls off.
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
