# Prepared answers

Evidence context: XRPL Testnet demo. Use these answers when asked; the pitch ends on the key check.

## 1. What is the product?

ResearchAgent is a search engine for agent-readable expertise, with a wallet. It
reads free sources, the XRPL and x402 documentation, then policy rules decide purchases within a question’s budget. <!-- HOSTED-PENDING -->
The Fast and the Fungible is the team and repository name.

## 2. Can the model spend?

No. Only deterministic policy code initiates a purchase. Environment caps bound MCP
clients and cannot be raised by the calling model. The five-second plan sheet confirms
the plan; there is no per-purchase approval modal. A labelled new-writer probe can buy
one matching article up to S$0.30 within budget.

## 3. What if my question needs no purchase?

It answers from free evidence or declines the unsupported part. A completed answer
can queue an audit-head anchor even when nothing was bought. Claim anchoring only
after ledger validation. Public sharing is explicit and subject to retention.

## 4. Who buys first? Is demand validated?

We target XRPL/x402 integrators using coding agents to implement paid endpoints or
diagnose settlement failures. The expected benefit is a cited practitioner detail
without reconstructing the failure alone. This initial-market hypothesis is not yet
validated. No outside customers, pilots or revenue.
[Example note](../../data/corpus/v2/articles/team-xrpl-explainers/product-writer-paid.json).

## 5. Who wrote the articles?

The free tier is the XRPL and x402 documentation, with upstream names and licences. <!-- HOSTED-PENDING -->
Paid reports come from a ledger-analytics writer, signed “as of validated ledger N”; Build
notes and XRPL explainers are two team-authored writers. The real-content profile excludes
all eight fictional publishers; older recorded replays and the frozen evaluations still
use them. A copied corpus is not evidence of an external seller market.

## 6. What does key reveal enforce?

The writer collects by publishing the article key in EscrowFinish. The app grants
access only after validated success and matching proofs. Signed submission can expose
the key before validation, so later failure remains a risk. The escrow stays claimable
with that key until CancelAfter. The first key-bearing network request is the persisted
signed finish, after a key-free ledger pre-check. [Mechanism evidence](../evidence/dry-run-nov12/README.md).

## 7. Does a match prove article quality?

A key match proves reveal, not quality or identity. The browser reads the validated
create/finish from a public node and recomputes the lock. It trusts that public-node
response rather than running a full node. Missing data is pending; unreachable is
unavailable, never a pass. Signed promises and passage proofs are checked separately.

## 8. Can you force a quality refund?

Partly. With the opt-in holdback on, <!--f:holdback_percent-->20<!--/f-->% of the price goes into a second escrow, created with the first in one atomic Batch. Buyer policy releases it when the promise checks pass and takes it back after a deadline when they fail, with no writer cooperation: <!--f:holdback_total-->17<!--/f--> real purchases, <!--f:holdback_released-->11<!--/f--> released and <!--f:holdback_refunded-->6<!--/f--> refunded, all verified (fixture articles, forced promise failures). <!-- HOSTED-PENDING -->
Only the holdback share is refundable: the key-release payment stays paid, and fees stay paid. Without the holdback, a refund needs the writer’s signature; the historical broken-promise replay uses a cooperative fictional writer.
A no-show has a different recovery path: validated EscrowCancel after CancelAfter.
The deadline itself does not return the funds. [Holdback evidence](../evidence/money/HOLDBACK.md) · [Refund contract](../key-reveal-escrow.md).

## 9. What do the live numbers cover?

Hosted demo since 11 Nov, team test runs included, as of <!--f:live_asof-->12 Nov 2026, 12:24 SGT<!--/f-->:
<!--f:live_questions-->62<!--/f--> questions, <!--f:live_purchases-->74<!--/f--> settled purchases;
median <!--f:live_median_s-->22.316<!--/f--> s, p90 <!--f:live_p90_s-->61.061<!--/f--> s across
<!--f:live_timing_n-->49<!--/f--> timed runs. Median model cost US$<!--f:live_model_usd-->0.0020035<!--/f-->
per question. <!--f:live_violations-->0<!--/f--> recorded violations across
<!--f:live_audits-->50<!--/f--> available audits; <!--f:live_audit_unavailable-->12<!--/f--> unavailable.
[Unchanged response and fetch metadata](evidence/hosted-stats-nov12/README.md).
These are observed demo aggregates, not customer usage. Timing samples and audit samples differ.

## 10. Is that total cost?

No: model USD cost is separate from article display prices, ledger fees and hosting.
The app’s S$ price uses a fixed demonstration conversion, not an FX quote. The live
demo pays in XRP. TEST-SGD is an unbacked stand-in for RLUSD in CLI token-escrow evidence.
No real value is transferred; mainnet signing remains disabled.

