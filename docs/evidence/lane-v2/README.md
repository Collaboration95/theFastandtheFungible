# Lane V2 · Reachability and first impression

4 November 2026. Base e4c25a06 (#366), local macOS, Node 26.3.1, installed dependencies. Public XRP Testnet only, no real value. Fixture providers and fictional writers. No .env or cloud resources; seeds remain in ignored scratch with mode 0600.

Three fresh-wallet local UI launches reached XRPL Testnet-ready in 52.765, 54.073 and 55.431 seconds. Each completed UC3 with two purchase receipts and no simulated fallback (reason class: none). See cold-launches.jsonl.

A separate clean temporary clone, with this lane's patch applied and fresh npm ci, ran `make testnet ARGS=--capture` three times, renaming the private wallet cache between runs. First validated purchase hashes arrived at 76.448, 77.810 and 71.768 seconds; capture completed at 85.982, 88.089 and 81.407 seconds. Each required validated purchase → refund → re-buy. Reason class: none for all three. See cold-captures.jsonl for hashes. Measurements include faucet, seven sequential funding transactions and startup, but exclude npm installation. They are local timings, not Codespaces measurements.

## Codespaces

Second config: .devcontainer/testnet/devcontainer.json; npm ci, make testnet, forwarded 6900. Exact computed forwarded host and HTTPS origin are retained by the launcher, without wildcard authority. JSON validates against devcontainers/spec base schema and VS Code's devcontainer extension schema, retrieved with authenticated gh. Ajv 2019 for the base and draft-07 for VS Code; unused editor settings/MCP/launch references registered as empty schemas (this config has no editor customizations). Local clean-clone startup/capture passes. **Not run in a real Codespace**: image build, real forwarding and browser auto-open require the #265 smoke test.

## UI and recordings

Net S$0.40, paid S$0.70, refunded S$0.30, S$1.30 gross budget left; refunds never restore spending authority. Sources/header count kept and refunded; both purchase hashes link to the Testnet explorer. README GIF is rendered from the default Testnet UC3 replay with scripts/readme-media.mjs and visually inspected. The historical UC3 Testnet replay removes one unrelated BoJ free-draft claim; its provenance records the original byte hash and display transformation. No new claims, grants, payments, hashes or final answer are introduced. No key-reveal tab or engine memory code is changed.

## Verification

- npm run check:fast: 1,210 tests in 141 files; 20 chaos iterations and four escrow probes, zero invariant violations.
- npm run hygiene: pass.
- Playwright browser config: 18/18; demo config: 1/1, with exact budget/count/purchase-link assertions.
- python3 -m pytest packages/sdk-python: 222/222.
- make release-artifacts: five artifacts and all clean consumers, including standalone npx MCP.
- MCP stdio missing-budget hint checked before any ask admission; existing zero-cap and policy clamp assertions remain.

Browser text assertions change from `1 bought` to `1 kept · 0 refunded`. The visible mode-label count is exactly three because #366 added `not anchored (simulated)` alongside the environment and refund labels. This is an explicit expected-label correction, not a policy, leak, coverage or timeout relaxation. An initial concurrent browser/release build collided in dist; sequential reruns pass.

Registries remain unpublished. Version-tagged release admission is separate: a v1.0.0-rc.1 release requires matching package versions and same-SHA main CI; this lane does not invent release URLs. Needs-human work remains in #265.

Hosted initial-head browser run exposed an environment-popover remount/focus race (Ask intercepted). Auto-opening now also requires body focus, so a focused preset/question survives component remount before pointer tracking attaches. Explicit disclosure remains available. A regression covers focused-before-mount; no browser force-click, timeout increase or assertion removal. Read-only current ledger lookup independently found 21/21 validated tesSUCCESS; answer-anchor verifier returned PASS at ledger 22048303.

Final integration rebased onto c50276de (#368). Both SFF progress lines retained. Timed Testnet measurements above were taken before this engine nursery integration; no timing improvement is attributed to it.

Final V1 integration: rebased onto 0927dd9b (#369), preserving both builder-feedback and SFF lines. Current ledger data now has 25 rows: independent lookup confirms 25/25 validated tesSUCCESS (live-ledger-v1.json), and all five updated ledger Playwright checks pass. The earlier optional 20-vs-21 fixture drift is resolved by V1.
