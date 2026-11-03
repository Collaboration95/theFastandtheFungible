# C2 desktop recovery — 4 November 2026

Local native Apple Silicon acceptance, fixture-only. Engine/provider Lane C1,
real-provider calls, real Keychain incidents, Testnet and Apple signing are not
claimed. No production Keychain service was touched. No delegated implementation
or review was used.

## Results

- `npx vitest run tests/desktop.test.js tests/desktop-recovery.test.ts`:
  26 passing tests. Covers fresh/offline, three provider profiles, missing,
  deleted, locked, denied and corrupt credentials, remote token absence,
  structural configuration validation, transport outage/timeout, emergency
  pause, exact-account mutations and connection-test contract/null costs.
- Mocked native Keychain commands prove save, replace, delete, repeated delete,
  failed write and failed delete preserve the right presence state. These tests
  never execute security against any service.
- `node desktop/build.mjs --dmg --unsigned`: native arm64 success, no Developer ID
  discovery/signing or notarisation. Artifact identity is in `artifact.json`.
  The upstream executable retains Electron's linker ad-hoc signature; it has no
  team identity or sealed resources. This is an unsigned distribution artifact.
- Packaged smoke: 13 passing cases in `recovery.json`, including injected
  credential/configuration/outage/timeout recovery, actual ephemeral MCP port
  conflict, a fixture answer, explicit offline switch and durable pause after
  engine restart and app relaunch. Five API/publisher/MCP listener addresses were
  checked closed after quit. Settings responds during the injected five-second
  pending failure. Offline preserves a canary representing uncertain live work.
- `ipc-canaries.json`: all 13 privileged desktop methods reject the research/
  recovery renderer, tested on each launch; Settings state returns no bearer.
  Subframe/malformed sender refusal is additionally unit tested.
- `npm run check:fast`: local full fast gate passed before shipping; final gate
  is rerun after rebasing and adding the SFF merge-tail line. No hard-gate
  assertions or leak thresholds were loosened.

## Reproduce

```sh
node desktop/download.mjs
node desktop/build.mjs --dmg --unsigned
RA_DESKTOP_KEYCHAIN_SERVICE=ResearchAgent-Accept-c2 node desktop/smoke.mjs --fixture-only --recovery --app "$PWD/desktop/out/mac-arm64/ResearchAgent.app" --output "$PWD/docs/evidence/round2-c2/recovery.json"
npm run check:fast
```

The fault names in the native harness are deliberately injected before any
credential or remote-rail access. Native locked/denied/corrupt Keychain and remote
outage incidents are not reproduced on real services. The unit matrix separately
exercises the actual boot credential decision helper and native-command failures.
The MCP conflict and fixture engine/answer/restarts are actual local execution.
Screenshots are unedited small PNG captures: `settings.png`, `missing-key.png`,
`offline-answer.png`. The web UI's existing post-answer “Connection lost” banner
appears in the offline capture; fixing that web-state issue belongs to Lane D.

## Remaining boundaries

C1 supplies compatible inference/decision execution and `/api/providers/test`.
C2 tests that exact protocol with synthetic transport responses; a missing engine
endpoint shows “Engine unavailable”. C2 does not claim real BYOK success. The SDK
currently lacks a pause setter, so packaged acceptance pauses through the existing
operator endpoint and reads state through the SDK used by Settings. No cached
preference write can clear that durable state. Signing and workflow integration
remain with the owner/Lane D. See `feedback-fragment.md` for scoped observations.
