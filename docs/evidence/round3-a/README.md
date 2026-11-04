# Round 3 · Lane A: zero-clone Testnet MCP

4 November 2026. `npx -y <packed mcp tgz> --testnet` against **XRPL Testnet · no real value**. Fixture models and
fictional writers; the buyer and writer wallets are generated faucet wallets. No seed or key appears in this
directory; the private wallet cache lived in a scratch `XDG_STATE_HOME` that the probe deleted.

Packed bytes: `dist/release/researchagent-mcp-1.0.0-rc.1.tgz` from `make release-artifacts` at this PR's head
(the published rc.1 does not contain `--testnet`). Probe: `RA_ACCEPT_TESTNET=1 node scripts/check-release-consumers.mjs --testnet`
(opt-in, network-gated, never in default CI). It uses a fresh npm cache, a stdio JSON-RPC client, operator caps
`MCP_MAX_BUDGET_MINOR=200 MCP_DAILY_CAP_MINOR=200`, and checks every hash against s.altnet JSON-RPC
(`validated: true`, `tesSUCCESS`, expected transaction type). Final run: `RA_ACCEPT_TESTNET=1 node scripts/check-release-consumers.mjs --testnet` on the head of this PR, after `make release-artifacts` passed its offline consumers.

| Run | Initialize (s) | First tool call, wallets ready (s) | `ask_expert` incl. anchor (s) | Payer address |
|---:|---:|---:|---:|---|
| 1 | 11.2 | 17.0 | 33.1 | `r9utosnNWhHBKJpzmGydNxCnBX9t2h1bpH` |
| 2 | 11.3 | 3.9 | 45.7 | `r9utosnNWhHBKJpzmGydNxCnBX9t2h1bpH` |

Run 1 provisioned cold from the faucet (target < 60 s, < 20 s initialize). Run 2 restarted against the same state
directory: the payer address is identical and nothing was re-funded. A third `ask_expert` with a new idempotency key
bought nothing (`spentMinor` 0, clamped budget under one article price) because two purchases had used most of the operator's S$2.00
daily cap; a same-key retry in each run returned the same run with no new charge.

| Run | Type | Hash | Ledger | Fee (drops) |
|---:|---|---|---:|---:|
| 1 | EscrowCreate | `18B48FFB83BB9414361AF5CBFC66A7D932CEE4209BCA48B00E733E79DE96A335` | 22057946 | 12 |
| 1 | EscrowFinish | `2B4C8269637FFDB2E4EB1FAAFCF4214FE704975B25B664BBF8FB8C77A5A219FA` | 22057948 | 423 |
| 1 | AccountSet | `B0B32322E91E8A8AEF909ED6536E2341D5B20D9E3FFED3E467540EF309F717F6` | 22057950 | 12 |
| 2 | EscrowCreate | `4AE053AB8ECF0DAD3254B246A3481D3AA56626A3C59D28B598A6002BA21B855D` | 22057959 | 12 |
| 2 | EscrowFinish | `5018EDDE71DA1B0E44E372E6000946CEC1C3DC1743F7A6B1BAB66037E98E22D4` | 22057961 | 423 |
| 2 | AccountSet | `D0694DFE47F1A205E80AEC78671E165478EDAD9A4EA7ACB1838656F9927B56CD` | 22057963 | 12 |

`ask_expert` returns these as `ledger.purchases[].create|finish|refund` and `ledger.anchor`, each with `txHash` and a
`https://testnet.xrpl.org/transactions/<hash>` explorer URL. The answer is the examples' Kestrel–TSMC question.

Cost card: `node scripts/testnet-cost-card.mjs docs/evidence/round3-a/probe.json --xrp-sgd 2.00`. Caps stay operator-set and default to zero.

Devcontainer CI (second Testnet observation, GitHub-hosted runner): [run 41804181845](https://github.com/Collaboration95/theFastandtheFungible/actions/runs/41804181845),
51.9 s, EscrowCreate `0AB8881C01758BC9418A700918153F172AEB9F9B474B12134D564A6B9A99D039` (ledger 22057869) and EscrowFinish
`E76A9F4A6363785C6ACCEF528540F0140AF6FA3969D4E07854FEDDB1E7130CBE` (ledger 22057870), both checked as validated `tesSUCCESS` on s.altnet.

Not loosened by this lane: no gate, cap, threshold or test. Remaining SIMULATED or substituted: the models (fixture), the corpus and
writers (fictional; the fixture engine holds the writer seeds, so refunds are cooperative), and the faucet-failure fallback (labelled).
