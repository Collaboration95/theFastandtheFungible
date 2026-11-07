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

Integration follow-up: the reserved `mcp/app.ts` proxy currently strips browser
metadata and CSRF headers. It must forward Origin, Sec-Fetch-Site,
X-Settings-UI and X-Settings-CSRF only after its existing local Host/Origin checks,
and retain its local Host/Origin checks. RA_WEB_ORIGIN can pin the UI origin. Until then the
zero-clone app correctly refuses owner Settings operations with HTTP 403.
No mcp files or IOU payment paths were changed in this lane.

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
region is focusable. The axe rule was retained. The optional MCP-lane handoff is
an unapplied patch, verified with `git apply --check`; it does not modify the
reserved checkout files.
