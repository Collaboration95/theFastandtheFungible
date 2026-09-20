# ResearchAgent UX contract

## Workflow

The primary user-facing operation is a guided, resumable research sequence:

1. **Question** — the user enters or edits a question, or chooses a grounded
   starting point. Unsupported scope is reported truthfully; unrelated fixture
   evidence is never used as an answer.
2. **Sources** — the user chooses named source profiles/families the system is
   allowed to read. These are authorization boundaries, not guarantees that
   their claims are accurate.
3. **Budget** — the user sets a maximum research spend, distinct from wallet
   balance and actual source price. The fixture conversion is labelled an
   approximation, not live FX; setting a cap is not a charge or purchase.
4. **Review** — the user sees a readable plan summary and may reveal advanced
   settings progressively. Approval here is plan approval, not purchase consent.
5. **Research** — the server creates a persisted run, discovers open evidence,
   ranks candidates, reads open material, identifies a gap, and prepares a
   purchase plan.
6. **Answer** — usable accessible evidence may produce a cited answer without a
   purchase. If a premium candidate may help, the user can inspect an exact
   quote and explicitly approve it; purchase remains optional.

The backend's internal actions remain:

1. **Agent action** — Groq receives only the retrieved previews and metadata,
   selects an eligible purchase action, and the server executes the explicit
   buy/skip/block mutation with deterministic budget and payment guards.
   Source rows remain available for inspection and additional manual actions.
2. **Synthesize** — when the approved run has usable accessible evidence, the
   user may create a short dossier, whether that evidence is open or premium /
   unlocked. Groq streams a structured, grounded draft from the question,
   budget, purchase decisions, and accessible evidence spans; the server
   validates citations before the dossier becomes ready. Empty or unsupported
   evidence cannot masquerade as a completed answer.

During an active run, those stages render as one numbered vertical path:
**1. Search**, **2. Purchase**, **3. Answer**. The source set belongs to Search,
the settlement and receipt belong to Purchase, and the working answer or cited
dossier belongs to Answer. The run view does not repeat those facts in a
separate sidebar or duplicate answer panel.

The canonical fixture decisions remain available for paid-path verification:
buy Northstar Wire for S$0.20, skip Circuit Note as redundant, buy the Grid
Operators Report for S$0.80, and block GridScope Asia at S$1.40 because the
remaining authority is S$1.00. They are fixture decisions, not a requirement
that every answer purchase a source.

## Canonical owners

| Capability | Owner | Contract |
| --- | --- | --- |
| Question entry | `Composer` | Enter submits; Shift+Enter inserts a line break; IME composition is never submitted early |
| Source and budget configuration | `SourceProfileList` + `BudgetControl` | Named allowed-to-read profiles and maximum XRP spend before run creation; cap is not a charge or purchase consent |
| Source universe | `classifySource` + `SourceItem` | User-selected families remain visible in the run summary and filter labels |
| Candidate action | Groq purchase planner + purchases API | LLM chooses from retrieved metadata; server enforces Buy, Skip, or Block |
| Evidence inspection | `EvidenceDrawer` | Focus, Escape, backdrop, exact spans, and focus restoration |
| Budget | Server `purchases` route | Integer cents, per-source ceiling, no overdraft |
| Dossier | Server `synthesize` + `DossierPanel` | Groq streams grounded JSON; claims cite accessible spans and preserve uncertainty |
| Status feedback | `statusbar` + app live region | Material changes only; raw backend errors are not surfaced |
| Visual tokens | `src/styles.css` | Semantic CSS variables documented in `DESIGN.md` |

## State and recovery

The start state does not create a server run. A run is created only after the
guided question, named source-profile, budget, and readable plan decisions are
confirmed, using the question, default research context, allowed profiles, and
XRP cap. Retrieval remains deterministic and mock; Groq sees only the resulting
source previews and metadata. The client prevents duplicate start and purchase
actions while a request is pending. Server-authoritative state wins after every
mutation.

“New research” resets only the current client thread and returns focus to the
question surface. It does not claim to delete or rewrite persisted evidence.
Pause/resume and stop remain available in the research header while a run is
active. Premium previews never expose protected text before a verified purchase.
Usable open evidence may be synthesized without a purchase; an empty or
unsupported evidence set remains a limitation. During synthesis, the UI shows
the streamed Groq response as an intermediate draft. If Groq times out, returns
invalid JSON, or cites an unavailable source/span, the server uses the
deterministic fixture dossier only when it validates and labels it as a
fallback.

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
