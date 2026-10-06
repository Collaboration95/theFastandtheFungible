# ResearchAgent documentation

This is the single index for active product documentation. Historical audits,
event notes, orchestration prompts, and duplicate backlogs are intentionally
not part of the maintained documentation set; Git history preserves them.

## Start here

- [FINAL-PUSH.md](../FINAL-PUSH.md) is the product source of truth: the 6 Oct
  pivot, decisions D1–D14, demo use cases UC1–UC3 and open items O1–O5. It
  overrides `prompt.md` wherever the two conflict.
- [prompt.md](../prompt.md) holds the five hard gates, the worker protocol and
  the schedule.
- [AGENTS.md](../AGENTS.md) holds the standing agent rules.
- [Repository overview and setup](../README.md)

`docs/archive/` holds the replaced 4 Oct direction (old prompt, plans and
company context). It is history only. Do not use it as guidance.

## Reference

- [x402 and XRPL](x402-xrpl.md): protocol headers, validation before signing,
  finality, wallet safety.
- [Team manifesto and planned features](DEMO-MANIFESTO.md)
- [Presentation readiness](PRESENTATION-READINESS.md): event logistics, the
  five-minute script, likely questions, rehearsal matrix.
- [Publisher deployment](publisher-deploy.md)
- [UX walkthrough](ux-walkthrough/index.html): owned by the UX session. It
  still shows the v1 Vertex mock.
- [Build log](../talk/build-log.md): raw material for the talk.

## Active contracts

- [Product](contracts/PRODUCT.md): what we promise, to whom, and the demo use
  cases.
- [Architecture](contracts/ARCHITECTURE.md): v1 as built, and the target.
- [Design](contracts/DESIGN.md): visual system, layout, and content rules.
- [Security](contracts/SECURITY.md): secrets, access, settlement, manifests and
  refunds.

Contracts describe durable behavior and identify current implementation limits.
FINAL-PUSH.md states direction and decisions; `prompt.md` owns gates and
workflow. A plan or brief is not proof of implementation.

## Maintenance rule

Update an existing active document instead of adding a dated audit, handoff,
prompt, or status ledger. Keep transient verification output in the pull
request or task record. Add a new document only when it has a distinct durable
owner and audience.
