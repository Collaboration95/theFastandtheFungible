# ResearchAgent documentation

Start with the [README](../README.md) for setup and the demo, and the
[explainers site](https://collaboration95.github.io/theFastandtheFungible/) for
the walkthrough, slides and project map.

**Current push:** [SFF-PUSH.md](SFF-PUSH.md) tracks the SingHacks finals
deliverables and changelog; [JUDGING-CRITERIA.md](JUDGING-CRITERIA.md) has the
Ripple-track criteria.

## Contracts (as built)

- [Product](contracts/PRODUCT.md): what we promise, to whom, and the demo use
  cases.
- [Architecture](contracts/ARCHITECTURE.md): the components and the shape of a
  run. Its [Nov 2026 review](contracts/REVIEW-NOV-2026.md) ranks the seams
  for the SFF push (#285–#288).
- [Design](contracts/DESIGN.md): visual system, layout and content rules.
- [Security](contracts/SECURITY.md): secrets, access, settlement, manifests and
  refunds.

## Reference

- [Builder feedback](BUILDER-FEEDBACK.md): living implementation log, Top 5, mainnet checklist and September submissions.
- [MCP server](mcp.md): connect Claude Code or Codex, the four tools, caps and idempotency.
- [Running it](running.md): every make target, the demo keys, Docker.
- [x402 and XRPL](x402-xrpl.md): the v2 flow as built (headers, invoiceId,
  facilitator, refund), validation before signing, finality, wallet safety.
- [Design record](FINAL-PUSH.md): the October 2026 decisions D1–D24 and why.
- [Decision model report](../eval/REPORT-decisions.md) and
  [coverage report](../eval/REPORT-coverage.md): measured on the real corpus.
- [Publisher container](publisher-deploy.md): the standalone publisher image.
- [UX walkthrough](ux-walkthrough/index.html): the design walkthrough, with
  screenshots of the shipped UI.
- [Writer-site reference look](reference/).

## Maintenance rule

Update an existing document instead of adding a dated audit, handoff, prompt
or status log. The one exception is the changelog in SFF-PUSH.md. Keep transient verification output in the pull request.
