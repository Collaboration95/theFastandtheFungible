# Lane C1 — engine BYOK, cooperative Stop and active-work cap

> What this proves: Lane C1 — engine BYOK, cooperative Stop and active-work cap.
> Scope: Synthetic providers and simulated payments.
> Limits: This packet alone does not establish mainnet readiness or human acceptance.

Local synthetic evidence, 4 November 2026. Base includes merged #345
(`21b2a1ed`). Fake providers on ephemeral loopback ports, synthetic credentials,
fixture publishers, simulated payments only. No live providers, Testnet, real
money, cloud resources, signing or desktop execution.

- `byok-matrix.json`: actual HTTP, TS SDK, Python SDK and MCP tool calls against
  the same engine produce cited, correctly labelled compatible answers. The
  connection test reports synthetic 1,000 input + 500 output tokens at $2/$4 per
  million = $0.004; absent rates produce null. No generic judge buys.
- `stop-latency.json`: stalled streaming response measured with the old caller
  behavior (omitting its AbortSignal), then a real RunLoop Stop with cancellation.
  Baseline uses a deliberately shortened 150 ms per-attempt deadline, two
  attempts; it is **not** a production before measurement. The after measurement
  uses a 5 s deadline and must finish below 1 s, with zero calls to the purchase
  boundary. Additional tests cancel uncooperative Clef/Luna transport and Clef
  account discovery. Existing MCP/purchase/escrow gates preserve ambiguous signed
  reservations and recovery; no ledger signatures were made by this fixture.
- `cap.json`: 100 concurrent HTTP asks against stalled planning: 4 admitted, 96
  typed 503 `overloaded`, peak four. Four identical retries return their durable
  runs at saturation. Signed-obligation reconcile remains callable while full;
  drain releases all four slots. Existing blocked-writer regression remains.
- `tests/byok-security.test.ts`: reviewed DNS names resolving to private,
  shared or metadata addresses fail before the socket; redirect tests make zero
  requests to the target. Maximum confidence, Luna model-name spoofing,
  calibration enabled and threshold zero do not permit a generic buy.

Reproduce from repository root:

```sh
C1_EVIDENCE=1 npx vitest run tests/byok.test.ts tests/byok-security.test.ts tests/stop-propagation.test.ts tests/active-work-cap.test.ts
npm run check:fast
python3 -m pytest packages/sdk-python
```

Set `C1_EVIDENCE=1` to refresh the JSON measurements. Timing varies with host load.
All existing money/citation/leak assertions are preserved. The route inventory
adds the new POST endpoint. The scenario Stop test now waits for a cancellation
completion event instead of requiring an obsolete completed judgment after Stop;
it still asserts zero intents/spend/reservations/grants and a preserved answer.
The chaos cap case now accepts only typed overload refusals and retries those
same keys after capacity frees; all six clamp assertions remain.

Compatibility boundaries: reviewed public HTTPS origins plus explicit numeric
loopback, IPv4 public DNS only; generic decisions advisory with no purchases or
semantic coverage capability; desktop/recovery and convenience launchers remain
with their owning lanes. There is no real-provider or installed-Mac acceptance
claim. Provider fees are estimates only when usage/rates exist, not bounded by
article principal authority.
