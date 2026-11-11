# Default replay, re-recorded on XRPL Testnet (11 Nov 2026)

**XRPL Testnet · no real value.** Fixture models (`fixture · extractive-fixture`,
`fixture · metadata-fixture`), keyword search, fictional writers (AlphaLeak, The Fab
Floor), isolated faucet wallets. Not a quality or latency benchmark.

This is the run behind the default `/demo/` replay ("Key reveal (start here)"). It was also
the README hero and deck slide 10 until 11 Nov, when both moved to a live hosted-demo run
([hosted-export-nov11](../hosted-export-nov11/README.md)); `export.mjs --replay-shots` still
captures this replay as the offline fallback. It replaces the 7 Nov recording
(`docs/evidence/round4-j1/replays/key-reveal/`, kept unchanged as history), so the first
answer a judge opens is produced by the current engine and shown in the current app.

| | |
|---|---|
| Source commit | `71f4ff55` (main after FIX-A #452, K4 #442, K5 #450) |
| Recorded | 2026-11-10T20:37:17Z → 20:38:05Z (11 Nov, 04:37 SGT) |
| Run | `e681c122-f8da-4b33-a5d7-a3bd95732e71`, 54 events, budget S$2.00 |
| Question | "Are Kestrel Semiconductor's advanced-packaging lead times in Malaysia getting shorter?" |
| Outcome | Paid for 2 articles, 1 refunded, net cost S$0.40 (paid S$0.70, refunded S$0.30) |

## How it was made

```sh
make testnet ARGS="--capture --key-reveal" OFFSET=3900
```

`scripts/capture-browser-demo.ts` drives the real engine over its public HTTP/SSE path with
fixture providers and faucet wallets, waits for the validated answer anchor, and looks up
every hash before writing. It wrote `demo/traces/UC3-key-reveal.json` and its evidence into
`docs/evidence/lane-b3/`. That folder is historical evidence for the README's receipts, so the
three new files were moved here (`key-reveal/UC3.receipts.json`, `proof.json`,
`transactions.json`, with each row's `source` set to this folder) and `lane-b3` was restored
unchanged. One capture, first attempt; nothing was retried or edited.

## Transactions

All six were validated `tesSUCCESS` when captured. Ledger dates are UTC.

| Step | Transaction | Ledger | Fee (drops) |
|---|---|---:|---:|
| Escrow created, AlphaLeak | [A8DC9B57…22F4C8E7](https://testnet.xrpl.org/transactions/A8DC9B577696F2C4B4A2BE757601F001413509A3E2A88A404178911722F4C8E7) | 22224888 | 12 |
| Writer released the key (EscrowFinish); the article then broke its promise | [4D3D0F43…CE8AFE62](https://testnet.xrpl.org/transactions/4D3D0F43F0147DEE086B009AAC5CDFFF1B57E0F0ACDE6EC3BE4C00B6CE8AFE62) | 22224890 | 423 |
| Refund, writer-signed (this demo writer agrees to refund; a real writer could refuse) | [DFBAC104…FDC3C252](https://testnet.xrpl.org/transactions/DFBAC104801CE48E08FFDCB2B1D328456CA41AA811F69C029D48ED87FDC3C252) | 22224892 | 12 |
| Escrow created, The Fab Floor | [29F1B9F6…F89CED92](https://testnet.xrpl.org/transactions/29F1B9F61C11AE0486A9573365CF0C062354AE3A4951F1EACE43BBA6F89CED92) | 22224894 | 12 |
| Writer released the key (EscrowFinish); key matches the escrow lock | [D3B8F480…8C66CBBD](https://testnet.xrpl.org/transactions/D3B8F480B29AAC560916084AACD64624C2BCF9DCF51EBF338A19DC3B8C66CBBD) | 22224896 | 423 |
| Answer anchor (AccountSet, memo = audit head `1b4022ae…`) | [51232E23…6B4715DB](https://testnet.xrpl.org/transactions/51232E236227C12A40057C7E32974B3A82CE2BBBB77C43FBA2A552716B4715DB) | 22224898 | 12 |

## Checks

- `key-reveal/python-verifier.txt`: the Python verifier (`python -m researchagent verify
  key-reveal/UC3.receipts.json --ledger`, run from `packages/sdk-python/src`) on 11 Nov:
  61 PASS, 0 FAIL, 2 SKIP (writer identity and historical origin, as always for fixture
  writers); audit anchor validated at ledger 22224898; Testnet 12/12 read-only.
- The replay page re-checks all six hashes live on load ("6/6 hashes verified live").
- `tests/browser-demo.test.ts` binds the receipts and the six hashes to this run ID, and
  checks grant and citation boundaries at every replay prefix.

## What did not change: the lead sentence

The lead still reads "So from 1 June 2026 to 15 September 2026, we went from 26 weeks to
18 weeks, …". It is an exact sentence from The Fab Floor's fictional article, and answers
only quote delivered sentences. K4 and K5 deliberately kept the UC1–UC3 leads, so recording
on current main does not change it. Rewriting that sentence (and S27's "lost a fifth of its
consensus gross margin") means editing the fictional corpus and re-embedding the two
articles. The edits sit inside each article's embedded head, and `tests/eval/search-eval.test.ts`
compares hybrid search on exactly these two articles. On 11 Nov every Cloudflare token in
`.env` returned HTTP 401 from Workers AI, so the vectors could not be refreshed. The corpus
was left as it is; this is an owner item.