## 11. Which party pays fees?

The measured signed reference has 12 drops paid by the buyer to create and 423 drops
paid by the writer to finish; the answer anchor is additional. rippled's own minimum is 360
for the measured finish shape; the client adds headroom. Fees depend on load and key size.
Unsigned autofill probes measured different fees and charge nothing.

## 12. Does RLUSD escrow work?

Recorded unsigned probes returned `tecNO_PERMISSION` for RLUSD on both networks;
the matched TEST-SGD control returned `tesSUCCESS`. Nothing was signed or submitted.
Testnet and Mainnet both have TokenEscrow enabled; issuer permissions still matter.
A 12 Nov read of both official issuers’ account flags shows the locking bit switched off,
so exact RLUSD escrow waits for Ripple. A stand-in token completed one purchase through
the product’s own path in 16.6 s. [Spike evidence](../evidence/money/SPIKES.md).
Official development-network RLUSD payments were demonstrated separately on 3 Nov.
[Recorded ledger verdicts](../evidence/dry-run-nov12/result.json).

## 13. What does writer identity mean?

Three writers hold accepted operator-issued Testnet Credentials. A Testnet Permissioned
Domain lists the accepted issuer and type for identity display. This is operator
attestation, not KYC, quality certification or payment permission; fictional writers
remain unverified. Hosted display requires configuration. [Identity evidence](../evidence/writer-credentials-nov12/README.md).

<a id="19-does-it-actually-buy-the-right-things"></a>

## 14. How good are the answers?

<!--f:heldout_line-->v5 blind held-out: 16/20 bought and cited, 0/10 off-topic purchases (run once, 11 Nov, fixture research and decision models with answers written offline, team-authored writers)<!--/f-->.
The key fact leads <!--f:answers_it-->7/20<!--/f--> answers. This is one offline research
measurement, not live answer quality or a recurring benchmark. It ran at `a9584014`;
use the actual pinned commit in [the evidence](../evidence/v5-heldout/README.md).

## 15. Does the one-line command always finish quickly?

No. One empty-cache cold run took <!--f:try_s-->84.2<!--/f--> s on one Mac;
<!--f:try_misses-->2 of 4<!--/f--> cold attempts overran the 90 s target. The published
release’s 59.2 s clock excludes npm download. npm, faucet funding and public-node
history can delay the path. [Cold-run measurements](../evidence/round4-j2/README.md).

## 16. What if the live demo is unavailable?

Use the recorded replay and call it a replay. An offline verifier checks the signed
bundle; public-ledger lookups need a reachable node. The stage check uses the actual
final PDF/video; it does not ask a question. Never turn unavailable into passed.

## 17. What do five Held gates mean?

The featured 12 Nov preset-2 run is 421bae3d: 31.1 s Start→Done, excluding planning/modal;
one S$0.40 article, no refund. Browser/TS 24/0/2 and Python 25/0/2 preserve skips.
Grant 1953 precedes paid-read events 1954–1957. Its initial draft used fixture extracts
and keyword search. [Receipts and verifiers](../evidence/hosted-export-nov12/README.md).

## 18. What about the earlier paid-answer example?

The separate writer-payment run took 65.8 s and bought one S$0.40 article. Its initial
fixture draft had two recorded gaps; its final answer had none. Its own model cost is
unmeasured because usage was not retained. Do not attach the aggregate model median
to that run. It lacks paid-read telemetry, so gate 1 is Not checked there.
[Unchanged run evidence](evidence/hosted-answer-nov12/README.md).

## 19. How do retries avoid duplicate charges?

The intent and signed transaction are persisted. Recovery reuses them; replacement
requires ledger-proven failure or expiry. Separate synthetic-ledger chaos evidence
records <!--f:chaos_double-->0<!--/f--> double charges in <!--f:chaos_runs-->500<!--/f-->
runs with <!--f:chaos_kills-->130<!--/f--> real process kills. This is a measured test,
not a universal guarantee. [Chaos evidence](../evidence/chaos-279-500.json).

## 20. What is the hosted operating scope?

One shared pre-funded payer, per-visitor caps and a bounded public demo window.
Configured fallbacks carry per-run model labels. Hosted purchases use deterministic
policy rules. Live model decision experiments are separate from the hosted policy.
Retention and owner controls are described in the hosted runbook.

## 21. Where do I install it?

GitHub Releases has the published MCP package, TypeScript SDK and Python wheel.
They are not yet on npm, PyPI or the MCP Registry, and neither are the Express, Hono
and FastAPI seller packages. The Mac DMG is unsigned pending a Developer ID. The
browser link avoids installation. Agents can also connect by URL. <!-- HOSTED-PENDING -->

## 22. Is it ready for regulated deployment?

