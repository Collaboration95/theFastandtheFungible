# Markdown publishing proof · #277 · 3 Nov 2026

Reachability: a local Markdown folder became a writer an agent could discover and
pay. This run used **synthetic starter content**, the **fixture extractive writer**
and **fixture metadata decision model**, with **real XRPL Testnet settlement**.
No live research/decision model is claimed. No mainnet funds or cloud resources.

- Folder → searchable/payable writer, including new-wallet faucet funding: **7.23 s**.
- Folder → verified paid read: **18.90 s** (payer readiness checked before timing).
- One intent, one receipt, one proof-verified grant, **10,000 drops = 0.01 Testnet XRP**.
- Validated `tesSUCCESS` in ledger **22025285**, destination
  `r4fGf3dfENteD9KgS3r8rbY9WywcAiDRt5`, delivered amount `10000`.
- Transaction: [ED26E003037BC6BD3F1E580F3C5E019F30E170535C9E034F45DFE1EB08F15FA5](https://testnet.xrpl.org/transactions/ED26E003037BC6BD3F1E580F3C5E019F30E170535C9E034F45DFE1EB08F15FA5).
- Public receipt and exact citation references: `publish-site-277.json`.
- Retried network access was read-only transaction lookup, not another purchase.

Terminal transcript (public output excerpt). The demo script calls the same
`publishSite` implementation as the CLI; its printed shell recipes are shown
below as comments. The actual CLI is separately exercised by the fixture test:

Historical reproduction only: run the retired generator in the complete `b0a67ffa` tree; see [pin, runtime and recovery](../historical-tools.md). All generator commands on this page use that tree.

```text
$ node --import tsx scripts/publish-demo.ts --testnet
# Recipe: cp -R examples/writer-starter scratch/publish-demo-testnet
# Recipe: OFFSET=800 npm run publish:site -- scratch/publish-demo-testnet
Wallet r4fGf3dfENteD9KgS3r8rbY9WywcAiDRt5 · XRPL TESTNET · key saved privately
Search: keyword · live embeddings off (SEARCH_EMBEDDINGS=live enables hybrid)
Published 3 articles · unverified writer · SYNTHETIC
Site http://127.0.0.1:9590/w/publish-demo-testnet/
Folder → searchable, payable writer: 7.23 s
Fixture policy: BUY publish-demo-testnet-1-capacity
Budget: S$0.10 · spent: S$0.10 · VERIFIED · 1 receipt · 1 grant
XRPL TESTNET · 10000 drops · ledger 22025285
Tx ED26E003037BC6BD3F1E580F3C5E019F30E170535C9E034F45DFE1EB08F15FA5
Folder → paid read: 18.90 s
```

LinkedIn angle: the supply side of agent commerce can fit in one command:
Markdown, a signed manifest and a Testnet wallet. A fixture agent found the new
writer and paid for proof-verified evidence in 18.90 seconds. Public topic labels
help it decide; the full article stays behind x402.

The resumed run exercised the final v2 signed fact-menu path and exited cleanly.
A separate read-only transaction lookup verified validated `tesSUCCESS`, destination
and delivered amount; it did not submit another payment. This run spent 0.01 Testnet
XRP (plus the network fee), below the 0.1 XRP cap. The previous run also spent
0.01 Testnet XRP; total across both runs is 0.02 XRP plus network fees.

The command used to reproduce the resumed run was:

```sh
OFFSET=800 LOCAL_WRITERS_DIR=scratch/published-final-277 node --import tsx scripts/publish-demo.ts --testnet
```

The buyer wallet was ready before timing. Writer faucet funding, folder copy,
indexing, registration, fixture policy, settlement and proof verification were
inside the 18.90-second interval. Search was keyword; optional live embeddings
were disabled. No paid model API calls were made.
