# Two-arm measurement protocol

Use 140 requested-fact questions from the existing v2 bank, plus the 20-question
v3, v4 and v5 XRPL judge banks. All 200 run in each arm. Report both strata;
question-heldout calibration is not an independently authored new bank.

Both arms use the live DeepSeek planner and writer, fixture policy rules,
and local CPU embeddings. Free-only authorizes S$0; paid authorizes the normal
S$2 question budget with the normal per-source cap. Settlement is simulated,
explicitly labelled; this measures model/retrieval behavior, not ledger latency.
The two arms have independent API stores and history. Two asks per arm may run
concurrently. Same corpus, question order and scoring protocol in both arms.

Requested-fact questions use the bank's existing needle scorer, checked against
cited claims. Answered means at least one requested fact; correct means all.
XRPL judge questions use the existing first-two-sentence gold-phrase logic,
with delivered free or granted citations for a fair free/paid comparison.
The original verified-purchase scorer is retained and reported separately.
Citations must resolve to delivered spans, and gate audit also checks grants,
policy authority, gross spend, duplicate settlement, labels and SSE observations.

Preserve all misses, failures and fallback answers. Report overall quality and
a separate rate with no writer fallback. Four hundred completed runs do not
imply four hundred model-written answers; the fallback count is explicit.

DeepSeek spend uses provider-reported token counts and cache-hit usage, with
the dated official peak/off-peak rates. Each request first reserves a conservative
input-byte/output-token bound at peak rates. Missing usage retains the bound.
The shared local ledger spans pilots and reruns; it never resets with output.
Refuse a new attempt before total actual plus reserved spend could exceed US$5.
Call counts, tokens, actual cost, missing usage and remaining conservative holds
are retained with results. No API keys, wallet seeds, requests or model output
are exported in the measurement summary. Source stores stay in ignored scratch.

Rates checked on 12 November 2026 against the official
[DeepSeek pricing page](https://api-docs.deepseek.com/quick_start/pricing/):
Flash off-peak input miss/hit/output per million tokens = US$0.15/0.003/0.60;
peak = US$0.30/0.006/1.20. Weekday peak windows are 01:00–04:00 and
06:00–10:00 UTC, excluding Chinese public holidays. The measured run was in a
normal weekday peak window. The script conservatively treats all weekdays as
potential peak days; holiday peak-window reruns could overestimate actual cost.
Every request must explicitly cap output at 1–3,000 tokens or it is refused.

The first batch was manually interrupted after two failed premium-leak audits;
its 43 completed runs are retained in `r3-partial.json`. It is not a 200-question
result. The current runner stops admitting questions after the first gate
failure and finishes already admitted work, writes the partial summary, and
exits unsuccessfully. The generic BoJ phrase collision is repaired in three synthetic paid fixtures with article-specific canaries; the audit logic and thresholds are unchanged.

The runner now resumes `R3_OUT`: atomic results and cost writes retain completed question/arm pairs; interrupted admissions are recovered by durable per-arm/question-ID admission keys from the durable store, whose engine resumes unfinished runs. Raw SSE observations are retained in ignored per-question JSONL. Repeated question wording gets separate admission keys; reused run IDs are rejected. Admissions interrupted before their live PLAN are planned before engine recovery. A bank, corpus hash, provider or profile mismatch refuses resume. Gate failures remain terminal; use a new output directory only after diagnosing and repairing their cause.
