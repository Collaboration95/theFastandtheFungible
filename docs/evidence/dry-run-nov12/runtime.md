# Before-sign ledger dry runs · X1b

Live XRPL Testnet only, no real value. Local try uses fixture research and decision models and labelled fictional/team-authored writers. No hosted questions, cloud changes or release.

The signing guard adds a read-only `simulate` after Sequence, Fee and LastLedgerSequence are set. `tes*` permits the existing policy signature; `tec*`, `tem*` and `tef*` refuse before signing or persistence; `ter*`, unavailable RPC and a two-second timeout retain the buyer's existing policy path with an unavailable event. The writer requires exactly `tesSUCCESS`, validated ledger time plus 30 seconds strictly before CancelAfter, and current ledger plus five as LastLedgerSequence.

After the Testnet network check, independent balance, sequence and fee reads run concurrently; balance and owner-reserve checks share the same fresh validated server snapshot. Every check must still pass before signing. This offsets the extra dry-run round trip without changing the fee floor, fee cap, reserve requirements or spending authority. Dry runs cannot initiate a purchase.

Create and anchor verdicts are observed at the buyer's signer. A finish report comes from the writer's durable finish record and is labelled writer-reported in Show work. Old writers/exports do not gain inferred reports. Ledger success remains independently validated; simulation does not guarantee later submission success.

Baseline at X1a: `try --testnet` RESULT PASS, 51.0 seconds. Two purchases: create+finish signing paths 2140.332 and 2770.572 ms, median 2455.452 ms. Nine unsigned dummy-finish public simulate RTTs: 204.147–213.444 ms (median 206.550). End-to-end wall time includes ledger finality and is reported separately from the added signing-path time.

The timed run uses the real `runTry(['--testnet'])` entry point. A scratch observer records transaction type and elapsed time to the persisted signature; it records no wallet material or transaction blobs. A source-run adapter uses the TypeScript verifier entry instead of its built JavaScript filename and retains the receipt export before the try's temporary directory is removed. Compatibility checks use the downloaded, published v1.1.1 JavaScript CLI and Python wheel.

Testing support: the existing deterministic key-reveal ledger now answers `simulate`; the existing retry test pins the additional writer report exactly. No gate, threshold, budget or expected money result is relaxed. `scripts/gate-audit.ts` remains byte-for-byte unchanged.

Development history (retained, not acceptance): the first prototype passed the live functional try but had median purchase signing time 2984.956 ms, +529.504 ms over baseline, so it missed the 300 ms budget. The revised read scheduling produced 2216.002 ms, -239.450 ms, and RESULT PASS in 56.0 s. These are separate diagnostic runs; the final branch run below owns acceptance.

Security boundary: unsigned finish simulation sends the fulfillment to the selected public RPC operator before signing. A refusal prevents our signature and submission; it does not hide the key from that RPC operator. Ledger state may change after a successful simulation, so later settlement can still fail.

Final branch: two purchase signing paths 1992.995, 2467.952 ms (median 2230.474); baseline median 2455.452; median added -224.978 ms, budget 300 ms. Sample size: two purchases in one UC3 try. The signing path is elapsed time from the existing escrow call to its persisted signature; it includes the guard and existing wallet-queue work. Ledger finality and full-run wall time are separate.

Five dry-run events (two creates, two writer-reported finishes and one anchor), all tesSUCCESS. gate-audit: 0 violations. [Raw timing, code hashes, events and audit](runtime.json), [receipt export](runtime-receipts.json), [try output](runtime-try.txt). Published v1.1.1 verifier outputs: [JavaScript](runtime-v111-js.txt), [Python](runtime-v111-python.txt).

Secret scan: four generic-key matches are public evidence: two ledger-revealed article keys in the receipt, and the same public Mainnet RegularKey address twice in raw RPC metadata. No wallet seed or API credential is included; no scanner rule was changed.

[Read-only transaction checks](runtime-ledger.json) confirm both buyer create fees were 12 drops, both writer finish fees were 423, and each finish LastLedgerSequence was five above its dry-run ledger index in this run. Both finishes validated while more than 30 seconds remained before CancelAfter.
