# Short description: three lengths

For the SingHacks finals form (Ripple track). Pick the tier that fits the field. Every
claim is merged and dated; the label check at the bottom maps each one to its source.
Numbers are generated into [facts.json](facts.json) (counts as of
<!--f:as_of-->11 Nov 2026<!--/f-->).

**Copy from the rendered page on GitHub**, not the raw file: the `<!--f:…-->` markers
that keep the numbers in sync are hidden there.

## ~50 words

ResearchAgent is research with a wallet. It answers from free sources, then buys the one
article it is missing, paying the writer over x402 on the XRP Ledger, inside your budget.
The writer is paid only by publishing the article's key on the ledger. Every payment can be
verified. XRPL Testnet only.

## ~150 words

ResearchAgent is research with a wallet. Ask a question and set a budget. It answers from
free sources first; when a piece is missing, it buys one article at a time straight from the
writer, over x402 on the XRP Ledger. The writer is paid only by publishing the article's key
in a native XRPL escrow, so delivery and payment are one ledger event, with no smart
contract. Only deterministic policy code can spend, never past your budget. When nothing is
worth buying it spends nothing, and that refusal is anchored on the ledger too. Every receipt
can be re-checked in your browser or with our Python verifier.

Since SingHacks (<!--f:prs-->248<!--/f--> pull requests merged since
<!--f:since-->21 Sep<!--/f-->): key-reveal escrow, writer-signed refunds, anchored answers,
two verifiers written separately, an MCP server for Claude Code, and a live sandbox at
https://ra-front-651013803640.asia-southeast1.run.app (13–19 Nov). XRPL Testnet only, no real
value; writers are fictional or our own labelled notes.

## ~300 words

ResearchAgent is an AI agent that does research with a wallet. You ask a question and set a budget.
It answers from free sources first, then buys an article only when policy judges that it fills a
gap, at most one per round and up to three rounds, paying writers directly over x402 on the XRP
Ledger. A decision model (or fixed rules, as in the live sandbox) judges what is worth buying, but
only deterministic policy code can spend, and never past your budget.

New since SingHacks (<!--f:prs-->248<!--/f--> pull requests merged since
<!--f:since-->21 Sep<!--/f-->, <!--f:releases-->13<!--/f--> releases):

- **Key-reveal escrow.** Payment is locked in a native XRPL escrow whose condition is the
  hash of the article's key. The writer is paid only by publishing that key on the ledger,
  so delivery and payment are one event. A broken promise is refunded by the writer.
- **Stablecoin-style escrow.** The same flow settles in TEST-SGD, our Testnet token.
  Official RLUSD payments work on Testnet; RLUSD escrow waits on one issuer flag, our top
  builder feedback.
- **Verify, don't trust.** Every Testnet answer is anchored on the ledger, including a refusal.
  TypeScript and Python verifiers, written separately, re-check receipts, and a public page
  re-validates <!--f:transactions-->61<!--/f--> Testnet transactions in your browser.
- **Reachability.** A live sandbox at https://ra-front-651013803640.asia-southeast1.run.app
  (13–19 Nov); one line with no clone (`try --testnet`); an MCP server for Claude Code and
  Codex; TypeScript and Python SDKs; and a Markdown folder becomes a Testnet writer in
  about <!--f:writer_s-->33.9<!--/f--> s.
- **Honest measurement.** On a blind held-out bank it bought and cited on
  <!--f:heldout-->16/20<!--/f--> questions and bought nothing on
  <!--f:offtopic-->0/10<!--/f--> off-topic ones (run once on XRPL Testnet with fixture research
  and decision models, answers written offline, team-authored writers). The key fact leads
  <!--f:answers_it-->7/20<!--/f--> answers; we say so.

Builder feedback: <!--f:ranked-->7<!--/f--> ranked XRPL and x402 findings with runnable
repros, plus a mainnet checklist.

What is real: validated XRPL Testnet transactions, no real value. The demo's research writers
are fictional, two team-authored writers are labelled as ours, and TEST-SGD stands in for RLUSD.
Mainnet is disabled in code.

## For a notes field, slide notes or Q&A

**What is novel (about 80 words).** Delivery-versus-payment for information, built from native
XRPL primitives. The buyer locks payment in an Escrow whose condition is sha256 of the article
key; the writer can collect only by publishing that key in EscrowFinish, which is exactly what
the buyer needs to decrypt. A broken promise gets a writer-signed refund backed by a checkable
fraud proof. Refusals are anchored too, so the agent can prove it chose not to spend. Other
agents can hire it over x402, and cited writers get royalties.

**XRPL usage (about 90 words).**

- **Escrow:** EscrowCreate, EscrowFinish and EscrowCancel with a PREIMAGE-SHA-256
  crypto-condition and CancelAfter. This is key-reveal delivery: <!--f:fee_create-->12<!--/f-->
  + <!--f:fee_finish-->423<!--/f--> = <!--f:fee_drops-->435<!--/f--> drops per purchase.
- **XLS-85 token escrow:** a labelled TEST-SGD IOU, because RLUSD escrow is blocked by an
  issuer flag.
- **Payments:** InvoiceID and memos bind each payment to its signed quote.
- **AccountSet memo anchors:** the audit-log head is written for every finished answer,
  including refusals.
