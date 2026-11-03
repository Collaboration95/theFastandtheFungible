# Tooling friction — 2026-11-04

- Class: observed local tooling incident.
- Evidence: baseline integration SHA ec97bfdfe38e61b1b1b3fed6a1b4d3546052927c;
  scripts/check-coverage.mjs rejected missing mcp/extension.mjs.
- Incident: TypeScript-only V8 include patterns omitted runtime .mjs files.
- Workaround: collect .mjs runtime paths and enumerate expected product files
  independently so omissions fail admission.
- Suggested fix: use explicit runtime-inclusive coverage and missing-file tests
  in verification templates.
- Severity: low (verification completeness).
- Mainnet impact: none observed; offline fixture verification only.

- Class: observed local tooling incident, 2026-11-04.
- Evidence: integration SHA above; concurrent local check:fast/coverage package
  builders collided on dist/ResearchAgent.mcpb (one mcp-bundle test failed).
- Workaround: run complete unit collections sequentially within one checkout;
  hosted jobs have separate checkouts and do not share dist.
- Suggested fix: isolate package output per invocation in future build tooling.
- Severity: low; local verification rerun required.
- Mainnet impact: none; no settlement or provider call involved.
