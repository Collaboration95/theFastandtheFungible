# Lane P2 · Testnet first touch

Recorded 4 Nov 2026 (Singapore). Fictional corpus, fixture models, XRP Testnet only;
no real value. Cold ignored wallet cache: `make testnet ARGS=--capture` reached the
first independently looked-up validated payment hash in **60.005 seconds**. This
includes one public faucet request, seven sequential writer funding transactions,
and API/publisher startup. Node dependencies were installed; this is not a cold
npm-install measurement. Earlier retries used different wallets and are excluded.

The public HTTP/SSE capture recovered via durable GET after an oversized frame.
UC3 paid AlphaLeak, rejected its proof, validated a cooperative refund, and bought
The Fab Floor. Refunded content remains quarantined. No escrow refund is claimed.

- purchase: `8E4C6D5F6FF474F89C199DEB07D8FF7D51586ECECAA4BC754894428586DC461B` · ledger 22047501 · 30000 drops · fee 12 drops.
- refund: `0BB4C81FE0AB8810FC7FE3E510BEE553719FAB113309C2367F01D83155840BDD` · ledger 22047503 · 30000 drops · fee 12 drops.
- purchase: `F8429067926319A2545DEF1065073B59CF08F51CFB7ED489F9271B349451C85D` · ledger 22047505 · 40000 drops · fee 12 drops.

Each transaction was independently fetched as validated tesSUCCESS with destination,
InvoiceID and delivered amount retained in `transactions.json`. The refund invoice
binds the first purchase hash. Capture: `demo/traces/UC3-testnet.json`, with source
SHA and timestamp. The capture SHA identifies the #359 base; capture ran with
the uncommitted Lane P2 implementation in this worktree, subsequently committed
in this PR. It is not a claim that the base alone contains the launcher. Wallet seeds remain ignored, under scratch, mode 0600.

Replay defaults to Recorded on XRPL Testnet · no real value with Pause/Resume;
simulated UC1–UC3 remain secondary scenarios. Ledger verification reuses the
bounded WebSocket verifier. Offline failures retain historical labels. The public
faucet fan-out failure and single-buyer workaround are in BUILDER-FEEDBACK.

Verification commands: `npm run check:fast`, `npm run build:demo`,
`npx playwright test --config tests/playwright/demo.config.ts`,
`npx playwright test --config tests/playwright/ledger.config.ts`, and
`python3 -m pytest packages/sdk-python`. Raw premium and every replay-prefix grant
provenance checks cover the new recording as well as all simulated recordings.
No gate or threshold was loosened. Ledger row assertions increase from 13 to 16.

Final replay JS+JSON assets: **1,874,689 bytes** (<2,000,000). Browser: 1/1 demo and 4/4 ledger checks pass; Python: 205/205 pass.