- **Credentials:** CredentialCreate and CredentialAccept for writers.
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

## Label check (for whoever pastes these)

| Claim | Label | Source |
|---|---|---|
| "<!--f:prs-->248<!--/f--> pull requests merged since <!--f:since-->21 Sep<!--/f-->" | Merged into `main` on or after 21 Sep 2026 SGT, counted at <!--f:sha-->329b64f7<!--/f--> on <!--f:as_of-->11 Nov 2026<!--/f--> | [facts.json](facts.json) `prs` ← `site/progress/data.json` queries |
| "<!--f:releases-->13<!--/f--> releases" | Published GitHub releases reachable from the counted commit, prereleases included | same |
| Live sandbox | Shared XRPL Testnet sandbox, no real value, open 13–19 Nov 2026; one pre-funded Testnet payer, per-visitor caps; each answer labels live or fixture models | [hosted-web.md](../hosted-web.md) |
| "buys an article only when policy judges it fills a gap, at most one per round" | The plan modal's rule: at most one article per round, up to 3 rounds, within the budget; a new writer may get one labelled probe purchase up to S$0.30 | `shared/contracts/run.ts` `PURCHASE_RULE` |
| Key-reveal escrow, refund | XRPL Testnet, fixture models, fictional writers; the refund after a finish is writer-signed (the fixture writer cooperates) | [#377](https://github.com/Collaboration95/theFastandtheFungible/pull/377), [#379](https://github.com/Collaboration95/theFastandtheFungible/pull/379), [key-reveal-escrow.md](../key-reveal-escrow.md) |
| Stablecoin escrow | TEST-SGD · IOU issued by our Testnet issuer · no real value · stand-in for RLUSD | [#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381), [#384](https://github.com/Collaboration95/theFastandtheFungible/pull/384), [m1-iou](../evidence/m1-iou/README.md) |
| "Official RLUSD payments work on Testnet" | Official Testnet RLUSD issuer, UC2 0.90 paid, UC3 0.30 refunded, 3 Nov | [rlusd.md](../evidence/rlusd.md) |
| "RLUSD escrow waits on one issuer flag" | Issuer flags 2174353408 lack AllowTrustLineLocking; predicted refusal, never submitted | [BUILDER-FEEDBACK §1](../BUILDER-FEEDBACK.md#1-issuer-permission-blocks-rlusd-escrow) |
| <!--f:transactions-->61<!--/f--> Testnet transactions | Rows on the ledger page, each re-checked live and read-only in the browser | [site/ledger/transactions.json](../../site/ledger/transactions.json) |
| `try --testnet` | One cold run took <!--f:try_s-->84.2<!--/f--> s (empty npm cache, fresh faucet wallets, 7 Nov); <!--f:try_misses-->2 of 4<!--/f--> cold attempts overran the 90 s limit | [#387](https://github.com/Collaboration95/theFastandtheFungible/pull/387), [round4-j2](../evidence/round4-j2/README.md) |
| "about <!--f:writer_s-->33.9<!--/f--> s" to a writer | Cold `init` plus `publish` to a validated Credential, generated test note, public faucet | [#389](https://github.com/Collaboration95/theFastandtheFungible/pull/389), [J3](../evidence/round4-j3/slim-onboarding.json) |
| Held-out <!--f:heldout-->16/20<!--/f-->, off-topic <!--f:offtopic-->0/10<!--/f--> (v5, blind) | <!--f:heldout_line-->v5 blind held-out: 16/20 bought and cited, 0/10 off-topic purchases (run once, 11 Nov, on XRPL Testnet: fixture research and decision models with answers written offline, team-authored writers)<!--/f-->; the key fact leads in <!--f:answers_it-->7/20<!--/f-->; dev banks (tuned on) v1 <!--f:dev_v1-->16/20<!--/f-->, v3 <!--f:dev_v3-->7/20<!--/f--> | [evidence](../evidence/v5-heldout/README.md) |
| Team-authored writers (two: build notes, XRPL explainers) | team-authored · real content · not an independent writer · Testnet | [#390](https://github.com/Collaboration95/theFastandtheFungible/pull/390), [x-explainers](../evidence/x-explainers/README.md) |
| "that refusal is anchored on the ledger too" | XRPL Testnet: a finished run that bought nothing still writes its audit-chain head in an AccountSet memo; a refusal can be shared as a public proof page | [#403](https://github.com/Collaboration95/theFastandtheFungible/pull/403), [qa-prep Q3](qa-prep.md#3-i-asked-my-own-question-what-happens) |
| "re-checked in your browser or with our Python verifier" | Read-only lookups on a public Testnet node; the same checks run offline in the Python package. Verified on a committed hosted export | [hosted-export-nov11](../evidence/hosted-export-nov11/README.md), README "Verify it yourself" |
| "Other agents can hire it over x402, and cited writers get royalties" | XRPL Testnet: the caller pays the budget plus a fixed service fee, and a quarter of that fee goes to the cited writers as royalties | [hire-274](../evidence/hire-274.md), `try --testnet --hire` |
| "a Starter Kit key-reveal example" | A copyable standalone seller and buyer on Testnet; the upstream PR is an unsubmitted draft | [examples/x402-key-reveal-escrow](../../examples/x402-key-reveal-escrow/README.md) |
