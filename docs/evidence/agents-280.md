# One wallet, many agents (#280), 3 Nov 2026

Give every agent its own allowance from one wallet. One existing funded Testnet
payer served two independent stdio MCP clients and a TypeScript SDK script.
These are programmatic MCP clients, not a Claude Code model session. The corpus,
research and decisions are labelled fixtures; payments used the real product
path and were independently looked up as validated `tesSUCCESS` on XRPL Testnet.
No mainnet value or live model call was used.

| Principal | Requested | Admitted per call | Daily cap | Gross spent | Rail |
|---|---:|---:|---:|---:|---|
| MCP A | S$5 | S$1 | S$1 | S$0.90 | XRPL Testnet |
| SDK / MCP B | S$5 | S$2 | S$3 | S$0.90 | XRPL Testnet |

The wallet cap was S$6/day; combined gross spending was S$1.80, no reservations
remained, and both the existing gate audit and the new principal-authority audit
reported **0 violations**. These SGD amounts are prototype policy units, not an
exchange-rate claim: each payment was **90,000 drops**, total **0.18 Testnet XRP**,
plus **24 drops** in ledger fees. The SDK run repeated through MCP B returned the
same run and charge. Revoking A rejected its next MCP admission; B remained valid.
The separate tests exercise revocation during an active purchase, including a
signed transaction completing once and unsigned reservation/signing refusal.

- A: `281E67C5ECA6E401DD08FEA881E75D950782F58A3F97ABD4881DBCA6F0F2B4C3`, ledger 22027168.
- B: `14E5B2F51BBDE4B3707413375BC3F913703A52E4808CDB6DAE81A49857812970`, ledger 22027170.

Public output: [summary](agents-280.json), [CSV receipts](agents-280-receipts.csv),
[JSONL receipts](agents-280-receipts.jsonl). Every receipt has `surface: agent`,
its agent key id as `principal`, rail, amount, invoice and transaction hash.
The hash chain verifies all two receipts and two signatures.

Reproduce from the repo root with the existing ignored `.env`:

Historical reproduction only: run the retired generator in the complete `b0a67ffa` tree; see [pin, runtime and recovery](../historical-tools.md). All generator commands on this page use that tree.

```sh
OFFSET=2000 node --import tsx scripts/evidence/agents-280.mjs
```

It uses API/publisher ports 10788/10790, the existing Testnet payer/writer seeds,
fixture providers and private journals under ignored `scratch/agents-280/`.
Repeated runs reuse the original idempotency keys and ledger blobs, including
A's revoked state; do not delete recovery state to retry an uncertain payment.
The private token file is demo client configuration, not a second server token
store. The engine stores only SHA-256 digests. Never copy private files to evidence.

UI work is owned by #311: this PR supplies CLI management and read-only API/SDK
allowance data for it. No Settings, palette or Wallet UI acceptance is claimed.
