# Shared Settings evidence

1280×800 Playwright Chromium screenshots, fixture engine, synthetic writers,
SIMULATED settlement. No live provider, faucet, Keychain, installed DMG or signed
artifact acceptance is claimed. `npm run build && npx playwright test --config playwright.settings.config.ts`
checks all nine sections with axe (no serious/critical violations) and captures
onboarding. `tests/owner-settings.test.ts` checks browser metadata, CSRF, masking,
invalid input, audit entries and deferred configuration loading.

The desktop Settings menu opens the same React page. Provider credentials use
Keychain on desktop. Local browser saves update the existing launcher environment file with mode
0600 and require restart. Hermetic zero-clone launchers without an existing
environment file require credentials in their launcher environment.
Non-secret settings are also applied at restart; no active run gains authority.
Reset means reset preferences: payment journals, seeds and receipts are preserved.

Zero-clone integration completed (2026-11-07): `mcp/app.ts` retains its local
Host/Origin guard and forwards only Origin, Sec-Fetch-Site, X-Settings-UI and
X-Settings-CSRF on `/api/settings*` through a named helper. The launcher binds an
ephemeral port before engine startup and pins engine admission to that origin.
The applied handoff patch has been deleted. Proxy integration tests prove masked
keys, an audited cap save, rejected cross-origin/metadata-free/CSRF-free cap,
credential and network changes, and header isolation from other routes.

`zero-clone-proof.json` and `zero-clone-*.png`: packed MCP tgz launched with
`npx -y file:<absolute-tgz> app --testnet` from an empty temporary directory.
Fixture models, fictional writers, actual XRPL Testnet rail; a synthetic provider
key was masked, cap changed from 0 to 125, and the durable human audit exported.
No research or purchase was initiated. MCP policy's zero default is unchanged.

`desktop-dmg-acceptance.md`: unsigned arm64 DMG mounted read-only, fixture crash
recovery retained the signed submission and exactly one receipt/grant.
`desktop-smoke.json`: packaged UC1–UC3, free answer, paid grant, refund, isolation,
Host/Origin rejection and clean shutdown passed. `desktop-settings-proof.json`
and desktop screenshots: first-run onboarding, Cmd+, Settings menu accelerator,
confirmation persistence and 1100×760 bounds across relaunch passed.
Fixture mode now explicitly uses simulated payment instead of requesting Testnet
escrow; live mode retains selected escrow. The smoke checks the current exact
budget wording and closes verified first-run onboarding before testing menu reopen.
No assertions, timeouts, thresholds or hard gates were loosened.

Native recovery IPC and update checks remain available without engine startup.
Developer ID signing remains owner work; ci-signing.mjs and desktop.yml unchanged.

Shared-host diagnostics: the first default-three-worker `check:fast` attempt
hit existing 5 s timeouts in verify-answer (four cases) and audit CLI cases
(three), plus other CLI tests. It was stopped after failures were established.
A new run uses `RA_TEST_WORKERS=1`; default concurrency remains three. No test,
assertion, timeout, spending gate or leak threshold was relaxed. A later combined
build/browser run hit the unchanged 45 s server-start limit; an explicit build
followed by the dedicated settings config avoids charging compile time to that
limit. These are tooling observations, not evidence of ledger/provider failures.

The final accessibility pass exposed a keyboard-inaccessible overflow region in
the writer data view. Wallets and writers now use labelled tables; the command
region is focusable. The axe rule was retained. The MCP handoff is now applied and covered by proxy integration tests.

Verified local results (2026-11-07): default `npm run check:fast` passed all
153 files / 1,284 tests and 20 chaos iterations with zero invariant violations
on code commit `491345c1`. Production build and the final screenshot/axe run
passed. The subsequent native smoke/recovery harness selector migration retains
its existing assertions/timeouts; installed-artifact acceptance was not run.

Final integration refresh: rebased over #385 with AgentSprite import and loading
state retained. `npm run check:fast` passed 155 files / 1,297 tests and 20 chaos
iterations with zero invariant violations. The native menu callback now discards
Electron's MenuItem argument, so normal Settings no longer shows onboarding.
Refreshed unsigned DMG fixture recovery and packaged smoke passed; native proof
checks normal Settings after confirmed onboarding and relaunch explicitly.
Earlier shared-host retries included an unchanged key-reveal refund failure,
fact-menu and release fixture 5 s timeouts. The subsequent default gate passed unchanged. Native runs that shared
the standard desktop MCP port conflicted; sequential native checks passed.
