# LIVE-DEC resumed audit — 11 November 2026

**DON'T SWITCH.** Keep `DECISION_PROVIDER=fixture`. The completed capped comparison on `bd52beff`
(plus this lane's meter fix) has 13 failed OpenAI runs out of 19, versus 0/19 fixture failures.
Eight of nine OpenAI presets fail after buying. Off-topic questions buy nothing, but that alone is not a
successful answer or a successful decline. No VM, hosted demo admission, cloud resource or real money was used.

## Completed comparison

The first resume's complete run is retained in `resumed/`; the second resume inspected its 58 rows and ran
12 additional paired asks in `second-resume/`. These are separate samples, not pooled to hide a regression. Recorded plans match byte-for-byte in 16/19
first-resume started-run pairs and 5/6 second-resume pairs; the others went live, introducing planner variation.
Every required question is covered: XRPL1–3 three times each; A1 = XRPL1, x402 = XRPL2; A3, A5, D3,
D4, E5, token escrow = A4, travel rule = D1, and product B5/C1/C4 once each; NG01–NG10 once each.
The predecessor also retained two repetitions per judge/negative and a direct-to-planner negative stress test.

| Capped hosted path (`resumed/`) | fixture | live OpenAI Decisions |
| --- | --- | --- |
| Hosted asks / started runs | 29 / 19 | 29 / 19 |
| DONE / FAILED | 19 / 0 | 6 / **13** |
| Presets DONE / FAILED | 9 / 0 | 1 / **8** |
| Right article first (answerable asks) | 18/18 | 17/18 |
| Lead contains key-fact pattern (proxy only) | 17/18 | 16/18 |
| Lead answers all requested parts (manual review below) | 7/18 | 6/18 |
| Articles / simulated article spend | 22 / S$8.80 | 18 / S$7.20 |
| Preset articles / spend | 12 / S$4.80 | 9 / S$3.60 |
| E5 + ten negatives: no purchase | 11/11 | 11/11 |
| Ten negatives: scope redirects / purchases | 10 / 0 | 10 / 0 |
| Successful decision-call latency p50 / p95 | 1.00 / 3.01 ms (separate diagnostic) | 0.5 / 0.9 s |
| Estimated decision wait per started run p50 / p95 | in-process | 0.9 / 2.0 s |
| Scope + run, all asks p50 / p95 | 3.6 / 6.6 s | 4.4 / 5.9 s |
| Presets scope + run p50 / p95 | 3.9 / 7.0 s | 4.9 / 5.9 s |
| Hosted token-cap refusals / aborted sibling calls | 0 / 0 | 26 / 13 |
| Writer fallback to extracts | 4 | 5 |
| Settled OpenAI cost per started run (configured rates) | US$0 | US$0.0126 |
| Settled all-model cost per started run | US$0.0020 | US$0.0144 |
| Peak all-model reservation per question | US$0.0096 | US$0.0296 |

Lower spend and some shorter live timings reflect early failure; they are not an efficiency win. All-ask
latency includes ten fast scope redirects. See `resumed/comparison.md` and `resumed/summary.json` for individual
purchases, S$, errors, leads and subgroup timings. Decision-wait time uses a longest-call grouping heuristic,
not recorded interval unions; OpenAI call p50/p95 is directly timed. Fixture p50/p95 comes from a separate
19-ask live-planner diagnostic (`fixture-latency/`), timing 362 in-process method completions including concurrent
scheduling; it is not pooled into the paired purchase/lead comparison. No quiet fixture decision fallback occurs:
OpenAI failures end the run FAILED and retain the previous answer if there is one.

**Forced negative test:** predecessor `negatives-direct.raw-results.json` skips scope and runs all ten off-topic
questions twice per arm: fixture 20/20, capped OpenAI 20/20 and measurement-only uncapped OpenAI 20/20 buy
nothing. Capped OpenAI judged at least one paid candidate in 11 of those runs. This distinguishes scope
rejection from measured decision-model abstention. These are used regression questions, never held out.

## Lead completeness, separately from keyword matches

The inherited regular expressions only detect a named fact anywhere in the lead block. They cannot prove
that every clause was answered. The following manual review applies the same standard to both capped arms;
only XRPL1 (3 repetitions), D4 and the three product answers answer all requested parts in the fixture arm.
OpenAI misses D4. This is a review of the retained text, not independent verification of ledger or legal facts.

| Question | fixture lead | OpenAI lead | Missing part or evidence |
| --- | --- | --- | --- |
| XRPL1 / A1, 3× | answers | answers | Names official RLUSD blocking and AllowTrustLineLocking |
| XRPL2 / x402, 3× | partial | partial | Contains PAYMENT-REQUIRED, but not XRP-on-Testnet support; r1/r3 start with “Each option” |
| XRPL3, 3× | partial | partial | Says base plus owner reserves, without the requested amounts |
| A3 | partial | partial | Gives 423 drops for Finish, not the total network fees of a purchase |
| A4 / token escrow | partial | partial | TokenEscrow named; issuer flag absent from the lead |
| A5 | partial | partial | Explains release/cancel but omits who may submit |
| D1 / travel rule | partial | partial | Generic originator/beneficiary rule; Singapore-specific requested details absent |
| D3 | partial | partial | Conditional licensing caution; no direct answer about paying one's own suppliers |
| D4 | answers | missing | Fixture says cancel after CancelAfter; OpenAI buys payment-finality and has no lead |
| B5 | answers | answers | Decision model scores, policy buys within budget |
| C1 | answers | answers | Publishing the key releases escrow; reading requires writer payment |
| C4 | answers | answers | Full price to writer, no per-article fee |
| E5 | no evidence; declines | no purchase, FAILED | OpenAI's failure is not a successful explained decline |

The second resume rechecked x402, D4, E5 and B5/C1/C4 with fresh DeepSeek plans and captured receipt labels:
fixture 6 DONE; OpenAI 4 DONE / 2 FAILED (x402 and E5, token cap). Both buy five articles for S$2.00.
D4 now buys `product-escrow-no-show` in both arms, but both leads say “FinishAfter…earliest release time”,
with cancellation mentioned only in the second sentence and no CancelAfter recovery explanation. Do not claim the earlier D4 miss is deterministic. Live decisions still cannot
complete all the required hosted asks. The twelve rows are in `second-resume/raw-results.json`.

## Spending and hosted envelopes

`cost-audit.json` reconciles all retained OpenAI attempts plus the predecessor's 14 unretained probes.
The original US$0.34 number counts reported successful usage only, not the whole lane. Unknown/error/aborted
attempts retain the conservative maximum reservation; missing historical probes use the hosted maximum
50,000 input plus 8,192 output envelope. This is an engineering bound under the recorded configuration,
not an invoice or a verified organization-wide bill. No admin key was requested.

Historical bound: US$1.119442. First-resume conservative spend: US$0.240062. Second-resume dispatch cap:
US$0.35, leaving the combined lane below US$1.709504 even if exhausted. Exact observed second-resume charge
and total are in `cost-audit.json`. No further live calls are needed.

The resumed capped OpenAI meter settles about US$0.0126 per started question including conservative charges
for aborted attempts, and US$0.0144 including DeepSeek, against US$0.05/question. At the maximum 300 daily
questions that sampled mean would be about US$4.32/day; at 2,100 lifetime questions about US$30.24, below
US$15/day and US$105 total. These extrapolations are not guarantees. Scope-only questions have no retained
meter breakdown; do not treat that missing cost as zero. The uncapped historical mean (US$0.006 successful
OpenAI usage per question) excludes unknown-usage calls and cannot replace this comparison.

The configured US$0.25/M input and US$1/M output rates are conservative. The
[official OpenAI Decisions guide](https://developers.openai.com/api/docs/guides/decisions), checked 11 Nov,
says US$0.10/M uncached input and no output-token charge. We retain configured rates throughout rather than
retroactively discounting the bound. The binding observed constraint is the 50,000 decision-input allowance:
settled real token usage plus the next request's bytes estimate crosses it; money reservations remain below US$0.05.

## Labels and owning-lane follow-ups

Fresh runtime data captures the status chip, run labels and exported receipt label in every started run:

- Fixture chip: `live research · fixture purchase decisions · per-answer fallback labelled`.
- OpenAI chip: `live research and purchase decisions · per-answer fallback labelled`.
- OpenAI run decision label: `OpenAI Decisions · gpt-6-luna` (or pending when no decision succeeds).
- Receipt bundle `label`: simulated rail and DeepSeek are present; **decision provider is omitted**.
  `server/receipt-bundle.ts` needs to add `run.labels.decision` before any switch. No change here, per lane ownership.
- MCP labels are preserved by `sdk/present.ts:24` and `mcp/tools.ts`; this is code inspection, not a new live MCP
  session. Zero-clone fixture startup modes are separate from the proposed hosted change.
- QUAL/H7 should name the hosted allowance refusal truthfully instead of “transport failure”. QUAL owns the
  partial lead fixes. Re-measure after they and H7 size any allowances, preserving money caps and negative abstention.

## What ships and evidence bounds

Only the hosted transport compatibility fix ships: `/v1/decisions` receives no unsupported output-token
parameter. The conservative reservation, money limits, other endpoint output ceilings and token caps remain.
Four regression tests cover request shape, usage settlement, other endpoints and pre-dispatch refusal;
29 targeted tests across meter, hosted limits and OpenAI provider passed. Full gates are reported in the PR.

The historical `openai-uncapped` arm lifts **only** the input-token check in the measurement harness and keeps
the money check. That diagnostic exception must not be deployed. No product gate, threshold or test was loosened.

`raw-manifest.json` records exact row counts, byte counts and SHA-256 after whitespace-only compaction. The
combined raw JSON is below 2 MB; no measurements were discarded. `secret-scan.json` records redacted gitleaks
and an in-memory comparison against configured secret values, without retaining those values. No raw request
headers, authorization values or wallet seeds are intentionally recorded.
