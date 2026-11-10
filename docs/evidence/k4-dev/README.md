# K4 development verification

Status: implementation in progress; measurements pending C3 (#425) merge.

Only v1, v3, v3-dev and v3-negatives are permitted. v4/v5 questions are never
opened or evaluated. `RA_DEV_BANKS_ONLY=1` excludes the v5 schema-reader test
from unit collection; the local-gate receipt and cache identity disclose this.
Default gate behavior, scorer, gold phrases and all hard-gate tests stay intact.

Measurement uses the real local publisher, engine, signed proofs and offline
receipt verifier with fixture models and **SIMULATED payments** on an ephemeral
port. It is development evidence, not a new held-out score, Testnet run or live
model qualification. All judge-bank and gate commands take the shared heavy lock.
No corpus edits, real money or cloud resources are in this lane.

The final comparison will retain input source SHAs, bank hashes, raw runs,
receipts, decisions and verification output, plus UC1–UC3 decision comparisons
and the three public preset lead goldens.
