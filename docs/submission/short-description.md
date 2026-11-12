# Short description: three lengths

For the SingHacks finals form (Ripple track). Pick the tier that fits the field. Every
claim is merged and dated; the label check at the bottom maps each one to its source.
Numbers are generated into [facts.json](facts.json) (counts as of
<!--f:as_of-->12 Nov 2026<!--/f-->).

**Copy from the rendered page on GitHub**, not the raw file: the `<!--f:…-->` markers
that keep the numbers in sync are hidden there.

## ~50 words

ResearchAgent: research with a wallet on XRPL Testnet. Initial-market hypothesis:
XRPL/x402 integrators using coding agents to implement endpoints or reproduce settlement
failures, buying [practitioner notes](../../data/corpus/v2/articles/team-xrpl-explainers/product-writer-paid.json)
from our team-authored writers. Expected benefit: less reconstruction work.
Budget-limited policy buying; key-reveal payment. No independent writers, customers,
pilots or revenue. No real value.

## ~150 words

ResearchAgent is research with a wallet on XRPL Testnet. Set a question and budget.
It reads free sources first; policy can buy one article per round. Writers collect by
publishing article keys in native escrow. The key that unlocks the article is the same key that releases the writer’s payment. The app shows the article after ledger validation; signed submission can expose the key earlier, and the escrow remains claimable with it until CancelAfter. Your browser hashes the public key against the lock.
Verify one hosted 12 Nov run where the browser check shows all five gates held, without asking a question. Identity/origin skips remain.

Our initial-market hypothesis: XRPL/x402 integrators using coding agents to buy practitioner
implementation notes and reproducible failure paths. They implement endpoints or diagnose
failed settlement. Team-authored writers supply those notes today; the expected benefit is a cited implementation detail without reconstructing a failure.
[Example: writer payment](../../data/corpus/v2/articles/team-xrpl-explainers/product-writer-paid.json).
No independent writers, customers, pilots or revenue.

Three team writers hold accepted operator-issued XRPL Testnet Credentials; a Testnet
Permissioned Domain lists accepted issuers; identity only, not KYC or quality. The sandbox
uses live answers, rule-based buying. No real value; mainnet spending disabled.

## ~300 words

ResearchAgent is research with a wallet on XRPL Testnet. Ask a question and set a budget.
Free sources come first; policy judges whether an article fills a gap, at most one per round
for three rounds. Only deterministic policy code can spend within that budget.

Our initial-market hypothesis is XRPL/x402 integrators using coding agents to buy practitioner
implementation notes and reproducible failure paths. Today our team-authored writers supply
the notes for implementing endpoints or diagnosing failed settlement. The expected benefit
is a cited detail without reconstructing the failure alone. [Example note](../../data/corpus/v2/articles/team-xrpl-explainers/product-writer-paid.json). We would test repeat demand here before adding other expert shelves.
No independent writers, customers, pilots or revenue.

- **Key-reveal delivery.** Writers collect by publishing the article key in EscrowFinish.
  Your browser reads the public create/finish and recomputes sha256(key) against the lock.
  This proves the key reveal, not quality. A broken promise can receive a writer-signed
  refund; a real writer could refuse. No-show recovery requires validated EscrowCancel.
- **Verify without a question.** The judges’ corner checks a recorded sandbox run. TypeScript
  and Python verifiers, written separately, check exported receipts. Once its anchor validates,
  a finished Testnet answer can be checked against the ledger even when nothing was bought.
- **Recorded unsigned verdicts.** rippled returned tecNO_PERMISSION for RLUSD escrow on
  Testnet and Mainnet; a matched TEST-SGD control succeeded on Testnet. Nothing signed or
  submitted. TEST-SGD is an unbacked stand-in (CLI/evidence); the live sandbox pays in Testnet XRP.
- **Identity.** Build notes, XRPL explainers and Open Records hold accepted operator-issued
  Testnet Credentials; a Testnet Permissioned Domain lists accepted issuers; identity only,
  not KYC or quality. Open Records supplies free records.
