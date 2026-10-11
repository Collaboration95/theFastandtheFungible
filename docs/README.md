# ResearchAgent documentation

Start with the [README](../README.md) for setup and the demo, and the
[explainers site](https://collaboration95.github.io/theFastandtheFungible/) for
the walkthrough, slides and project map.

## Contracts (as built)

- [Product](contracts/PRODUCT.md): what we promise, to whom, and the demo use
  cases.
- [Architecture](contracts/ARCHITECTURE.md): the components and the shape of a
  run.
- [Design](contracts/DESIGN.md): visual system, layout and content rules.
- [Security](contracts/SECURITY.md): secrets, access, settlement, manifests and
  refunds.

## Reference

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
or status log. Keep transient verification output in the pull request.
