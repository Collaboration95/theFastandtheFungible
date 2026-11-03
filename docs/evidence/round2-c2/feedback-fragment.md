# C2 feedback fragment — 4 November 2026

- Observed tooling: clean `npm ci` reported 39 dependency advisories (3 low,
  28 moderate, 6 high, 2 critical). Evidence: C2 clean install, baseline
  `21b2a1e`; no audit repair attempted in the desktop-owned lane. Workaround:
  fixture-only local verification. Suggested fix: dependency owner triages the
  production dependency graph separately. Severity: dependency audit actionable;
  exploitability not assessed. Mainnet impact: not measured; no mainnet calls.
- Code-derived SDK surface gap: TS SDK exposes wallet status, but no operator
  pause setter. Desktop acceptance therefore sets pause through the existing
  bearer-protected operator endpoint, then verifies durable state through the
  same SDK wallet reader used by Settings across engine restart and app relaunch.
  Suggested fix: SDK owner decides whether to expose an explicit pause control.
  Severity: low API reachability gap; no loss of durable pause. Mainnet impact:
  none tested. Evidence: `sdk/index.ts`, `desktop/recovery-smoke.mjs`.
- Code-derived release integration: unsigned is now the default regardless of
  installed identities. Lane D's owner signing workflow must explicitly pass
  `--sign` and `CSC_NAME`; C2 does not edit workflow-owned files. Owner signing
  remains untested. Severity: low integration requirement; no rail impact.
