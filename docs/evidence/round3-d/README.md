# Round 3 · Lane D: zero-clone web app

4 November 2026. `npx -y <packed mcp tgz> app --testnet` on **XRPL Testnet · no real value**. Fixture models and
fictional writers; buyer and writer wallets are generated faucet wallets. No seed or key is in this directory: the
private wallet cache, the npm cache and the state directory were scratch paths that the probe deleted.

Packed bytes: `dist/release/researchagent-mcp-1.0.0-rc.1.tgz` from `make release-artifacts` at this PR's head (the published
rc.1 has no `app`). Probe: `RA_ACCEPT_TESTNET=1 node scripts/check-release-consumers.mjs --testnet` (opt-in, network-gated,
never in default CI), which runs [`scripts/testnet-app-consumer.ts`](../../../scripts/testnet-app-consumer.ts): fresh npm
cache and fresh wallet cache, Chromium against the printed URL, the preset Kestrel question, **Start now**, then every hash is
checked on s.altnet JSON-RPC (`validated: true`, `tesSUCCESS`, expected transaction type).

| Measure | Seconds |
|---|---:|
| Cold: fresh npm cache + faucet wallets → ready line (target < 60) | 34.7 |
| Warm: same npm cache and wallets → ready line | 16.3 |
| Browser: Ask → key-reveal purchase → anchor in the engine | 41.4 |

Payer (public): `rpffyunWwu7FYqMFeqvJvhD1U7ZExQ2GuQ`. The warm boot printed the same address (nothing re-funded).

| Type | Hash | Ledger | Fee (drops) |
|---|---|---:|---:|
| EscrowCreate | `626CCC4296050C8B26267C9EAEE62AC7F7A3BB6C64B558904740690817DE2183` | 22058418 | 12 |
| EscrowFinish | `2617F82941F18F624867070EBAC6342FCF480E3BF5E76774A03D4A6C06CF3341` | 22058420 | 423 |
| AccountSet (anchor) | `280AC9B83D13D24D7E21C4FEBAEAB57222C71A92B94B3B34A6656986804F1771` | 22058422 | 12 |

Screenshots: [ready.png](ready.png) (the page at the printed URL) and [bought.png](bought.png) (payment card with the
`tx ↗` links for escrow create and key publication, and "Anchored on XRPL · ledger 22058422"). Raw numbers: [probe.json](probe.json).

**Observed, not fixed here (Lane B's files):** the anchor is written after the run is DONE and the page did not show it
live (`anchorShownWithoutReload: false`); the probe waits for the anchor in the engine, reloads the page, and the link
appears. The EscrowCreate/EscrowFinish links were live.

What stays simulated: all LLM and decision models (fixtures), the writer corpus (fictional), and the default `app` without
`--testnet` (SIMULATED SGD, no ledger transactions). A faucet failure also lands on SIMULATED, with the reason class in the
ready line.
