# Public endpoints disagree on retained history; HTTP lacks browser CORS

**draft, not filed** — owner-only filing.

## Reproduce

From this checkout after `npm ci` (Node 22+):

```sh
node scripts/repro/07-endpoint-history.mjs
```

Pinned dependency: x402-xrpl 0.3.4 (lockfile). No wallet, signing, funding or submission.
Read-only public Testnet tx lookups; availability can change.

## Finding, workaround and proposed change


- Date / class: 2026-11-04; observed read-only Testnet; historical HTTP attempt and fresh WebSocket verification.
- Evidence: [13/13 live verification](../../evidence/round2-p1/live-validation.json), original [HTTP attempt](../../evidence/round2-e/rpc-attempt.json).
- Workaround: s.altnet WebSocket, then Clio; retain committed evidence during outages.
- Suggested fix: document endpoint retention, browser transport support and recommended archival lookup URL.
- Severity: Medium; unavailable history must not be presented as failed settlement.
- Mainnet consequence: analogous availability risk only; no mainnet measurement.

## Scope

No mainnet incident claimed. Please document or provide conformance coverage for this boundary.
