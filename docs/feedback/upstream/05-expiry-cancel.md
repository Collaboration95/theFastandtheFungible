# Escrow tutorials: show EscrowCancel after CancelAfter (expiry does not return funds by itself)

> **Target:** `XRPLF/xrpl-dev-portal` · **Status:** ready to paste, not filed (owner-only, #265 B1) · **Labels:** none.
> Copy the H1 as the issue title and everything below the rule as the body.
> If the escrow concept page already states that expired escrows stay until cancelled, narrow the request to carrying it into the tutorials and SDK examples.

---

## Summary

On Testnet an escrow that passed its `CancelAfter` time did **not** return the funds. They stayed locked until a separate `EscrowCancel` was validated. A builder who treats expiry as an automatic refund leaves liquidity and owner reserve locked. The happy-path tutorials we read do not show the cancel step.

## Environment

- XRPL Testnet, 2026-11-03; xrpl.js 4.7.0; XRP escrow with a crypto-condition; 30,000-drop principal, 120 s deadline; synthetic article.

## Steps to reproduce

```sh
gh repo clone Collaboration95/theFastandtheFungible researchagent-repro
cd researchagent-repro && git checkout d38fe39e && npm ci
node scripts/repro/05-expiry-cancel.mjs
```

The script replays the committed ledger evidence (offline). To re-observe: `EscrowCreate` with a condition and `CancelAfter` 120 s ahead, never finish it, wait past the deadline, then check the escrow object and the account balance.

## Expected

Either the docs and examples state clearly that expiry only makes cancellation **eligible**, or funds return at expiry.

## Actual

- The failed-proof escrow stayed locked through the 120 s deadline.
- An early `EscrowCancel` and an expired `EscrowFinish` both validated `tecNO_PERMISSION` (fee burned, principal not restored).
- An explicit `EscrowCancel` after the deadline returned 29,988 of 30,000 drops (12-drop fee).
- `OwnerCount` went 0→1→0, so the 0.2 XRP reserve was held until cancellation.
- Evidence: [escrow-273.md](https://github.com/Collaboration95/theFastandtheFungible/blob/d38fe39e/docs/evidence/escrow-273.md).

## Workaround we use

A durable `CANCEL_DUE` state, ledger-time ticks (compare validated ledger close time with `CancelAfter`), and held terminal-fee headroom for every open escrow.

## Proposed fix

Add an expiry-and-cleanup step to the escrow tutorials: compare against validated ledger time, submit `EscrowCancel`, show the fee-consuming negative cases, and explain that reserve and liquidity stay locked until then.

## Scope and limits

Observed on Testnet only; mainnet not tested. No incident claimed beyond locked funds until cancellation.
