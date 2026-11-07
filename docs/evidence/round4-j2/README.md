# Round 4 J2: one-shot judge path and portable runtime

Measured 2026-11-07 on macOS, Node 26.3.1. Testnet only, faucet XRP has no real
value; fixture models and fictional writers. No release, tag or version change.

| Fresh npm cache | Before (round-4 report, rc.2) | After (local packed candidate) | Target |
| --- | ---: | ---: | ---: |
| stdio initialize | 56.5 s | 6.293 s | ≤15 s |
| app --testnet ready | 134 s | 26.977 s | ≤60 s |
| try --testnet + ledger verification | unavailable | 87.149 s | ≤90 s |
| MCP tgz | 21,438,173 bytes | 3,417,974 bytes | ≤8,000,000 bytes |

Before timings are the independently observed round-4 measurements in
`notes/review-nov7/07-mock-judges-r4.md` (outside the repository), not a new
baseline timing. Before size was checked by downloading the exact rc.2 asset
with `gh release download`. After timings include installation from local packed
bytes into separate empty npm caches. This measures installation, not GitHub
asset transfer latency. App and try used fresh wallet directories. stdio
initialization does not wait for background provisioning.

`cold-timings.json` records size and boot measurements. `try-timing.json` records
the cold acceptance invocation (`RA_ACCEPT_TESTNET=1 node --import tsx
scripts/testnet-try-consumer.ts`). `try-output.txt` contains all six real Testnet
transaction URLs and the bundled TypeScript `--ledger` verification, including
12/12 Testnet checks. The refund is writer-signed and cooperative; a real writer
could refuse. The quoted cold run predates the PR commit; the manifest source
SHA is its base, not a claim that committed base contains these changes.

`release-consumers.json` records the clean SDK, wheel, sdist, MCPB, MCP tgz and
app consumer acceptance. `python-verifier.txt` is the compact Python verifier on
the README UC3 evidence: four lines, ending in RESULT PASS. The fallback test
injects faucet_unavailable and runs a real simulated engine with receipt
verification; it does not count as live acceptance.

No tests, thresholds, timeouts or spending gates were loosened. Anchor crash
fixtures now include receipt evidence because no-purchase runs intentionally
skip the anchor. Playwright is absent from the portable package; report rendering
uses its existing HTML fallback if browser tooling is unavailable. The stdio
entry never reads UI assets. The bundled UI remains available for `app`.

A later strict 90 s cold retry timed out (90.170 s, killed by the unchanged
consumer deadline). Its evidence is preserved in try-timeout.json and
try-timeout-output.txt; several local check suites were running concurrently,
but the exact cause was not established. The first successful cold run is
retained separately in try-initial-output.txt and try-initial-timing.json.
node22-verifier.txt verifies the README evidence with the actual bundled verifier
on Node 22.13.0, including all 12 Testnet checks. Final init/app measurements
were repeated after rebasing onto the character/UI assets.

Final cold retry passed at 87.149 s on the final packed runtime (3.418 MB). The 90 s limit remained unchanged. The runtime now uses a stable judge intent key; repeat invocations reuse the run instead of buying again.

An additional exact-head retry at e30d9711 also exceeded the unchanged 90 s cold
deadline: the child later printed PASS at 86.6 s runtime, excluding installation.
try-exact-timeout-output.txt and try-exact-timeout.json preserve that miss.
The verifier follow-up shares validated transaction reads and runs independent
payment/escrow verification concurrently; every proof check still runs.
