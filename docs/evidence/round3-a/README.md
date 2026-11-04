# Round 3 · Lane A: zero-clone Testnet MCP

4 November 2026. `npx -y <packed mcp tgz> --testnet` against **XRPL Testnet · no real value**. Fixture models and
fictional writers; the buyer and writer wallets are generated faucet wallets. No seed or key appears in this
directory; the private wallet cache lived in a scratch `XDG_STATE_HOME` that the probe deleted.

Packed bytes: `dist/release/researchagent-mcp-1.0.0-rc.1.tgz` from `make release-artifacts` at this PR's head
(the published rc.1 does not contain `--testnet`). Probe: `RA_ACCEPT_TESTNET=1 node scripts/check-release-consumers.mjs --testnet`
(opt-in, network-gated, never in default CI). It uses a fresh npm cache, a stdio JSON-RPC client, operator caps
`MCP_MAX_BUDGET_MINOR=200 MCP_DAILY_CAP_MINOR=200`, and checks every hash against s.altnet JSON-RPC
(`validated: true`, `tesSUCCESS`, expected transaction type).

| Run | Initialize (s) | First tool call, wallets ready (s) | `ask_expert` incl. anchor (s) | Payer address |
|---:|---:|---:|---:|---|
| 1 | 10.5 | 18.4 | 32.8 | `rHdEeyJ8jodXpkCcktisFaWRGV5GeoRJwa` |
| 2 | 11.6 | 3.9 | 45.6 | `rHdEeyJ8jodXpkCcktisFaWRGV5GeoRJwa` |

Run 1 provisioned cold from the faucet (target < 60 s, < 20 s initialize). Run 2 restarted against the same state
directory: the payer address is identical and nothing was re-funded. A third `ask_expert` with a new idempotency key
bought nothing because the operator's S$2.00 daily cap was spent (180 of 200 minor units), and a same-key retry returned
the same run with no new charge.

| Run | Type | Hash | Ledger | Fee (drops) |
|---:|---|---|---:|---:|
| 1 | EscrowCreate | `78664FAACEAF396BAC8AF7ED980363D1C7B9D62E313DD3C528B6571712DC2704` | 22057764 | 12 |
| 1 | EscrowFinish | `EEA07EDF92CA2B0234CC63530B09830CD33947A90557D7A56A713E7A77BD0B36` | 22057766 | 423 |
| 1 | AccountSet | `185FFD5D138485431F9819974833863AD9A3017EA0773ED10406873306729610` | 22057768 | 12 |
| 2 | EscrowCreate | `2975D1142F0790A3B0AC19F7D642CD07E2298DC264620508A5C7D6800FB12875` | 22057778 | 12 |
| 2 | EscrowFinish | `30CE315A8FFEF957C67048105CE58AE04F7DD852F5B1BEB7D3B63113D2907799` | 22057780 | 423 |
| 2 | AccountSet | `1C540BEDCC9CCC609819240432E825A31F2780291A67DEFB3797321D4D4D3781` | 22057782 | 12 |

`ask_expert` returns these as `ledger.purchases[].create|finish|refund` and `ledger.anchor`, each with `txHash` and a
`https://testnet.xrpl.org/transactions/<hash>` explorer URL. The answer is the examples' Kestrel–TSMC question.

Cost card: `node scripts/testnet-cost-card.mjs docs/evidence/round3-a/probe.json --xrp-sgd 2.00`. Not loosened: no gate,
cap or threshold. Caps stay operator-set and default to zero.
