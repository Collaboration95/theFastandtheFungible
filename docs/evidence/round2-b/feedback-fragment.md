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

- Class: observed cross-runtime verification incident, 2026-11-04.
- Evidence: PR run 41691867205 coverage-summary artifact; App.tsx branch
  denominator 237 on hosted Node 22 versus 235 on local Node 26, and
  EnvIndicator.tsx 25 versus 23. Required check correctly refused the ratio drop.
- Workaround: verify with Node 22 locally; add private-mode/unconnected
  environment-label cases, preserving every existing floor.
- Suggested fix: record runtime versions beside V8 denominators and retain
  coverage-summary artifacts for failed admission.
- Severity: low (verification portability).
- Mainnet impact: none observed; offline fixture checks only.
