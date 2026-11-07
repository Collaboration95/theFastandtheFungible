# Official RLUSD on native XRPL Testnet · 3 Nov 2026

**LIVE TESTNET · no real value.** Official Ripple-issued Testnet RLUSD;
SYNTHETIC articles, fixture research and decision providers, local HTTP on
OS-assigned ephemeral ports. No mainnet, real money, cloud resources or live
model calls. The test-USD stand-in from #315 is not used in these runs.

## Identity and funding routes, in execution order

Ripple's [own documentation](https://docs.ripple.com/products/stablecoin/developer-resources/rlusd-on-the-xrpl)
was checked on 3 Nov: native XRPL Testnet issuer
`rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV`, currency
`524C555344000000000000000000000000000000`, WebSocket
`wss://s.altnet.rippletest.net:51233`. Live account_info confirmed that account
and its ripple.com domain. Testnet tokens are not backed or redeemable dollars.

1. **t54 CLI:** npm installation of `@rlusd/cli@0.2.0` returned E404.
   Fallback: downloaded the exact source at
   `155ab72076c9cb455a6c6c2d46254768e941193b` using authenticated gh;
   `npm ci --ignore-scripts` from that source directory succeeded. An initial
   `npm ci --prefix <source>` failed with lock mismatch (`Missing: source@0.2.0`);
   changing cwd resolved it without changing the upstream lockfile.
   Executed `bin/rlusd.ts --network testnet --output json faucet fund --chain xrpl
   --address <fresh-address>` with tsx. A task-local homedir shim isolated the
   CLI configuration; HOME was not changed. First call funded fresh address
   `rGL82vWRnYSMeFm27ZTkPokK3G16U423ez` with **100 XRP, not RLUSD**.
   After TrustSet, second call returned `action: claim_rlusd` and
   `faucet_url: https://tryrlusd.com/`. It does not bypass faucet authentication.
2. **Official faucet:** after validated TrustSet
   `F2DF8AC71C7E3C0973369B57628D2610A5B84A2C175B700094FAE56E8027F266`,
   POST `https://tryrlusd.com/api/mint-xrpl` with JSON `{address: <fresh-address>}`
   returned **HTTP 401, `{"error":"Authentication required"}`** at
   2026-11-03 05:42:46 UTC. No signed-in session was used. Inspected the public
   site's client code to confirm the request shape. GET `/api/sponsored/status`
   returned 200 but listed only Sepolia/EVM networks, not native XRPL. This is
   discovery, not a failed native XRPL claim or evidence of EVM incompatibility.
