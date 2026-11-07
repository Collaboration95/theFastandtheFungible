# Packaged app acceptance

Read-only mounted unsigned arm64 DMG, fresh isolated app data and disposable
Keychain service. Fixture models, synthetic corpus and SIMULATED payments only.
The utility engine was killed after durable signing; restart recovered the same
submission with exactly one receipt and grant. No live purchase or owner Keychain
acceptance is claimed. Developer ID signing remains owner work.

Command: `node --import tsx desktop/accept.mjs --fixture-only`

```json
{
  "sha256": "1cf1d9d093e0f644fffe90e92b137dbd89ffe8b4a416f481ddd19ca254f22a39",
  "at": "2026-11-07T04:21:24.219Z",
  "executablePath": "/var/folders/g8/5_hq0kbs4499lmjhph03mvgc0000gn/T/ra-dmg-28uxXN/ResearchAgent.app/Contents/MacOS/ResearchAgent",
  "dmg": "/Users/speedpowermac/.t3/worktrees/tftf/t3-d2842e3e/desktop/out/ResearchAgent-1.0.0-rc.2-arm64.dmg",
  "bytes": 136733162,
  "results": [
    {
      "live": false,
      "data": "/var/folders/g8/5_hq0kbs4499lmjhph03mvgc0000gn/T/ra-accept-pHxwdU",
      "coldStartMs": 18934,
      "arch": "arm64",
      "runId": "3cc9cd7d-eb78-4fca-a9fe-d24bc211c3e7",
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