- **Honest measurement.** The blind v5 run bought/cited <!--f:heldout-->16/20<!--/f--> and its key fact led
  <!--f:answers_it-->7/20<!--/f--> answers: fixture research and decision models, answers written offline,
  Testnet, team-authored writers. [Scope](../evidence/v5-heldout/README.md).

The sandbox uses live answers, rule-based buying; no real value. Mainnet spending is disabled.

## For a notes field, slide notes or Q&A

**What is novel (about 80 words).** Delivery-versus-payment for information, built from native
XRPL primitives. The buyer locks payment in an Escrow whose condition is sha256 of the article
key; the writer can collect only by publishing that key in EscrowFinish, which is exactly what
the buyer needs to decrypt. A broken promise can receive a writer-signed refund backed by a checkable
fraud proof. A finished refusal can be anchored too, once its audit-head transaction validates. Other
agents can hire it over x402, and cited writers get royalties.

**XRPL usage (about 90 words).**

- **Escrow:** EscrowCreate, EscrowFinish and EscrowCancel with a PREIMAGE-SHA-256
  crypto-condition and CancelAfter. This is key-reveal delivery: <!--f:fee_create-->12<!--/f-->
  paid by the buyer to lock + <!--f:fee_finish-->423<!--/f--> paid by the writer to reveal =
  <!--f:fee_drops-->435<!--/f--> drops per purchase.
- **XLS-85 token escrow:** a labelled TEST-SGD IOU (CLI and evidence; the live sandbox pays in
  Testnet XRP), with recorded unsigned RLUSD tecNO_PERMISSION verdicts on both networks.
- **Payments:** InvoiceID and memos bind each payment to its signed quote.
- **AccountSet memo anchors:** eligible finished Testnet answers queue an audit-head anchor,
  including refusals; claim anchoring only once validated.
- **Credentials:** CredentialCreate/Accept for three team writers, accepted from our operator issuer on Testnet. A Testnet Permissioned Domain lists accepted issuers; identity only, not KYC or quality. Advisory, not payment gating.
- **Checks:** validated-ledger finality and `delivered_amount` checks.
- **Browser verification:** read-only lookups on a public Testnet node over WebSocket,
  re-checking <!--f:transactions-->61<!--/f--> recorded transactions.

**Builder feedback (about 80 words).** <!--f:ranked-->7<!--/f--> ranked findings, each with an
offline repro under 30 s, plus a mainnet checklist: (1) the RLUSD issuer lacks
AllowTrustLineLocking, so token escrow is impossible for it; (2) only `delivered_amount` proves an
issued amount; (3) a signed IOU quote overflowed the 1 KiB Memo limit; (4) escrow expiry doesn't
return funds without EscrowCancel; (5) public endpoints disagree on retained history, and HTTP
lacks CORS; (6) invoice consumption blocks recovery; (7) header-only x402 v2 challenges aren't
retried. <!--f:filed-->0<!--/f--> filed upstream so far; paste-ready drafts and a Starter Kit
key-reveal example are in the repo. What worked: escrow semantics, Credentials, fast finality.

- **Unsigned simulate:** buyer escrow creates consult rippled before signing; writer finishes use a key-free ledger pre-check. Simulation is not submission or a settlement guarantee.

## Label check (for whoever pastes these)