No. The opt-in regulated mode refuses payees without an accepted credential and
screens them against one dated OFAC XRP address list, with every refusal audited. It is optional and off on the hosted demo, and it is a control, not clearance. Custody needs KMS/HSM and rotation; screening needs a
sanctions provider and writer KYB; audit retention policy, maker-checker controls,
velocity limits, licensing and legal review remain. The hire flow holds funds in transit.
[Compliance map](../COMPLIANCE.md).

## 23. How do agents hire it?

The caller pays a budget plus a fixed service fee. ResearchAgent returns unspent
budget and allocates a quarter of the service fee to cited-writer royalties. This
was demonstrated once. [Hire evidence](../evidence/hire-274.md).

## 24. How much builder feedback is upstream?

<!--f:feedback_line-->7 ranked findings with runnable repros · 35 numbered findings (B01–B35) · 15 submissions on 4–5 Sep · 8 upstream drafts, 0 filed<!--/f-->.
Keep submitted historical feedback separate from the currently unfiled drafts.
Five more items, with transaction hashes and three patches, are verified and ready to
file; filing waits for the owner. [Bundle](../feedback/upstream/r3/README.md).
[Builder feedback](../BUILDER-FEEDBACK.md).

## 25. What is the simplest thing to verify?

Open the hosted demo, choose Verify and run the checks without asking a question.
Then open a payment’s “Check the key yourself”. Read the actual result and follow
both transaction links. [Try it](https://collaboration95.github.io/theFastandtheFungible/try/).

## 26. How strong is the 1,000-purchase result?

<!--f:proof_purchases-->1,000<!--/f--> of <!--f:proof_purchases-->1,000<!--/f--> attempts completed, and an independent script that re-reads every
transaction from a public node verified all <!--f:proof_purchases-->1,000<!--/f-->: median <!--f:proof_p50_s-->20.3<!--/f--> s end to end, p90 22.6 s.
They are scripted repeats of one team-authored note, bought by fresh accounts through
the product’s escrow service, with no model or hosted service involved. That proves the
payment path at volume, not demand. `npm run proof:testnet-verify` reproduces it.
[Run and verifier](../evidence/proof/TESTNET-1000.md).

## 27. What do the model checker and the simulations prove?

The checker explored <!--f:proof_states-->210,480<!--/f--> bounded protocol states with no violation and caught all <!--f:proof_mutations-->seven<!--/f-->
deliberately seeded bugs. <!--f:proof_schedules-->1,000,000<!--/f--> simulated crash and retry schedules ran against the
real purchase code on an in-memory ledger, also with no violation; <!--f:proof_attacks-->34<!--/f--> attacks on the local
stack found no breach. They do not prove the code matches the model, nor cover ledger
consensus or disk corruption, and the schedules are seeded repetitions of a finite fault
matrix. [Proof report](../evidence/proof/PROOF-REPORT.md).

## 28. Why policy rules and not a calibrated decision model?

We fitted one on 778 usable historical decisions and tested it on held-out questions.
The rules scored better on all three measures: Brier 0.0355 against 0.0369, calibration
error 0.044 against 0.059 and AUC 0.983 against 0.971. We removed the model; hosted
keeps policy rules. This is a retrospective test on reconstructed data, not a live result.
[Models evidence](../evidence/models/MODELS.md).

## 29. What search runs, and does it call an API?

Hybrid ranking with local BGE-small embeddings on the server’s CPU: no embedding API.
A query embeds in about 2.6 ms at the median on a Mac. The tuning bank is not
independent evidence of generalisation. <!-- HOSTED-PENDING -->

## 30. Can anyone publish, and has anyone?

Anyone can submit an original note of 150–3,000 words; moderation prechecks it and an
operator approves it before it goes live. A scripted note took <!--f:publish_live_s-->12.4<!--/f--> s to go live and <!--f:publish_sale_s-->34.5<!--/f--> s
to a verified sale, measured locally; typing time and hosted latency are unmeasured. No
outside writer has published yet. <!-- HOSTED-PENDING -->
[Publishing evidence](../evidence/publish/PUBLISH.md).

## 31. How do other agents and sellers reach it?

Agents connect over MCP at a URL, with generated one-click links for Cursor and VS Code
and steps for Claude; we did not install each native client. They can also buy answers
over x402 at `/v1/ask`, with hosted budgets of 100 or 200 cents. <!-- HOSTED-PENDING -->
A separate Python buyer completed a real purchase and an expiry cancellation against a
Hono seller installed from the seller package. A key-reveal scheme for x402 is drafted,
not filed. [Reach evidence](../evidence/reach/REACH.md).

## 32. What does the live page show?

Each validated escrow and key check, as it happens, and a scoreboard that separates
outside visitors from operator tests. <!-- HOSTED-PENDING -->
[Feed evidence](../evidence/feed/FEED.md).
