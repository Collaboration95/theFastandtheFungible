# Cold Testnet start-up and the MCP tool timeout · 10 Nov 2026

**XRPL Testnet · no real value.** Fixture models, fictional and team-authored writers, public faucet XRP only. Nothing here is a mainnet measurement.

This is a committed extract of one finding from the 10 Nov reachability audit of release v1.0.2 (main at `2d3999f8`). The audit lane measured it with empty consumer directories and fresh Testnet state; it was **not re-run for this extract**. The full audit report is outside this repository.

## What was measured

| Measurement | Result | Class |
|---|---|---|
| Cold `try --testnet` (empty npm cache, fresh Testnet state) | passed in **76.15 s**: purchase, failed proof, refund, re-buy, anchor, 12/12 live ledger checks | observed |
| Cold `app --testnet --iou` | ready after **95.841 s**; wallet, issuer, trust-line and issuance setup took 93.16 s | observed |
| Progress lines during that setup | at 0.0 s, 0.0 s, 12.9 s and 81.6 s; nothing between 81.6 s and ready | observed |
| Warm IOU MCP wallet status | 7.935 s | observed |
| `docs/mcp.md:34` Codex entry | `tool_timeout_sec = 60` | read from the file |

## What follows from it

The MCP server runs the same wallet preparation on its **first tool call** (`mcp/testnet.ts`, `prepareMcpTestnet`), after `initialize` has already returned. A cold IOU start of about 96 s is therefore longer than the documented 60 s tool timeout. Raising only a startup timeout would not help, because the stdio `initialize` and tool listing succeeded before wallet setup began.

**Derived risk, not an observed cancellation:** no real Codex or Claude Code chat was seen to cancel the call. The 60 s figure is the documented client setting, and the cold path measured here is longer than it.

## How this is recorded

[BUILDER-FEEDBACK](../../BUILDER-FEEDBACK.md): the 10 Nov entry in the log and an update on B32 (the earlier 102.9 s IOU provisioning measurement). Suggested follow-up for the docs owner (not changed here): a Testnet/IOU config with `tool_timeout_sec = 180`, or pre-provisioning wallets through the app, plus a sentence that the first operation can take about two minutes.
