# Architecture contract

The browser is a view and command surface. The API server owns retrieval,
decisions, budget, payment and cited synthesis. Direction:
[FINAL-PUSH.md](../../FINAL-PUSH.md).

## v1 as built (on `main`)

- **Web** (`src/`): the run screen. It replays the finished trace at stage
  pace (D13).
- **API** (`server/`, Express): research, decisions, the policy that picks
  purchases, the purchase core and the PDF. DeepSeek writes, Clef decides,
  code pays.
- **Publisher** (`publisher/`): one local service over the synthetic Vertex
  corpus, with an x402-shaped 402, quote and delivery flow. Its search ignores
  the query ([§2](../../FINAL-PUSH.md#2-why-the-6-oct-live-demo-looked-static-for-the-record)).
- **Store**: SQLite via `node:sqlite`: `data/app.db` (runs, receipts, grants)
  and `data/publisher.db` (journal).
- **XRPL Testnet**: the server signs and submits Payments, one wallet per
  publisher profile. No real value.
- **Langfuse**: live runs are traced and scored.

## Target (final push)

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

Detail: client flow [§5](../../FINAL-PUSH.md#5-client-flow-pseudocode), writer
site and manifest [§8](../../FINAL-PUSH.md#8-what-every-publisher-writer-site-must-do),
x402 v2 changes [§9](../../FINAL-PUSH.md#9-x402-v2-changes-to-todays-flow-d7).

## Trust boundaries

The browser holds no keys, seeds or premium bytes. Only policy code starts a
purchase. A failed proof quarantines a source, and it is never cited. The five
hard gates are in [prompt.md §2](../../prompt.md); controls are in
[Security](SECURITY.md).