| Claim | Label | Source |
|---|---|---|
| "<!--f:prs-->305<!--/f--> pull requests merged since <!--f:since-->21 Sep<!--/f-->" | Merged into `main` on or after 21 Sep 2026 SGT, counted at <!--f:sha-->e37be882<!--/f--> on <!--f:as_of-->12 Nov 2026<!--/f--> | [facts.json](facts.json) `prs` ← `site/progress/data.json` queries |
| "<!--f:releases-->15<!--/f--> releases" | Published GitHub releases reachable from the counted commit, prereleases included | same |
| Live sandbox | Shared XRPL Testnet sandbox, no real value, open 13–19 Nov 2026; one pre-funded Testnet payer, per-visitor caps; each answer labels live or fixture models | [hosted-web.md](../hosted-web.md) |
| "buys an article only when policy judges it fills a gap, at most one per round" | The plan modal's rule: at most one article per round, up to 3 rounds, within the budget; a new writer may get one labelled probe purchase up to S$0.30 | `shared/contracts/run.ts` `PURCHASE_RULE` |
| Key-reveal escrow, refund | XRPL Testnet, fixture models, fictional writers; the refund after a finish is writer-signed (the fixture writer cooperates) | [#377](https://github.com/Collaboration95/theFastandtheFungible/pull/377), [#379](https://github.com/Collaboration95/theFastandtheFungible/pull/379), [key-reveal-escrow.md](../key-reveal-escrow.md) |
| Stablecoin escrow | TEST-SGD · IOU issued by our Testnet issuer · no real value · stand-in for RLUSD | [#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381), [#384](https://github.com/Collaboration95/theFastandtheFungible/pull/384), [m1-iou](../evidence/m1-iou/README.md) |
| "Official RLUSD payments work on Testnet" | Official Testnet RLUSD issuer, UC2 0.90 paid, UC3 0.30 refunded, 3 Nov | [rlusd.md](../evidence/rlusd.md) |
| "Recorded rippled simulate → tecNO_PERMISSION" | Unsigned Testnet + Mainnet probes, 11 Nov; TEST-SGD control tesSUCCESS; nothing signed/submitted | [Recorded verdicts](../evidence/dry-run-nov12/result.json) |
| <!--f:transactions-->61<!--/f--> Testnet transactions | Rows on the ledger page, each re-checked live and read-only in the browser | [site/ledger/transactions.json](../../site/ledger/transactions.json) |
| `try --testnet` | One cold run took <!--f:try_s-->84.2<!--/f--> s (empty npm cache, fresh faucet wallets, 7 Nov); <!--f:try_misses-->2 of 4<!--/f--> cold attempts overran the 90 s limit | [#387](https://github.com/Collaboration95/theFastandtheFungible/pull/387), [round4-j2](../evidence/round4-j2/README.md) |
| "about <!--f:writer_s-->33.9<!--/f--> s" to a writer | Cold `init` plus `publish` to a validated Credential, generated test note, public faucet | [#389](https://github.com/Collaboration95/theFastandtheFungible/pull/389), [J3](../evidence/round4-j3/slim-onboarding.json) |
| Held-out <!--f:heldout-->16/20<!--/f-->, off-topic <!--f:offtopic-->0/10<!--/f--> (v5, blind) | <!--f:heldout_line-->v5 blind held-out: 16/20 bought and cited, 0/10 off-topic purchases (run once, 11 Nov, on XRPL Testnet: fixture research and decision models with answers written offline, team-authored writers)<!--/f-->; the key fact leads in <!--f:answers_it-->7/20<!--/f-->; dev banks (tuned on) v1 <!--f:dev_v1-->16/20<!--/f-->, v3 <!--f:dev_v3-->7/20<!--/f--> | [evidence](../evidence/v5-heldout/README.md) |
| Operator-run sources: two team-authored writers plus free Open Records | Three accepted Testnet Credentials; operator-issued identity only; no independent writers | [#390](https://github.com/Collaboration95/theFastandtheFungible/pull/390), [x-explainers](../evidence/x-explainers/README.md) |
| "that refusal is anchored on the ledger too" | XRPL Testnet: a finished run that bought nothing queues its audit-chain head in an AccountSet memo; after validation and explicit sharing, a retained refusal can have a public proof page | [#403](https://github.com/Collaboration95/theFastandtheFungible/pull/403), [qa-prep Q3](qa-prep.md#3-i-asked-my-own-question-what-happens) |
| "re-checked in your browser or with our Python verifier" | Read-only lookups on a public Testnet node; the same checks run offline in the Python package. Verified on a committed hosted export | [hosted-export-nov11](../evidence/hosted-export-nov11/README.md), README "Verify it yourself" |
| "Other agents can hire it over x402, and cited writers get royalties" | XRPL Testnet: the caller pays the budget plus a fixed service fee, and a quarter of that fee goes to the cited writers as royalties | [hire-274](../evidence/hire-274.md), `try --testnet --hire` |
| "a Starter Kit key-reveal example" | A copyable standalone seller and buyer on Testnet; the upstream PR is an unsubmitted draft | [examples/x402-key-reveal-escrow](../../examples/x402-key-reveal-escrow/README.md) |
