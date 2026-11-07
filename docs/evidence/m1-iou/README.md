# M1 zero-clone IOU evidence — 2026-11-07

TEST-SGD · IOU issued by our Testnet issuer · no real value · stand-in for RLUSD.
Public Testnet faucet funds only. Fixture models and fictional articles/writers.
This is not official RLUSD, a peg/backing claim or mainnet evidence.

The MCP tool path uses the zero-clone engine bootstrap with ESCROW_ASSET=test-iou,
key reveal and anchoring. Run: `RA_ACCEPT_TESTNET=1 MCP_MAX_BUDGET_MINOR=200
MCP_DAILY_CAP_MINOR=200 node --import tsx scripts/m1-iou-probe.ts`.
The probe asserts wallet cache mode 0600, cached bootstrap, labelled amounts,
cap clamps, idempotent retries, actual purchase and anchor; it writes only public
receipt evidence. Operator caps remain authoritative and default to zero.

Initial cold issuer/wallet setup: 92.19 s. This successful probe reused that
cache: bootstrap 8.36 s, immediate cached setup 7.23 s. The 60.74 s
`purchaseSeconds` field includes the first purchase/anchor, same-intent retry,
and a second cap-check purchase (0.90 + 0.90 TEST-SGD, within a 2.00 cap).
It is not a single-purchase latency benchmark.

## Transactions

- create: [E36AF9F1F91820FE1F23ED1F0C68638422F0A1AF2A3BE55111B1C63418878C5C](https://testnet.xrpl.org/transactions/E36AF9F1F91820FE1F23ED1F0C68638422F0A1AF2A3BE55111B1C63418878C5C)
- finish: [384CA34FAC2F8562A2148FA843B6E10481BBE75BAA9BD777247E00D0181C02F5](https://testnet.xrpl.org/transactions/384CA34FAC2F8562A2148FA843B6E10481BBE75BAA9BD777247E00D0181C02F5)
- answer anchor: [8174E3BE19B5BA668EFFA42124F6C4CF37C0B2F5D3918229881C04218ADC35A3](https://testnet.xrpl.org/transactions/8174E3BE19B5BA668EFFA42124F6C4CF37C0B2F5D3918229881C04218ADC35A3)

## Verification

`npm run verify:answer -- docs/evidence/m1-iou/receipts.json --ledger`

`researchagent verify docs/evidence/m1-iou/receipts.json --ledger`

See typescript-verifier.txt and python-verifier.txt. Both verify currency SGT,
issuer and recipient RippleState delta for EscrowFinish (which has no
delivered_amount). Payment verification uses validated delivered_amount,
never the requested Amount as delivery proof. The unchanged shared IOU
conformance vectors reject amount, currency, issuer and trust-line mutations.

Default CI uses a labelled simulated ledger for the MCP cap/retry/no-show
conformance cases. No-show cancellation proves one EscrowCancel, no paid grant,
and zero principal spent. The live receipt here is a happy path; it does not
claim a new live cancellation run.

Observed pre-fix rejection: full signed IOU quote memos exceeded XRPL's
serialized 1 KiB Memo limit with the long app intent ID. IOU identities now
encode the full SHA-256 in base64url (all 256 bits), preserving every quote
field and asset label. See the dated BUILDER-FEEDBACK entry. Nothing loosened.

The commands are supported by this source/next packed build; this change does
not replace already published rc.2 release assets.
