# ResearchAgent documentation

This is the single index for active product documentation. Historical audits,
event notes, orchestration prompts, and duplicate backlogs are intentionally
not part of the maintained documentation set; Git history preserves them.

## Start here

- [Repository overview and setup](../README.md)
- [Team manifesto and planned features](DEMO-MANIFESTO.md)
- [October 10 implementation tasks and acceptance](plans/october-10/README.md)
- [October 10 presentation readiness](PRESENTATION-READINESS.md)
- [October 10 product development plan](PRODUCT-ROADMAP-2026.md)
- [Agent development and verification harness](AGENT-DEVELOPMENT.md)
- [Next-stage UX brief](UX-NEXT-STAGE.md)
- [Company and protocol context](../company-research-context.md)

## Active contracts

- [Product](contracts/PRODUCT.md) — user, problem, canonical proof, and limits.
- [Architecture](contracts/ARCHITECTURE.md) — components, data flow, and trust
  boundaries.
- [Design](contracts/DESIGN.md) — visual system, layout, and content rules.
- [Security](contracts/SECURITY.md) — secrets, access, settlement, and evidence
  controls.
- [UX](contracts/UX-CONTRACT.md) — workflow, ownership, recovery, and
  accessibility.

Contracts describe durable behavior and identify current implementation limits.
The manifesto states team direction; the roadmap owns sprint scope and research;
the implementation index and module plans own issue contracts, dependencies and
acceptance. Their shared interfaces resolve October 10 changes to legacy behavior.
The readiness plan owns presentation work, the agent guide owns coding and repair
loops, and the UX brief supplies broader interaction context. A plan or brief is
not proof of implementation.

## Visual source material

- [Standalone architecture diagrams](../diagrams/README.md)
- [Editable official UX wireframes](../canvas/excalidraw/README.md)
- [Composite codebase map](../canvas/excalidraw/exports/codebase-map-split.svg)
- [Official product views](../canvas/excalidraw/exports/official-researchagent-views.svg)

Editable Excalidraw scenes are the source of truth. PNG and SVG files are review
exports; they are retained to support GitHub review and presentation prep.

## Maintenance rule

Update an existing active document instead of adding a dated audit, handoff,
prompt, or status ledger. Keep transient verification output in the pull
request or task record. Add a new document only when it has a distinct durable
owner and audience.
