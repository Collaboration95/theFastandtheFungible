# G1-TEL: paid passage release telemetry

12 November 2026. Local integration proof with fictional writers, fixture models and simulated settlement. No hosted question, cloud operation, live model call or real money. The escrow tests use a deterministic ledger simulation, not public Testnet evidence.

## Change

`Store.getRun` is the shared boundary that releases paid passage bytes to research and snapshots. Its existing database join requires a stored grant; its existing filter requires a VERIFIED intent and (for escrow) RELEASED state. Only then does it append an explicit `grant` event, followed by one `read_paid` per passage, inside the same SQLite transaction before returning any content. Ordering is structurally guaranteed. An audit-write failure throws and rolls back both grant/read events; the regression test proves no bytes return on that failure.

Every read contains the run ID, intent ID, passage ID and SHA-256 of the exact UTF-8 passage text. No passage text, key or salt is written to these audit events. Existing immutable content and durable run/intent/passage IDs prevent duplicate reads across snapshots, exports and database reopen.

The hosted Verify panel and receipt download both fetch `/runs/:id/receipts.json`. The production `reportsRouter` GET `/runs/:id/receipts.json` is exercised over an ephemeral local port. It uses the same `receiptBundle` path as hosted; this already exports all run events in the pinned hash chain, so no export or schema change was necessary. A test pins the chain after release and confirms subsequent exports retain every read without including later unrelated entries. No historical fixture or hosted/UC3 export was regenerated; their gate 1 remains Not checked.

## Published v1.1.1 compatibility

Downloaded using authenticated `gh release download v1.1.1 --repo Collaboration95/theFastandtheFungible`:

- `researchagent-sdk-1.1.1.tgz`: SHA-256 `58efeb4ffca5463fb65d50aa05ec751868ea4eb4449dcdd741d1e0e1965140c9`.
- `researchagent-1.1.1-py3-none-any.whl`: SHA-256 `c05f2ced74900dff4b40b75a259d1720148a2864c85c7ae71f1feae767e063c7`.

Both published verifiers PASS a freshly generated paid-run bundle containing four `read_paid` events, exported over the real receipt route. No verifier semantics changed. The test normally runs the repository TS/Python verifiers; release acceptance redirects the same test to the extracted published artifacts:

```sh
PATH=$HOME/.local/share/mise/installs/node/22.23.4/bin:$PATH \
G1_TEL_TS_VERIFIER=/tmp/g1-tel-v1.1.1/package/dist/sdk/verify.js \
G1_TEL_PYTHON_PATH=/tmp/g1-tel-v1.1.1/python \
npx vitest run tests/paid-read-audit.test.ts
```

SDK dependencies must be available to the extracted tarball (the acceptance run symlinked its node_modules to this checkout's installed dependencies). The wheel needs no installation; `PYTHONPATH` points to its extracted root.

## Fresh gate 1 output

```json
{"id":1,"title":"No premium bytes before a grant","status":"Held","seqs":[7,8,9,10,11,12,13],"detail":"Recorded paid reads follow their grants."}
```

In this fresh integration run: delivery seq 7, proof seq 8, grant seq 9, passage reads seqs 10–13. The key-reveal regression separately proves that the explicit grant and every read follow the validated finish; no reads are recorded while the writer is absent or a proof has failed. Reopening the database and retries preserve the same events.

## Verification

- Targeted tests: 55 passed across paid-read audit, key reveal, escrow, proof quarantine and browser gate summary suites.
- Typecheck: passed.
- `npm run check:fast`: passed; 2,992 tests passed, three opt-in skips; hygiene, paid-body check, lint, typecheck and chaos smoke passed.
- Node 22.23.4 production build: initial JS **158,315 B gzip**, below the lane limit of 160,000 B; no initial browser code changed.
- Full local gate: all 16 steps passed, including app browser, performance, hosted browser, Python and desktop build smoke. Clean-head publication and merged-SHA admission are recorded in the PR/statuses.
- Nothing loosened. No UI, release script, version, CHANGELOG, Makefile, hosted export or deck changes.
