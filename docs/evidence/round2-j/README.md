# Lane J UX polish: before/after, 4 November 2026

Presentation only. No IPC, Keychain, validation, engine, contract or policy change.
Screenshots use the Round 2 G receipt fixtures (synthetic, simulated) in a fixture
wrapper, and the real `desktop/*.html` pages with a stubbed `window.desktop`
(fixture state; the Test connection result "412 ms · 18/4 tokens · $0.00002" is
synthetic, not a provider call). No provider, Testnet, Keychain or ledger access.

- `*-receipt-useful.png`, `-redundant`, `-refunded`: "What your money bought".
- `*-receipt-useful-pending.png`: a recorded `SIGNED_UNCONFIRMED` royalty row
  (stubbed export) shows a half-filled amber dot and "Pending", never green.
- `*-settings.png`: Mac Settings. `*-recovery.png`: Mac recovery screen.

Honesty labels kept visible: "Not assessed", "Not independently verified",
"Exact delivered passage", "recorded status; not checked on ledger here".
The recovery screen receives no failure reason from the app, so it lists the four
common causes instead of claiming one; it does not detect state.

```sh
node --import tsx scripts/ux-polish-screenshots.ts after   # before = run on the parent commit
```
