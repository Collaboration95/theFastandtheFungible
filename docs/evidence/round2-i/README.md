# Lane I — agent kill switch (2026-11-04)

Local synthetic-provider and simulated-settlement evidence only. No live provider,
Testnet submission, real money or desktop acceptance is claimed.

API: POST /api/spending/pause accepts only an optional reason (240 characters,
no control characters). Identity comes from authentication, never the payload.
TS client.pause({reason}), Python client.pause(reason=...), and MCP pause_spending
return {paused: true, scope: agent|wallet, agentId?: string}. There is no resume
on these surfaces. Operator POST /api/wallet/pause retains explicit resume.

An agent bearer affects only itself; the operator bearer affects the wallet.
Anonymous callers and invalid/revoked credentials cannot pause. Paused agent
credentials can repeat pause and inspect their status; research remains blocked.
MCP transport authenticates paused credentials so repeat pause works; engine
admission remains the spending authority. No cap or spending gate is relaxed.

State and the pause audit entry commit atomically to SQLite. Existing purchase
reservation/CAS/sign checks apply to in-flight work. Agent pause now also gates
policy fee signing. Signed obligations keep their reservation and reconcile
through the existing path; pause never deletes payment state. Desktop preferences
are untouched and cannot invoke this route to resume.

Verification:
- npm run check:fast: lint, types, unit/integration suite and chaos smoke.
- python3 -m pytest packages/sdk-python: 19 passing tests.
- tests/agent-keys.test.ts: TS pause scope, repeat, reason bound, other-agent
  targeting rejected, resume refused, already admitted purchase skipped with
  zero content/grants, fee signing refusal, reopened SQLite state and audit.
  Existing signed/revoke coverage verifies once-only settlement and signing CAS.
- tests/mcp-http.test.ts: real HTTP MCP pause and repeat; subsequent ask refused.
- packages/sdk-python/tests/test_client.py: Python pause and repeat; subsequent
  ask has zero budget, no receipts and the paused clamp reason.

All listeners use ephemeral ports. No tests, thresholds or hard gates loosened.
