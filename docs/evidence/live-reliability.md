# Full-live reliability experiment · 3 Nov 2026

This measures production HTTP research with DeepSeek, OpenAI Decisions and
Cloudflare query embeddings against the **synthetic v2 writer corpus**, with
**XRPL TESTNET · no real value** payments and refunds. It is not public-web
research, mainnet evidence, a quality benchmark, or a provider invoice.

## Protocol

Run `make doctor OFFSET=800` first, then
`node --import tsx scripts/evidence/live-reliability.mjs before` and `after`.
The runner loads the ignored `.env` without printing credentials, uses API 9588
and publisher 9590, and refuses to overwrite either private journal directory.
Keep `scratch/live-reliability/{before,after}` until payment reconciliation is
complete. Do not delete journals to retry a payment.

Thirty sequential runs per phase: UC1–UC3, then the first ten IDs in the existing
held-out split (Q49–Q58), twice, then UC1–UC3/Q49 once more. The question/order
SHA-256 must match. Both phases start with fresh buyer/publisher journals and
reset local reputation before each run; both retain the production embedding
cache across questions. There is no harness-level retry of a failed run.
Provider clients retain their bounded production retries.

Timing starts at POST /runs, includes planning and retrieval, and observes the
first validated cited FREE_DRAFT or checked answer through 100 ms HTTP polling.
It excludes scope/clarification, the human five-second plan confirmation, DOM
rendering and presentation dwell. UC2 uses the direct API default angle rather
than a supplied clarification; the strict story-bible purchase contract still
counts a different article as a failure. Held-out runs check operational
completion and substitutions, not the correctness of every requested fact.
Reused held-out questions are reliability probes, not an unseen quality claim.

A DONE run with any fixture planner, answer, failed decision, keyword search or
non-Testnet settlement label fails live success. Provider HTTP status and name
are exported; response bodies, premium text, seeds, bearer tokens and signed
payment blobs are never evidence output. Failure classes distinguish use-case
contract failures from substitutions, admission/transport errors and timeouts.
All completed runs contribute to the primary latency percentiles, including
failed/substituted runs, to avoid survivor bias. Settlement is submittingAt to
settledAt per intent; zero purchases means no settlement sample, not zero ms.
N=30 supports only a small local p95 sample, not an at-scale service guarantee.

## Engineering changes

- The unchanged planner spending-language guard rejects economic questions when
  the model echoes words such as “pay” or “prices.” The planning instruction now
  requests neutral “cost”/“pricing” wording with the entity, measure and date
  preserved. No validator, purchase policy, prompt budget or gate was weakened.
- LLM HTTP recovery respects a short Retry-After instead of imposing 60 seconds,
  adds bounded jitter, and skips permanent 400/401/402/403 errors. Cooldowns above
  60 seconds still fail with the existing labelled fallback. This is tested
  recovery behavior; live benefit requires an observed rate-limit incident.
- Failed query embeddings are coalesced for one second before retry, with a
  bounded 512-entry cache. This prevents repeated calls during an outage while
  keeping keyword substitution labelled. Successful-query TTL is unchanged.

The existing Groq test previously asserted the erroneous 60-second floor; it
now asserts the provider minimum plus bounded jitter. This changes a latency
expectation, not a hard gate, leak threshold or purchase-authorization test.

## Cost and stopping

Every model request reserves a conservative scenario charge before dispatch,
including retries; quota exhaustion prevents further provider dispatch. The
combined phase cap is US$2.80, retaining room for doctor's small probe. A
completed run can settle its reservation using reported usage only when its
reported call count matches every intercepted non-embedding request; otherwise
its full reservation remains charged. Input bytes are charged as tokens for
unreported calls; DeepSeek maximum output is reserved in advance. Cloudflare
embeddings reserve US$0.0002/call. The scenario uses historical repository rates
(US$0.30/M input, US$1.20/M output, conservatively applied to all reported models).
These are scenario estimates, not verified current prices or invoices. Missing
billing cost remains null; the runner stops at a cap or exhausted quota.

## Results

Pending completion of the paired experiment. Raw allowlisted observations:
`live-reliability-before.json` and `live-reliability-after.json`.
