Research. Follows [the 8 Oct decisions benchmark](https://github.com/Collaboration95/theFastandtheFungible/tree/bench/decisions-vs-clef/bench/decisions).

**Why:** the 8 Oct benchmark settles the *direction*: held-out ΔF1 for OpenAI Decisions minus Clef-flash was 0.200 [0.095, 0.327], with family McNemar p = 0.0039. The owner switched to Luna on that basis (M1). The benchmark still cannot certify the choice on our real corpus:
- The data is synthetic and templated, and the generator comes from the same vendor as one of the arms.
- The oracle is our own policy applied to labels that are correct by construction.
- 119 preview/body overlaps make the task easier than the real corpus.
- The 30 gold items are unreviewed.
- Full Clef 27B never ran on held-out data (quota).
- Latency was measured with 1–2 requests in flight, while production sends 9 concurrently.

**Do:**
- **Real labels:** use the real v2 corpus (from Q1), and human-review the 30 items in `bench/decisions/data/gold-for-human.jsonl`.
- **Validate the chosen model (Luna, M1) on the real corpus,** at production topology.
- **Clef 27B on held-out data**, about 1,300 calls, as the alternate. Its calibrated dev F1 was 0.949 with the production wording and 0.978 with the evidence wording.
- **Latency at production topology:**
  - 9 concurrent calls and real 3–5 s aborts, through the live server path;
  - report the fallback rate per UC over at least 10 runs.
- **Map the raw-threshold band where UC3 still works** (round 1 buys AlphaLeak, round 2 buys The Fab Floor), using live values. Post hoc, raw 0.10 lifted held-out F1 from 0.506 to 0.687, but UC3 sits in a narrow band.
- **Preregister** a non-inferiority margin before any switch decision.

**Constraints:**
- Never use the demo token: use a separate account, or Workers Paid with a budget alert.
- Serialize API-running processes.
- Label everything SYNTHETIC or REAL.

**Output:** an update to the paper and `summary.json` on `bench/decisions-vs-clef`, or a successor branch.
