# SITE verification · 11 Nov 2026

Scope: static gh-pages explainers and Replay shell only. No app code, replay
transport, recorded traces, wallet or payment execution changed.

- `initial-checks.json`: first full scan, retained with failures (future-row opacity, archive small text and guide font path); those were corrected before the final run.
- `rebased-replay-checks.json`: Replay rechecked and captures refreshed at both widths after the hosted-UI rebase onto dd52e7a5; zero violations, overflow or console errors.
- `checks.json`: Playwright/axe at 390 and 1440 px, with reduced motion and
  normal motion. Issuer responses are mocked for deterministic on/off/outage
  regression; those are not live network evidence.
- `*-390.png`, `*-1440.png`: local static pages, reduced motion.
- `live-browser-ledger.json`: 61/61 historical Testnet transactions validated in the shared browser; hash and status visible at 390 px.
- `live-browser-issuers.json`: the widget client also read both validated AccountRoots in the shared browser.
- `live-issuers.json`: separate read-only public `account_info` queries using
  the same browser-compatible client. Both official issuer addresses and the
  0x40000000 AccountRoot flag were checked against Ripple and XRPL docs.
- `python3 scripts/site-publish.test.py`: three regression tests for bounded
  retry, exhausted attempts and concurrent publication conflict refusal.

Reproduce: build Replay (`npm run build:demo`), then run
`sh /Users/speedpowermac/Documents/ChatGPT/tftf-wt/notes/review-nov10/heavy-lock.sh env OFFSET=2300 node scripts/site-verify.mjs`.
The runner serves the actual Pages subpath on port 7400 and closes its server.

The October walkthrough remains a historical plain-payment animation. Its
recorded events are preserved. The money overlays explicitly apply today’s
budget policy: 70 cents charged, 30 refunded, 40 net, 130 of 200 left. The
current key-reveal section links to the real recorded 7 Nov Replay.

Whole-product `brand:verify` integration is deferred: its generator rewrites
`src/`, public app metadata and desktop outputs outside SITE ownership. The
new site-only metadata/card check runs in hygiene without those mutations.

Final matrix: **36/36 passed** (nine surfaces × two widths × two motion settings), zero axe violations at every severity, zero document overflow and zero console/page errors.
