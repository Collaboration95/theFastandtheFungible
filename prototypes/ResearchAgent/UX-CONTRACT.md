# ResearchAgent UX contract

## Workflow

The primary guided operation is `Run research`. It advances the same persisted
backend state used by manual controls: Brief → Discover → Read open evidence →
Find gaps → Allocate budget → Synthesize → Dossier. Candidate actions are
server-authoritative: Buy Northstar, skip Circuit Note, buy Meridian, and
record GridScope's deterministic budget block. Reset creates a fresh fixture
state under the same run identity; completed external or recorded evidence is
never rewritten. Pause/resume and cancel preserve verified purchases.

## Canonical owners

| Capability | Owner | Contract |
| --- | --- | --- |
| Visual tokens | `src/styles.css` | semantic variables only |
| Evidence lineage | `TraceRibbon` | labels + source selection |
| Candidate action | `SourceRow` + API | pessimistic persisted mutation |
| Evidence inspection | `EvidenceDrawer` | focus, Escape, backdrop, exact spans |
| Budget | server `purchases` route | integer cents, mandate guard |
| Dossier | server `synthesize` + `dossier` | claims cite accessible spans |
| Status feedback | app live region + event footer | material changes only |

## Accessibility and resilience

Native buttons, fields, headings, and lists are used throughout. Focus is
visible, drawer close restores focus, the live region announces material state
changes, and reduced motion removes transitions. The question textarea is
owned by the application rather than native validation. Print preserves the
reading surface. If the API is unavailable the UI says so; it does not invent a
successful run or premium evidence.

## Evidence and language

Before purchase, premium sources expose metadata, preview, price, and terms
only. After a verified fixture purchase, exact synthetic evidence spans become
accessible. `OPEN`, `PREMIUM · PREVIEW ONLY`, `PREMIUM · UNLOCKED`, and
`FIXTURE PAYMENT · NOT A REAL PUBLISHER PAYMENT` are intentionally explicit.
