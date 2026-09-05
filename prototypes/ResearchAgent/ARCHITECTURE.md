# ResearchAgent architecture

The browser is a view and command surface. The Express server is authoritative
for discovery, retrieval, family lineage, gap analysis, purchase utility,
integer budget arithmetic, access grants, persistence, and dossier citations.

```text
React Trace Desk
  │ REST + SSE
  ▼
Express ResearchAgent API
  ├─ scenario + brief registry (fixture corpus)
  ├─ deterministic retrieval (BM25-shaped lexical score + tags)
  ├─ explicit evidence-family lineage
  ├─ gap / purchase planner + BudgetGuard
  ├─ server-only premium store + exact resource access
  ├─ fixture settlement ledger (settlement ≠ delivery)
  ├─ fixture LLM adapter contract + fallback status
  └─ JSON-file event/run persistence
```

`src/domain.ts` contains public-safe records and pure retrieval helpers. Premium
bodies live only in `server/premium-store.ts`, which is never imported by the
client entrypoint. `server/index.ts` strips bodies before every public response
and only attaches evidence spans after the exact source is bought.

The canonical fixture uses 200 integer cents. The server rejects an offer above
the S$1.00 per-source ceiling or above remaining budget, and the model has no
payment authority. Circuit Note shares Northstar's family and is skipped as a
derivative. Meridian's purchase changes the thesis. GridScope remains blocked
with S$1.00 remaining.

Live OpenAI/Groq adapter wiring is intentionally represented by the documented
provider boundary and fixture fallback in this prototype; no credential is
needed to run the canonical path.
