# Featured receipts: one hosted run, 12 Nov

One real hosted preset-2 run on `5e550cf7e4de7c0c79268b303f63256e36d66179` (G1-TEL #508 included), captured through a fresh visitor browser with empty history and all five questions available. Exactly one question submitted; no second question. Run `421bae3d-564c-48f8-b5e8-5034b195860a` asks whether XRPL escrow can hold RLUSD and what the issuer must enable.

Admission/Start **12 Nov 2026, 09:07:38.656 SGT** → Done **09:08:09.738 SGT**: **31,082 ms (31.1 s)**. This excludes planning and the five-second confirmation modal. One article (`team-rlusd`, v4), four passages, **S$0.40** of a S$2.00 budget, no refund; these are Testnet funds with no real value. Model cost is unmeasured because per-call usage was not retained in the export.

Live DeepSeek planning and final writing; rule-based buying (`fixture · metadata-fixture`), team-authored notes, labelled initial extractive fixture draft and keyword search fallback. Admission-time pending and writer-identity-unverified labels remain verbatim; separate current catalogue identity observations do not rewrite historical receipts. No live decision-model or general answer-quality claim.

`receipts.json` and `public/judge/hosted-run-nov12.receipts.json` are byte-for-byte copies of the browser download, SHA-256 `8cedc67bdbdc51e2e13ad1bb68ed6a5b78e76d75afa7b47e37e7a97cec71f2ae`. The 11 Nov files remain unchanged for history. `shared/judge-run.json` selects this run for the judges' corner, stage-check and future recorded-run video captures.

| Browser gate | Result | Anchored audit evidence |
| --- | --- | --- |
| 1. No premium bytes before a grant | Held | Explicit grant **1953** precedes every paid read **1954–1957**; delivery/proof/finish 1949–1951 |
| 2. Only policy code spends, within budget | Held | Admission 1944; decision 1945; reserve 1946; settlement 1952 |
| 3. One charge per intent | Held | One reservation 1946 and settlement 1952 |
| 4. Real citations | Held | Existing signed-passage citation checks; proof 1950 and answer anchor 1958 |
| 5. Simulated or substituted work is labelled | Held | Verbatim admission/provider/rail labels; audit 1944, 1945, 1952 |

The browser summary is computed from the actual bundle and verifier checks, not manually supplied statuses. `tests/featured-run.test.ts` reads the selected file, runs the TS verifier, requires all five Held, requires paid reads and checks an earlier explicit grant for every read. It first failed against the old featured run (gate 1 Not checked), then passed against this export. Historical gate tests continue to require Not checked for exports lacking paid-read events.

| Verifier | Passed | Failed | Not checked / skipped | Testnet |
| --- | ---: | ---: | ---: | --- |
| Browser, public s.altnet node | 24 | 0 | 2 | 6/6 |
| Published v1.1.1 Python wheel | 25 | 0 | 2 | 6/6 |
| Published v1.1.1 TypeScript SDK | 24 | 0 | 2 | 6/6 |

The two skipped checks concern writer identity and historical origin; neither is counted as passed. Python and TS count checks differently. All verify the answer anchor at Testnet ledger **22255402**. Published wheel SHA-256 `c05f2ced74900dff4b40b75a259d1720148a2864c85c7ae71f1feae767e063c7`; SDK tarball `58efeb4ffca5463fb65d50aa05ec751868ea4eb4449dcdd741d1e0e1965140c9`. Downloaded with authenticated `gh release download v1.1.1`, wheel installed in an isolated venv with `--no-index --no-deps`.

Testnet transactions (no real value):

- [EscrowCreate: payment locked](https://testnet.xrpl.org/transactions/F4A608E20BE054B77F4FF2D4B1ED3EBC3EF54FC7D0A144CE56975163C6E7D795)
- [EscrowFinish: key published and writer paid](https://testnet.xrpl.org/transactions/01A6A7E07652216B102DFD1FED13462539D43475DFFBBA5A3C6E0FB12F643F1D)
- [Answer anchor](https://testnet.xrpl.org/transactions/E71B20085CBF1DE65153462931D5BAD7F40D23AA54A372D70DF547AFD2722ECA)

Operational deploy acceptance and browser captures are retained outside git in the DEPLOY-4 lane evidence. No site publication, policy change, verifier change or gate weakening.
