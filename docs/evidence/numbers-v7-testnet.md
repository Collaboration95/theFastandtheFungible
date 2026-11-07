# Numbers v7: live Testnet sanity runs · 3 November 2026

LIVE DeepSeek planner and writer; LIVE Luna decisions and coverage.
Keyword search, synthetic demo corpus, **real XRPL TESTNET settlement, no real
value**. These two sanity runs establish that the product path works with
settlement; they do not estimate or validate the statistical headline percentage.
The scope endpoint made a successful live provider call, but its returned label
was not retained in this first run. No fixture writer answers or unavailable decisions; every transaction below
was independently retrieved as validated `tesSUCCESS`, network ID 1.

| Run / outcome | Transaction hash | Ledger | Amount | Fee drops |
|---|---|---:|---:|---:|
| UC2: NotFT purchase, verified | `C05EAA52AB69C7459D18890BD0E5F1C3BFC3696A9809652A1B22F1E820958520` | 22027636 | 0.09 XRP | 12 |
| UC3: AlphaLeak purchase, proof failed | `AF682D950A7696F703477642559F4E78F2A7CD099649B02C43709586D25BC539` | 22027643 | 0.03 XRP | 12 |
| UC3: confirmed refund, bytes quarantined | `2CAC55428195B6284A05660B34E7C45FC07D96A0EA5520EAF3E3EBAE6CB6080E` | 22027645 | 0.03 XRP returned | 12 |
| UC3: The Fab Floor purchase, verified | `954CBA7061F8855725B6FD02627DE11DF99F330992C3E7E6DE3724A0599B4768` | 22027647 | 0.04 XRP | 12 |

Gross buyer payments **0.16 XRP**, refund **0.03 XRP**, net **0.13 XRP**;
fees **48 drops** across buyer and publisher. No SGD/XRP exchange-rate claim.
The S$2 per-run budget and gross spending authority remain unchanged by refunds.
UC2 coverage: **0/3 → 3/3**; UC3: **0/3 → 2/3**, one requirement still missing.
The partial UC3 result is retained; no retry selected for a better answer.
Gate audit: **0 violations / 2 runs / 64 raw search observations**. Durable
money audit chain: **25 entries, valid**, three receipts and one refund.
This wire count covers search, not captured SSE; the raw store is audited.

Reproduce intentionally (spends Testnet XRP and model calls):

Historical reproduction only: run the retired generator in the complete `b0a67ffa` tree; see [pin, runtime and recovery](../historical-tools.md). All generator commands on this page use that tree.

```sh
OFFSET=700 node --import tsx scripts/evidence/numbers-v7-testnet.mjs
```

Uses existing funded Testnet accounts, the `.env` symlink, ports 9490/9488,
private durable `scratch/numbers-v7/testnet/` journals, no faucet or cloud
resources. Recovery first discovers the existing persisted run by question and otherwise
uses stable HTTP idempotency headers. The original successful run was created
once without a recovery retry. Preserve
journals before rerunning. The script reserves at most US$0.75 for decisions
and US$0.75 for research, at the dated eval rates. DeepSeek usage is metered
from the real SSE usage frames; cache discounts ignored conservatively.
Machine-readable public results: `numbers-v7-testnet.json`. Raw stores, response
cache and usage ledger are retained locally, outside the final removed worktree.
