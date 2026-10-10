# Architecture contract

The browser is a view and command surface. The API server owns retrieval,
decisions, budget, payment and cited synthesis. Direction:
[FINAL-PUSH.md](../FINAL-PUSH.md).

## As built (8 Oct, on `main`)

- **Web** (`src/`): the run screen: clarify chips, the 5 s action modal,
  writer and trust chips, proof badges, the refund timeline and a Writers tab.
  It replays the finished trace at stage pace (D13).
- **API** (`server/`, Express): `agents/` (scope, plan, retrieval, gaps, Clef
  decisions, the loop, report), `reputation.ts` (trust), `purchases.ts`
  (the policy-only purchase core and x402 v2 buyer), `proofs.ts`,
  `challenges.ts`, and the PDF. DeepSeek writes, Clef decides, code pays.
- **Publisher host** (`publisher/`): one local process serving every writer
  under `/w/:slug/`: `search` (Orama hybrid over full text), `articles/:id`
  (free, or x402 v2 paid), `facilitator/{supported,verify,settle}`,
  `challenge`, and the signed manifest. `/registry` lists writers and wallets.
  The roster and 81 articles are generated into `data/` (`make corpus`).
- **Shared** (`shared/`): contracts, manifest and proof checker, x402 header
  codec, XRPL helpers.
- **Store**: SQLite via `node:sqlite`: `data/app.db` (runs, receipts, grants,
  reputation) and the publisher journal (quotes, settlements, refunds).
- **XRPL Testnet**: the buyer signs; each writer's facilitator submits and
  confirms; the writer's own wallet signs refunds. No real value.
- **Langfuse**: live runs are traced and scored.

Flow, headers and refund: [x402 and XRPL](../x402-xrpl.md).

## Shape of one run

The third writer column is the bad actor; the last is free open records.

```
                         CLIENT = the engine (server/ + src/)
 ┌──────────────────────────────────────────────────────────────────────┐
 │ ask ─► clarify (LLM, ≤2 questions) ─► plan ─► 5 s action modal ─► run │
 │ run: fan out sub-queries ─► fuse (price-blind) ─► free read ─► answer │
 │      gap (LLM, free text) ─► Clef value × trust ─► policy picks ─► pay │
 │      verify proof ─► challenge if broken ─► update trust ─► re-answer  │
 └───────┬───────────────────────────┬───────────────────────────┬──────┘
         │ GET /search?q=            │ GET article (x402 v2)     │ POST /challenge
         ▼                           ▼                           ▼
 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 │ NotFT        │  │ Load Factor  │  │ AlphaLeak    │  │ Open records │  … one per writer
 │ Orama hybrid │  │ Orama hybrid │  │ (bad actor)  │  │ FREE         │
 │ over FULL    │  │              │  │              │  │              │
 │ text, returns│  │              │  │              │  │              │
 │ abstract +   │  │              │  │              │  │              │
 │ signals +    │  │              │  │              │  │              │
 │ signed       │  │              │  │              │  │              │
 │ manifest     │  │              │  │              │  │              │
 │ own x402     │  │              │  │              │  │              │
 │ facilitator  │  │              │  │              │  │              │
 └──────┬───────┘  └──────────────┘  └──────────────┘  └──────────────┘
        └──── buyer pays writer directly on XRPL Testnet (we never hold funds)
```

Detail: client flow [§5](../FINAL-PUSH.md#5-client-flow-pseudocode), writer
site and manifest [§8](../FINAL-PUSH.md#8-what-every-publisher-writer-site-must-do),
x402 v2 changes [§9](../FINAL-PUSH.md#9-x402-v2-changes-to-todays-flow-d7).

## Trust boundaries

The browser holds no keys, seeds or premium bytes. Only policy code starts a
purchase. A failed proof quarantines a source, and it is never cited. The five
hard gates are in [the README](../../README.md#hard-guarantees); controls are in
[Security](SECURITY.md).
