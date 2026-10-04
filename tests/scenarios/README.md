# October demo process scenarios

Run `npx vitest run tests/scenarios` from the repository root. The suite starts
separate API and publisher processes with fresh SQLite files, OS-assigned
ports, the synthetic corpus, and fixture providers. It does not launch a
browser or call external providers. `check:fast` includes these tests.

The default API entry is `server/index.ts`. While integration is on another
checkout, `SCENARIO_API_ENTRY` can select that checkout's entry file, and
`SCENARIO_API_ROUTES` can select its routes file for the injected-factory tests.
The latter defaults to `server/routes.ts`. Neither override is needed after
integration merges.

SC-01 through SC-06 exercise the canonical purchase, sufficient free evidence,
zero budget, rewrite/cap policy, injection, and contradiction. The Stop test
holds mocked Clef scoring long enough to stop before purchase. The leak test
uses the real Clef adapter with an injected fetch and the real Groq client
against a local streaming server. Groq returns an invalid answer intentionally
so the application must label its extractive fixture fallback.

Every observed raw API response and SSE frame is scanned for ungranted paid
spans and canaries. Clef and Groq payloads are captured with the current run's
grants at the instant each request starts. A second zero-budget run in the same
processes verifies that the first run's grant cannot authorize its evidence.
Each paid body receives a distinct canary; existing corpus canaries are scanned
too. Independent public repetitions of paid spans are allowed. Negative oracle
tests plant leaks and wrong-run/version grants to verify that detection works.

The optional `unchanged` scenario is skipped with a TODO: current research
impact classification returns `STRENGTHENS` for its repetitive paid evidence.
That fix belongs to the research package, outside this package's write scope.
PDF/browser checks belong to the orchestrator's serial integration verification.
