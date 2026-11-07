# Packaged app acceptance

Unsigned arm64 DMG built after the #385 rebase and native menu callback fix,
mounted read-only. Fresh isolated app data and disposable test Keychain service.
Fixture models, synthetic corpus and SIMULATED payments only. After durable
signing the engine was killed; recovery reused the same submission with exactly
one receipt/grant and replay did not charge again. No live purchase or signing.

Command: `node --import tsx desktop/accept.mjs --fixture-only`

```json
{
  "sha256": "3503f9520f5676580aa266ddfb930b04c8564c9736d652a1aca46e1543546fdd",
  "at": "2026-11-07T04:30:21.883Z",
  "executablePath": "/var/folders/g8/5_hq0kbs4499lmjhph03mvgc0000gn/T/ra-dmg-C9HBA0/ResearchAgent.app/Contents/MacOS/ResearchAgent",
  "dmg": "/Users/speedpowermac/.t3/worktrees/tftf/t3-d2842e3e/desktop/out/ResearchAgent-1.0.0-rc.2-arm64.dmg",
  "bytes": 136737701,
  "results": [
    {
      "live": false,
      "data": "/var/folders/g8/5_hq0kbs4499lmjhph03mvgc0000gn/T/ra-accept-ZI8ze6",
      "coldStartMs": 6845,
      "arch": "arm64",
      "runId": "580c9126-74b0-4080-a03e-2d162cc7be0a",
      "spentMinor": 90,
      "labels": {
        "research": "fixture · extractive-fixture",
        "decision": "fixture · metadata-fixture",
        "publisher": "local",
        "settlement": "SIMULATED SGD · no real funds",
        "search": "keyword only (embeddings unavailable)",
        "plan": "fixture · scope-fixture"
      },
      "crashRecovered": true,
      "sameSubmission": true
    }
  ]
}
```
