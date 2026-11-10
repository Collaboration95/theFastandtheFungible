# Preflight the 1 KiB Memos limit before signing, and report the size in the error

> **Target:** `XRPLF/xrpl.js` (SDK preflight and error message). If maintainers prefer, the documentation half belongs in `XRPLF/xrpl-dev-portal`.
> **Status:** ready to paste, not filed (owner-only, #265 B1) · **Labels:** none.
> Copy the H1 as the issue title and everything below the rule as the body. This repro needs only `npm i xrpl`; no clone is required.

---

## Summary

A transaction whose `Memos` serialize to more than 1,024 bytes is rejected by the server with `invalidTransaction: fails local checks: The memo exceeds the maximum allowed size.` The limit applies to the serialized array (field headers and length prefixes included), not to `MemoData` alone, and xrpl.js `autofill`, `sign` and `submit` give no early warning. We hit this with a signed 997-byte `MemoData`; our workaround leaves 18 bytes of headroom.

## Environment

- XRPL Testnet (network ID 1), 7 Nov 2026; xrpl.js 4.7.0; ripple-binary-codec 2.11.0; Node 22.13+.
- The repro below is offline and uses synthetic values calibrated to the observed 997-byte `MemoData`.

## Steps to reproduce

```js
// npm i xrpl@4.7.0
import { encode } from 'xrpl'
const base = { TransactionType: 'AccountSet', Account: 'rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV', Fee: '12', Sequence: 1, SigningPubKey: '' }
const hex = s => Buffer.from(s).toString('hex').toUpperCase()
// Serialized Memos size as rippled counts it: encoded growth minus the array field header (1 byte) and array end marker (1 byte).
const memosSize = memos => (encode({ ...base, Memos: memos }).length - encode(base).length) / 2 - 2
const memo = n => [{ Memo: { MemoType: hex('researchagent/escrow-v1'), MemoData: hex('x'.repeat(n)) } }]
for (const n of [976, 997, 1000]) console.log(`MemoData ${n} bytes -> serialized Memos ${memosSize(memo(n))} bytes`)
// MemoData 976 -> 1006 (accepted), 997 -> 1027 (rejected by the server), 1000 -> 1030 (rejected)
```

Then submit the 997-byte case to Testnet (any funded account) to see the server error. In our repository the same numbers come from a realistic quote: `node scripts/repro/08-memo-size.mjs` after `npm ci`.

## Expected

Either the SDK rejects an over-limit `Memos` array before signing with a message that includes the serialized size and the 1,024-byte limit, or the docs state plainly that the limit counts serialized bytes including overhead.

## Actual

- Live rejection on Testnet: `invalidTransaction: fails local checks: The memo exceeds the maximum allowed size.` (7 Nov 2026). `MemoData` alone was 997 bytes; with the 23-byte `MemoType` and serialization overhead the array was 1,027 bytes.
- The message gives no size and no limit, and the `MemoData` length alone looks like it fits under 1,024.
- Our fix replaced a 64-character hex SHA-256 intent id with the same 256 bits as 43 base64url characters, saving 21 bytes. Nothing else changed, and the transaction now serializes to 1,006 bytes: the whole margin was 21 bytes, so any longer field value will hit the limit again.
- No principal moved and no grant was issued. Evidence: [m1-iou README](https://github.com/Collaboration95/theFastandtheFungible/blob/main/docs/evidence/m1-iou/README.md) and the 7 Nov entry in [BUILDER-FEEDBACK](https://github.com/Collaboration95/theFastandtheFungible/blob/main/docs/BUILDER-FEEDBACK.md). Observed on the live network; the 1,024-byte rule is our reading of rippled's memo check, not something we re-derived from its source.

## Workaround we use

Encode the full SHA-256 intent id in base64url for IOU runs (all 256 bits kept, every signed quote field kept) and measure the serialized size in our own tests.

## Proposed fix

1. In xrpl.js, add a `Memos` size check to `validate()` or `autofill` that reports the serialized size and the limit.
2. In the docs for the `Memos` field, say that the 1,024 bytes count the serialized array including field headers and length prefixes, and give a worked example.
3. Optional: expose a `serializedMemosSize(memos)` helper so wallets and agents can budget before signing.

## Scope and limits

The same limit applies on mainnet. No mainnet transaction was attempted.