3. **Documented XRPL DEX route:** the [native DEX](https://xrpl.org/docs/concepts/tokens/decentralized-exchange)
   supports XRP/token exchange with issuer-specific books. Validated book_offers
   showed funded offers for the official issuer. A self-directed cross-currency
   Payment acquired **2 RLUSD**, with **SendMax 26 Testnet XRP**, no partial
   payment flag, and a 2,000-drop fee cap. Metadata delivered_amount was exactly
   the official issuer/currency/value. This conversion is operator provisioning;
   product purchases still reject conversion fields and partial payments.

The orchestrator subsequently supplied payer
`rNtb7gEMUHyPUR6B39HQLkEhUtrYtY7NNf` via `RLUSD_TESTNET_ADDRESS` /
`RLUSD_TESTNET_SEED`. account_lines confirmed its existing trust line and zero
RLUSD before acquisition. Rechecked zero immediately before the bounded DEX
transaction: `EF0C86AFD1B8CAEED2AA67671B23A8169FB5170626C78E595BB7242E572816C2`.
It delivered 2 RLUSD; XRP balance reduction was 25.106767 XRP including 12 drops
fee. Only this supplied payer was used for the final runs below. Manual faucet
funding was not needed. All writers used fresh faucet-funded Testnet wallets.

[Funding metadata, CLI output and HTTP responses](rlusd-funding.json) include
writer TrustSet hashes. The supplied payer's TrustSet hash
`791C9F8C5039475AEC200644EB1D80C1A53541A89197ED96F0A9E75FABA8C805`
was supplied by the orchestrator; account_lines independently confirmed the line.

## Final product-path transactions

| Use case | Operation | RLUSD delivered | Validated transaction |
| --- | --- | --- | --- |
| UC2 | Policy buys NotFT; proof VERIFIED and cited answer | 0.90 | `1F2449A4660747066E99A89CEA5B49276D266F35820789042A8694EDB1DA23AF` |
| UC3 | Policy buys AlphaLeak; planted claim fails | 0.30 | `3232360079F218229444F11B9945D0E5F29284FDCD7808AE5FB8D3AE9290F6AA` |
| UC3 | Writer refunds supplied payer | 0.30 | `AE7D5941B85195321EAFA8707967DAC1C4A6C08168A3B4804CFEC8EA2DD6127D` |

All three were independently looked up: validated tesSUCCESS, exact
**delivered_amount**, correct issuer/currency, no tfPartialPayment. Refund
InvoiceID equals the original purchase hash. Each cost 12 drops; total product
fees 36 drops, net writer payment 0.90 RLUSD. Both SDK idempotency replays returned
identical purchases, both audit chains passed, both gate audits had zero violations.
UC3 failed content remained quarantined. No additional purchase approval was added.

[Run summaries](rlusd.json), [UC2 receipts](rlusd-uc2-receipts.json),
[UC3 receipts](rlusd-uc3-receipts.json) retain the public proof and audit bundles.

Historical reproduction only: run the retired generator in the complete `b0a67ffa` tree; see [pin, runtime and recovery](../historical-tools.md). All generator commands on this page use that tree.

```sh
OFFSET=1400 node --import tsx scripts/evidence/rlusd.mjs --testnet
npm run verify:answer -- docs/evidence/rlusd-uc2-receipts.json --testnet --json
npm run verify:answer -- docs/evidence/rlusd-uc3-receipts.json --testnet --json
```

Both verifier commands exited 0, `ok: true`; the optional external audit-anchor
check was SKIP. Repeated each command with `--expect-head` set to the audit head
in its corresponding receipt bundle; these pinned runs exited 0 with all checks
PASS. The anchor values are independently recorded in the run summaries. Outputs:
[UC2 verification](rlusd-uc2-verification.json), [UC3 verification](rlusd-uc3-verification.json).
The live harness requires the supplied payer environment variables and retained
private writer provisioning under `scratch/real-rlusd/writers.private.json`;
three funded writers and their lines are listed in funding evidence. Private
SQLite journals under `scratch/real-rlusd-owner` must be retained for replay.
Running in a fresh state spends Testnet value again. No seed or signed blob is
committed. The harness uses fixture providers and actual API/SDK policy,
publisher, proof, challenge and ledger verification paths; this is not a
live-model quality evaluation.

## RLUSD escrow limitation

Observed issuer Flags **2174353408** (`0x819A0000`) do not include
`lsfAllowTrustLineLocking` (`0x40000000`). [XLS-85](https://xls.xrpl.org/xls/XLS-0085-token-escrow.html)
and [AccountRoot flags](https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/accountroot)
require that issuer-controlled flag; otherwise token EscrowCreate returns
tecNO_PERMISSION. That failure is **code/document-derived**, not a submitted
RLUSD escrow transaction. TokenEscrow being enabled network-wide cannot override
issuer permission. No RLUSD escrow was created, and no proof-or-refund escrow
support is claimed. Existing product refusal of issued-currency escrow remains;
UC3 above uses a cooperative writer refund, not ledger-enforced cancellation.

## Exploratory spend before the supplied-payer update

The first fresh payer acquired 2 RLUSD via DEX:
`8E5815DA019B0056556CACD831B392B6F1EC63B58136BAEA95045E1F56577AD3`
(25.097994 Testnet XRP balance reduction including fee), then completed UC2
`071B8B7F4B4E74E5E4B94BB9504F0E3665E8946C6C864695A85ED646D3F1AB6F`
and UC3 payment/refund
`674B02C09424D92966EA266036817B03CCC3A5167BD71B6C2A3B8AAB86F7487E` /
`4EF7D628E178E5473D89F6B0DAED2E91438A76D7943D26658BBB4A87BE7D6E87`.
Those are exploratory evidence, separate from final supplied-payer acceptance.
Across both runs, net writer receipts were 1.80 RLUSD; DEX funding consumed
50.204761 Testnet XRP including fees, excluding faucet funding. Product fees
were 72 drops and locally provisioned trust-line fees 48 drops. The supplied
payer's earlier funding/TrustSet cost is outside this agent's expenditure record.
