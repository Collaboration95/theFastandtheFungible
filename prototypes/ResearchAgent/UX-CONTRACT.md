# ResearchAgent UX contract

## Workflow

The primary operation is a two-step research conversation:

1. **Ask** — the user enters a question or chooses a grounded starting point.
   The assistant reflects the question and points them to the website allowlist.
2. **Websites** — the user chooses the websites the agent may read and sets the
   XRP research budget in the same panel. There is no separate answerability
   form or user-facing analysis token limit.
3. **Research** — the server creates a persisted run, discovers open evidence,
   ranks candidates, reads open material, identifies a gap, and prepares a
   purchase plan.
4. **Agent action** — Groq receives only the retrieved previews and metadata,
   selects an eligible purchase action, and the server executes the explicit
   buy/skip/block mutation with deterministic budget and payment guards.
   Source rows remain available for inspection and additional manual actions.
5. **Synthesize** — after a verified purchase, the user may create a short
   dossier with claims linked to accessible evidence spans.

The canonical fixture decisions remain: buy Northstar Wire for S$0.20, skip
Circuit Note as redundant, buy The Meridian Ledger for S$0.80, and block
GridScope Asia at S$1.40 because the remaining authority is S$1.00.

## Canonical owners

| Capability | Owner | Contract |
| --- | --- | --- |
| Question entry | `Composer` | Enter submits; Shift+Enter inserts a line break; IME composition is never submitted early |
| Website and budget configuration | `PublisherPicker` + `BudgetControl` | Website allowlist and XRP budget before run creation |
| Source universe | `classifySource` + `SourceItem` | User-selected families remain visible in the run summary and filter labels |
| Candidate action | Groq purchase planner + purchases API | LLM chooses from retrieved metadata; server enforces Buy, Skip, or Block |
| Evidence inspection | `EvidenceDrawer` | Focus, Escape, backdrop, exact spans, and focus restoration |
| Budget | Server `purchases` route | Integer cents, per-source ceiling, no overdraft |
| Dossier | Server `synthesize` + `DossierPanel` | Claims cite accessible spans and preserve uncertainty |
| Status feedback | `statusbar` + app live region | Material changes only; raw backend errors are not surfaced |
| Visual tokens | `src/styles.css` | Semantic CSS variables documented in `DESIGN.md` |

## State and recovery

The start state does not create a server run. A run is created only after the
website panel is confirmed, using the question, default research context,
website allowlist, and XRP budget. Retrieval remains deterministic and mock;
Groq sees only the resulting source previews and metadata. The client prevents
duplicate start and purchase actions while a request is pending. Server-
authoritative state wins after every mutation.

“New research” resets only the current client thread and returns focus to the
question surface. It does not claim to delete or rewrite persisted evidence.
Pause/resume and stop remain available in the research header while a run is
active. Premium previews never expose protected text before a verified purchase.

## Accessibility and resilience

Native buttons, inputs, textareas, headings, lists, and definition lists are
used throughout. Product forms use `noValidate`; textareas use `resize: none`.
Focus is visible, drawer close restores focus, Escape closes the drawer, and the
live region announces material state changes. Search-style question entry uses
IME-safe Enter handling. Reduced motion removes transitions and smooth scroll.

The layout reflows at 780px and 520px without hiding source actions or statuses.
The document owns vertical scrolling; the drawer owns only its own overflow.
Print hides application chrome and preserves the dossier, citations, and
limitations.

## Evidence and language

Before purchase, premium sources expose metadata, preview, price, and terms
only. After a verified fixture purchase, exact synthetic evidence spans become
accessible. `Open evidence`, `Premium preview`, `Premium · unlocked`, and
`FIXTURE PAYMENT · NOT A REAL PUBLISHER PAYMENT` are intentionally explicit.
