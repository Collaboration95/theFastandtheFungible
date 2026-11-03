# Lane R · key-reveal escrow · 4 Nov 2026

XRPL delivered the article key: a writer-signed validated EscrowFinish revealed K,
and the buyer decrypted, verified the signed passage manifest and produced a
cited fixture answer. A second writer intentionally did not show up; the buyer
cancelled after the ledger deadline and recovered the full 60,000-drop principal.

These are **live XRP Testnet transactions, no real value**. Articles and the
extractive answer are **synthetic fixtures**, not live-model research or a truth
assessment. The evidence is a dated snapshot; public Testnet history can reset.

| Path | Transaction | Hash | Ledger | Fee (drops) |
|---|---|---|---:|---:|
| Happy | EscrowCreate | `1360659C4F89DACA6A1C283FE3E516C95B585636DE37A25970E2D557F2090A6F` | 22047781 | 12 |
| Happy | EscrowFinish | `E6E5935D980117C6C5783F462B63050BF4EBAE0943AAC63C938B6084816F1DBF` | 22047783 | 423 |
| No-show | EscrowCreate | `D8D8753152D3C6ADD3F0BC3A6E0E37D46E6B374884F0CDBF1009B2FD123038EB` | 22047786 | 12 |
| No-show | EscrowCancel | `8D9DF4E548A67DDA6A5A7158D8EE26EB7612FD0CF39D21BF6FB2E063082F6F09` | 22047820 | 12 |

[Allowlisted transaction facts](transactions.json), [happy receipt](happy-receipt.json),
[no-show receipt](no-show-receipt.json), [SIGKILL results](crash.json).
Both TS and Python offline verifiers pass both live exports. Happy receipt's
public K is intentionally included after validated release; no wallet secret or
unrevealed no-show key is exported.

The live deadline was 120 seconds from validated ledger time. Encoded fulfillment
is 36 bytes; signing fee is `ceil(12 × (33 + 36/16)) = 423` drops. Happy buyer paid
60,000 principal plus 12 create fee; writer paid 423 finish fee. No-show returned
60,000 principal, with 24 drops of buyer fees burned. This is a principal refund,
not a fee refund.

Reproduction (live command uses funded Testnet wallet env vars; never mainnet):

```sh
npx tsx scripts/key-reveal-proof.ts
npx vitest run tests/key-reveal.test.ts tests/receipt-conformance.test.ts
python3 -m pytest packages/sdk-python
npx tsx scripts/chaos/key-reveal.ts
npm run chaos -- --runs 200 --seed 279
npm run check:fast
```

The live proof uses an ephemeral loopback publisher port. Wallet seeds stay in
ignored local state/environment. The live `.env` link was removed after recording.
No Lane P2 demo/Testnet runner or Lane H2b release/soak file is changed.

Crash runner sends actual SIGKILL after create submission, after durable validated
reveal observation, and after decrypted grant persistence. Ledger transport is a
labelled durable simulation; wallet keys are freshly generated test fixtures.
All three restarts recover one create, one receipt, one verified source and zero
double charges. Additional tests cover duplicate intent/restart, absent writer
cancellation, ciphertext exclusion from snapshot/model content/payment HTML/audit/
ordinary exports, invalid signed delivery and explicit fraud-evidence export.

Receipt conformance adds seven vectors; the old 177 remain unchanged. Python's
AES-256-GCM implementation also passes two independent NIST known-answer vectors,
including authentication rejection. See [protocol, threat model and gate-1
interpretation](../../key-reveal-escrow.md).

The original 200-run matrix (seed 279) completed with 55 actual process kills,
259 payments, 34 refunds, zero invariant violations, zero double charges and zero
stuck reservations. [Full result](chaos-200.json) identifies the base commit and
dirty implementation tree tested; it is local fixture evidence, not Testnet load.
