# Markdown publishing proof · #277 · 3 Nov 2026

Reachability: a local Markdown folder became a writer an agent could discover and
pay. This run used **synthetic starter content**, the **fixture extractive writer**
and **fixture metadata decision model**, with **real XRPL Testnet settlement**.
No live research/decision model is claimed. No mainnet funds or cloud resources.

- Folder → searchable/payable writer, including new-wallet faucet funding: **9.16 s**.
- Folder → verified paid read: **19.30 s** (payer readiness checked before timing).
- One intent, one receipt, one proof-verified grant, **10,000 drops = 0.01 Testnet XRP**.
- Validated `tesSUCCESS` in ledger **22016229**, destination
  `r3qSDtFPYsWLiGkNa22C8grJN72M37cUbc`, delivered amount `10000`.
- Transaction: [E44DF6D66C0027C64C5C1C4746F6175BD95F33F1B6CF2A6F1ACDCA8B079B3AD5](https://testnet.xrpl.org/transactions/E44DF6D66C0027C64C5C1C4746F6175BD95F33F1B6CF2A6F1ACDCA8B079B3AD5).
- Public receipt and exact citation references: `publish-site-277.json`.
- Retried network access was read-only transaction lookup, not another purchase.

Terminal transcript (public output excerpt; publishing and purchase invoked by
`node --import tsx scripts/publish-demo.ts --testnet`):

```text
$ cp -R examples/writer-starter scratch/publish-demo-testnet
$ OFFSET=800 npm run publish:site -- scratch/publish-demo-testnet
Wallet r3qSDtFPYsWLiGkNa22C8grJN72M37cUbc · XRPL TESTNET · key saved privately
Search: keyword · live embeddings off (SEARCH_EMBEDDINGS=live enables hybrid)
Published 3 articles · unverified writer · SYNTHETIC
Site http://127.0.0.1:9590/w/publish-demo-testnet/
Folder → searchable, payable writer: 9.16 s
Fixture policy: BUY publish-demo-testnet-1-capacity
Budget: S$0.10 · spent: S$0.10 · VERIFIED · 1 receipt · 1 grant
XRPL TESTNET · 10000 drops · ledger 22016229
Tx E44DF6D66C0027C64C5C1C4746F6175BD95F33F1B6CF2A6F1ACDCA8B079B3AD5
Folder → paid read: 19.30 s
```

LinkedIn angle: the supply side of agent commerce can fit in one command:
Markdown, a signed manifest and a Testnet wallet. A fixture agent found the new
writer and paid for proof-verified evidence in 19.30 seconds. Public topic labels
help it decide; the full article stays behind x402.
