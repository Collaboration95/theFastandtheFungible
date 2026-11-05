# RC.2 preparation · 4 Nov 2026

Read-only public Testnet `tx` lookups of the 20 hashes already recorded by round3-a (MCP), round3-d (app), round3-e (token escrow), and round3-c (writer Credential/onboarding). `ledger-responses.json` retains the validated `tesSUCCESS` responses from s.altnet, retrieved 4 Nov (writer onboarding refreshed 5 Nov). No transaction was submitted and no faucet or model was called.

The eight round3-e transactions cover three happy create/finish pairs and one no-show create/cancel pair. **TEST-SGD IOU · stand-in for RLUSD · token escrow (XLS-85)**: on-ledger currency `SGT`, issuer `rxebQBMERDsVTJ8b5SsLiZ3FHToHUg79s`. This is Testnet evidence with no real value. The MCP/app evidence uses XRP escrow, fixture models and fictional writers. The ledger page rechecks each transaction against public endpoints and keeps unavailable or mismatched history labelled historical.

Local admission: `check:fast`, hygiene, Python pytest, browser/demo/ledger Playwright and all six clean artifact consumers (including app); fixture providers and simulated settlement. Browser regression injects a completed Testnet-labelled snapshot and proves the anchor arrives without reload, polling stops on success, and waiting expires after 90 seconds. This is browser fixture evidence, not a fresh paid Testnet run.

5 Nov read-only public WebSocket refresh: **45/45 validated** using the ledger page classifier, including the older fair-exchange cryptographic checks. No submission, faucet or model call. Historical availability can change after Testnet resets.
