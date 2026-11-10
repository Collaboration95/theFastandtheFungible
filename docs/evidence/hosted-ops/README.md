# HO local evidence — 10 November 2026

This is **local native fixture/simulated evidence**, not Docker-image, cloud,
live-provider, funded-wallet or XRPL Testnet acceptance.

- Production Vite build and existing esbuild API/publisher bundles: passed.
- Docker CLI 28/Compose v2 available; daemon refused connection. No container
  image was built or run. Compose base/fallback models validated with a public
  empty env file (`HOSTED_ENV_FILE=/dev/null`); no secrets supplied.
- Native equivalent: production web nginx :6800, guarded API :10488 (raw
  loopback :10489), publisher :10490, real front nginx :6801, HOSTED=1,
  fixture models and simulated rail; all owned listeners stopped afterwards.
- `node docker/hosted/prove-local.mjs`: passed paused-shell smoke and independent
  proxy probes. Dated sanitized results are attached below. Test-only proxy
  :6802/:6803 selects the last address from a forged-prefix XFF list, strips
  Authorization/arbitrary internal headers/principal, streams SSE before the
  terminal chunk, and returns static HTTP 503 when its backend is stopped.
- `npx vitest run tests/hosted-ops.test.ts`: 4/4 passed, resource check clean.
  Verifies dry-run never invokes gcloud (a failing executable is inserted into
  PATH), secret sentinels never appear, topology/firewall/snapshot ordering,
  private atomic pause state and expired resume rejection.
- Shell syntax, JavaScript syntax, targeted ESLint (zero errors; sanitized-error
  cause warnings), TypeScript and compose configuration: passed.

HG was absent from the tested application source. The raw API returned 404 for
`/api/demo/status`; the guard returned a bounded paused status, readiness 503
and rejected Ask. This deliberately blocks the otherwise local-owner API.
**Two-session creation/isolation and own-question purchase/receipt checks could
not run**. The smoke marks those BLOCKED, not passed. HG integration and actual
env/session/HMAC names must be qualified before any launch. The standalone
publisher K_SERVICE refusal remains unchanged.

Unverified: Linux image builds/runtime permissions, actual gcloud execution,
project/IAM/billing/quotas, VM disk/snapshot/restart recovery, Direct VPC egress,
Cloud Run canonical origin and verified IP chain, alert delivery, live provider
preflight, Testnet funding/create/finish/anchor/explorer checks, Caddy TLS/DNS and
served UI accessibility. The orchestrator owns these checks and all cloud
mutations. No test, threshold or gate was loosened.

Reproduce in a native environment with nginx:

```bash
npx vite build
node docker/bundle.mjs scratch/hosted-local/dist
node docker/hosted/prove-local.mjs
npx vitest run tests/hosted-ops.test.ts
```

Initial local checks exposed an unscoped test temp directory, an API startup
race and nginx regex quoting that fell back to the proxy address. These were
fixed; the final native run verifies last-hop extraction and resource cleanup.
No earlier failed check is being counted as acceptance.
