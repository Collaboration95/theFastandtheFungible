# Shared Settings evidence

1280×800 Playwright Chromium screenshots, fixture engine, synthetic writers,
SIMULATED settlement. No live provider, faucet, Keychain, installed DMG or signed
artifact acceptance is claimed. `npx playwright test tests/settings.spec.ts`
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
and configure RA_WEB_ORIGIN to its OS-assigned web origin. Until then the
zero-clone app correctly refuses owner Settings operations with HTTP 403.
No mcp files or IOU payment paths were changed in this lane.

Native recovery IPC and update checks remain available without engine startup.
Developer ID signing remains owner work; ci-signing.mjs and desktop.yml unchanged.
