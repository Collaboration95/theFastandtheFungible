# LEDGER: P3 + X3

Both specs are browser-only public ledger reads. No paid answer, signed receipt, policy, citation or verifier semantics changed. No server route, wallet or signing capability was added. The only App mount is immediately beside VerifyInBrowser (plus its import).

## Real read

`node --import tsx docs/evidence/ledger-check/real-read.mts`

Output: `real-read.json`, using **s.altnet** only, read 11 Nov 2026 at 23:57 SGT (no spending). Validated ledger **22245730**: RLUSD issuer locking OFF, account reserve **1.00 XRP**, owner reserve **0.20 XRP**, base fee **10 drops**; minimum **350** for our 36-byte fulfillment versus actual buyer **12** and writer **423**. Shared payer `rbcLo4…`: **0 open escrows / owner count 0**, objects pinned to the same ledger hash as account_info.

Recorded unedited RPC responses: `tests/fixtures/ledger-check/rpc.json` (captured at 23:52 SGT, current ledger 22245632), including historical FeeSettings at each create ledger. Tests use these responses only; no network.

| Pair | Amount | Create → finish | Fee buyer / writer | Owner reserve held |
|---|---|---|---|---|
| B6FDBD22 / 4CCB4E56 | 40,000 drops | 22228565 → 22228567 | 12 / 423 drops | 0.20 XRP, 2 seconds |
| E36AF9F1 / 384CA34F | TEST-SGD 0.90, stand-in for RLUSD, no real value | 22128287 → 22128289 | 12 / 423 drops | 0.20 XRP, 2 seconds |

The spec’s 7 seconds was illustrative: **both actual pairs took 2 seconds**, using ledger close times. Reserve release requires a matching created/deleted Escrow and buyer OwnerCount +1/−1. The reserve amount comes from validated historical FeeSettings at the create ledger, not today’s settings. A third-party finish is withheld rather than falsely attributing its fee to the writer.

## UI verification

`1280.png` and `390.png` show the actual LedgerCheck, KeyRevealLifecycle/LedgerReceipt and HostedJudgesCorner components in a **local component harness with recorded RPC fixtures**, labelled at the top. These are local UI checks, not a hosted deployment. No hosted question or admission was used. SGT read times in screenshots are the local harness response times.

`app-1280.png` and `app-390.png` additionally check the full App and its phone Spend sheet with the unchanged recorded UC3 replay supplied by a local read-only fetch fixture. Its two public Testnet purchases were read using the native browser socket client: the reserve was held 10 and 9 seconds respectively. The P3 card correctly stays hidden for this unrelated Kestrel question. Both widths have no overflow and settled axe serious/critical = 0 (including the open phone Spend sheet). One immediate desktop scan during existing resize motion reported a transient color-contrast violation; the settled recheck is 0.

At 390 px, document scrollWidth = 390. Axe serious/critical violations = **0**. At 1280 px the same check is recorded in `ui-acceptance.json`. No motion is added. Failure, Retry, late-response isolation and desktop hiding are covered in `ledger-ui.test.tsx`. P3 is hidden for 20 research-bank questions; unrelated RLUSD and general finance questions are also excluded.

All connections use exactly the verifier’s two public Testnet endpoints. Desktop policies are untouched and P3 is hidden there. The hosted app has no restrictive connect-src policy in its static HTML/server/host configuration; these are the same sockets already used by VerifyInBrowser. No Mainnet endpoints were added. The static Pages replay retains its tx-only policy: X3 is shown in the hosted/local app, while P3 and X3 are hidden in the static replay. The ledger UI is loaded in a separate chunk to preserve the existing initial-JS budget. L12 has not merged at this base; amounts use two decimals and dates use the specified SGT format. Existing transaction links do not add hash labels.

## Verification

39 new targeted tests pass. Full check:fast, local gate, published PR-head gate and post-merge gate are recorded in the PR / local-gate receipts.

Nothing was loosened.
