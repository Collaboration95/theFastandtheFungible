# Verify any answer + automatic recovery (#278 / #314)

Observed 3 Nov 2026 on XRPL Testnet; no real value. Fictional writers and
SYNTHETIC articles, fixture research/decisions, real Testnet settlement and
refund. The HTTP delivery fault was injected locally after the second payment
validated. No live model calls or new dependencies.

```sh
npm run verify:answer -- docs/evidence/verify-278/report.pdf --testnet
npm run verify:answer -- docs/evidence/verify-278/report.json
npm run verify:answer -- docs/evidence/verify-278/tampered.json
```

The first two exit 0; the tampered copy exits 1. JSON/receipts/PDF all carry the
same delivered evidence. No .env, signer, running backend, publisher or database
is needed by the verifier. Omit `--testnet` for offline hash/signature checks;
that output explicitly says payments/refunds were NOT checked on ledger.

## Product-path result

`verify-278/before.json`: UC3 had one free answer, two charged receipts,
AlphaLeak REFUNDED and The Fab Floor DELIVERY_FAILED; phase FAILED.
Reconciliation reused the original blob, verified delivery, handed off to the
exclusive answer path, saved answer v2 and moved to DONE. It never called the
purchase/decision loop again. Two recovery audit rows record FAILED → READ_PAID
and ANSWER → DONE in the same transactions as those state changes.

The three validated transactions are in `verify-278/summary.json`:

| Operation | Testnet hash | Delivered |
| --- | --- | --- |
| AlphaLeak charge | AD89391DD0F26CC910D60FE530B025CC7D547FE3AFDD5AD6FACD7FBCBD0D54F0 | 30,000 drops |
| AlphaLeak refund | B3765171BB6B28007F5A250D60EADB04263C6CB2154D780D7DA624ABFD238FC8 | 30,000 drops |
| The Fab Floor charge | 3081E9C26915BDEA7A4FB9154B27C6E1C9F597121BAEE5F6967D8C63CD256365 | 40,000 drops |

Gross principal 0.07 Testnet XRP, refund 0.03, net 0.04; three 12-drop
transaction fees (36 drops total). Two receipts, zero gate-audit violations.
The evidence runner's first audit caught its own default SIMULATED run label;
the runner corrected the metadata and reused the same run, not another payment.

`verify-278/testnet.txt` records 47 checks: nine signed source manifests,
all delivered passage sets, 16 citations across both answer versions, the paid
grant, receipts/refund/audit bindings, and three validated ledger transactions.
The PDF attachment also includes report findings and first/final citation sets,
so verifying that artifact checks more citations than the answer-only bundle.

## Tamper

`tampered.json` differs from `receipts.json` by one appended ASCII `X` in
`fab-floor-kestrel-penang-lead-times@v1#p1`. It fails both the source passage
check and that exact citation; see `tampered.txt`. Changing the amount, citation
id, signature, grant, refund or audit row is also covered by regression tests.
Read-only fake-ledger tests reject pending transactions, wrong amount, writer,
InvoiceID and partial-payment refunds. They are not extra live transactions.

## Scope of proof

The signature proves control of the included writer key and derives its wallet;
it does not certify a real-world writer or factual truth. Hashes bind exact
passages, not the model's reasoning or every uncited byte in an article. Missing
legacy/free proofs fail explicitly. Current free responses include signed proofs
when a configured writer key exists; Open Records uses its already-associated
Grid Operators signer. Deterministic fixture keys remain SIMULATED.

The exported audit segment starts just before this run's first event and runs
to the export head. Other runs appear only as opaque hash commitments. Disclosed
entries and chain links are checked; hidden entries' contents are not disclosed
or re-verified. An operator's full `audit:verify` still checks global money-table
coverage. Pin a head obtained independently with `--expect-head HASH` to detect
a changed tip; a self-contained hash chain alone is not an external authenticity
anchor. This run's head is in `summary.json`; it is not an independent anchor.

PDFs carry a versioned comment attachment after EOF and a digest of the original
PDF bytes. Editing those bytes without updating the attachment fails. This is
an integrity envelope, not a PDF digital signature or an independent semantic
comparison between rendered prose and cited findings. Old PDFs need re-export.

## Reproduce

`OFFSET=2200 node --import tsx scripts/evidence/verify-278.mjs` loads the ignored
.env and uses the existing funded Testnet buyer/writer seeds. It persists the run
id before execution under ignored `scratch/verify-278/`; reruns reuse the same
intents and make read-only checks/export after completion. Keep those private
journals for recovery; never commit them. Only public synthetic evidence goes
in this directory. Listeners use 10988/10990; tests use ephemeral ports.
