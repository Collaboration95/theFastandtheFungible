# Hire the agent: live Testnet proof (#274)

Recorded 3 Nov 2026 on local API/publisher ports 10088/10090 (`OFFSET=1300`).
Research uses fictional corpus, fixture scope/metadata decisions and extractive synthesis.
All five payments below are real XRPL Testnet `tesSUCCESS`, independently looked up
with exact delivered amounts. No real money or cloud resources.

Run: `cae775d0-583a-42ef-ae81-25bcc0c9f549`. Public receipt metadata: [hire-274.json](hire-274.json).
Private caller seed and durable journals remain local and are excluded from Git.

| Hop | Drops | Fee | Validated ledger | Transaction |
|---|---:|---:|---:|---|
| Caller → ResearchAgent | 220000 | 12 | 22025781 | [8AD6FD7B05EF9BCA0C738101102EC8094949CBB29CD44A6875D8CDFB24296134](https://testnet.xrpl.org/transactions/8AD6FD7B05EF9BCA0C738101102EC8094949CBB29CD44A6875D8CDFB24296134) |
| ResearchAgent → NotFinancialTimes (purchase) | 90000 | 12 | 22025783 | [FA422ABF33F6F7AA4F97E250072878AE1E08D82AD511160E4B154F4F8726AE77](https://testnet.xrpl.org/transactions/FA422ABF33F6F7AA4F97E250072878AE1E08D82AD511160E4B154F4F8726AE77) |
| ResearchAgent → caller (change) | 110000 | 12 | 22025785 | [CCDF6611D51A24DA57C307410D3D066E74D5DC03C3F82F093D5FD3C8ADEA4F39](https://testnet.xrpl.org/transactions/CCDF6611D51A24DA57C307410D3D066E74D5DC03C3F82F093D5FD3C8ADEA4F39) |
| ResearchAgent → NotFinancialTimes (royalty) | 2500 | 12 | 22025787 | [AF86FDEB2218D91D3A71A2EA72B32024EFEBFF22895C7E14E8BF0F43C86F7FE5](https://testnet.xrpl.org/transactions/AF86FDEB2218D91D3A71A2EA72B32024EFEBFF22895C7E14E8BF0F43C86F7FE5) |
| ResearchAgent → Open Records (free writer royalty) | 2500 | 12 | 22025789 | [48C600E3E5DE212BA38AA60A9FA7855DD91AFF3DAC7D153ECED4E373E68BD95E](https://testnet.xrpl.org/transactions/48C600E3E5DE212BA38AA60A9FA7855DD91AFF3DAC7D153ECED4E373E68BD95E) |

The final answer cites NotFinancialTimes and Open Records; the paid citation has
a verified grant, and the free writer receives the same royalty as the paid writer.
The royalty/change memos bind the run id and stable payout intent.

```text
Caller payment:       220000 drops
Writer purchase:       90000 drops
Citation royalties:     5000 drops (2500 each)
Caller change:        110000 drops
Retained service fee:  15000 drops
220000 = 90000 + 5000 + 110000 + 15000

Gross transfers:      425000 drops
5 network fees:           60 drops
Total Testnet spend:  425060 drops = 0.425060 XRP
```

Faucet funding is excluded. Network fees are sender-paid separately. The fixed
royalty pool is 25% of the 20,000-drop service fee; distinct cited slugs split
equally, with one-drop remainder allocated in slug order. No citations means
no royalty; zero change means no change transaction. See [policy](../x402-xrpl.md).

Validation: the live script repeated the exact paid intent and got a byte-equivalent
result with identical hashes. `npm run gate:audit -- --db data/hire-demo-live/app.db`
reports zero violations, including deterministic royalty and reconciliation rules.
Unit integration tests cover concurrent replay, restart, auth, caps, pause,
alternate signed blob, Mainnet/resource/amount refusals, rounding and audit corruption.

This ships API, SDK, optional remote MCP and CLI only, per the lane’s `src/`
ownership constraint. UX money-chain rendering belongs to the queued overhaul.
Durable payout rows and XRPL events are ready for #288’s hash-chained audit integration.
