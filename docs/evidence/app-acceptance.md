# Packaged Mac app acceptance — 3 November 2026

Both unsigned DMGs were built locally with OFFSET=1100 and mounted read-only.
Executables ran directly from those mounted distributions, with isolated user data
and a temporary ResearchAgent-Accept-* Keychain service. No owner entries were used.

Apple Silicon: full Settings IPC agent creation → Keychain bearer → MCP SDK HTTP
ask → fixture purchase; SIGKILL after durable signing and before delayed send →
automatic utility restart → same persisted signed submission → one receipt and
one grant. Replaying the same idempotency key returned the same run and one receipt.
The first attempt exposed an active-POST shutdown hang; closing connections before
listener shutdown fixed it and the rebuilt DMG passed.

Then exactly one real XRPL Testnet purchase, paid from the seed read through the
packaged app Keychain path. Independent ledger lookup returned validated tesSUCCESS;
its Account matched the .env seed imported into the isolated test Keychain. Amount
90,000 drops (0.09 XRP), fee 12 drops. Fictional corpus and fixture research/decisions;
no mainnet value or live provider calls. Temporary Keychain items were deleted.

Transaction: https://testnet.xrpl.org/transactions/A2B630B93E0BAC46D3EA4888E9F6E107715E81DF4B78DF4205CEE35378FEEA5A

| DMG | Bytes | MiB | Fresh process to visible UI |
|---|---:|---:|---:|
| arm64 | 136674506 | 130.34 | 4.645 s fixture; 0.814 s Testnet |
| x64 | 140779598 | 134.26 | 51.936 s under Rosetta |

One sample per reported launch, empty app data, filesystem cache not flushed.
x64 launch-only validation reached the research textbox and shut down; a prior
full x64 MCP attempt stalled and was terminated. No native Intel timing or full
x64 MCP/payment acceptance is claimed. Separate DMGs avoid sending both Chromium
architectures (264.60 MiB combined) to each user. Apple Silicon is the tested
payment platform. No signed/notarised or Gatekeeper acceptance is claimed.

Commands: `OFFSET=1100 make app-accept` builds before the full test; this run used
`OFFSET=1100 make dmg` then `OFFSET=1100 node --import tsx desktop/accept.mjs`.
Intel: `DESKTOP_ARCH=x64 OFFSET=1100 make dmg`, then
`DESKTOP_DMG=desktop/out/ResearchAgent-0.7.0-x64.dmg OFFSET=1100 node --import tsx desktop/accept.mjs --launch-only`.
The first fixture attempts failed before any Testnet payment. The successful
Testnet run was not repeated. Isolated journals remain at the paths below.

`OFFSET=1100 npm run check:fast`: 724 tests, 92 files; 20 chaos iterations,
zero double charges/invariant violations. `npm run readme:check` passed.
No gates loosened and sdk/ untouched. Signing and release notification code is
implemented but Apple notarisation and a newer-release GUI notification have not
been exercised. GitHub CLI must be available on the launched app PATH for checks.

## Full arm64 evidence

```json
{
  "at": "2026-11-03T05:19:22.522Z",
  "executablePath": "/var/folders/g8/5_hq0kbs4499lmjhph03mvgc0000gn/T/ra-dmg-5zK5AX/ResearchAgent.app/Contents/MacOS/ResearchAgent",
  "dmg": "/Users/speedpowermac/.t3/worktrees/tftf/t3-52df585a/desktop/out/ResearchAgent-0.7.0-arm64.dmg",
  "bytes": 136674506,
  "results": [
    {
      "live": false,
      "data": "/var/folders/g8/5_hq0kbs4499lmjhph03mvgc0000gn/T/ra-accept-mE4ZwC",
      "coldStartMs": 4645,
      "arch": "arm64",
      "runId": "bf2f06ae-068f-4b6e-afd6-5bc7f084c40c",
      "spentMinor": 90,
      "labels": {
        "research": "fixture \u00b7 extractive-fixture",
        "decision": "fixture \u00b7 metadata-fixture",
        "publisher": "local",
        "settlement": "SIMULATED SGD \u00b7 no real funds",
        "search": "keyword only (embeddings unavailable)",
        "plan": "fixture \u00b7 scope-fixture"
      },
      "crashRecovered": true,
      "sameSubmission": true
    },
    {
      "live": true,
      "data": "/var/folders/g8/5_hq0kbs4499lmjhph03mvgc0000gn/T/ra-accept-7LtbXL",
      "coldStartMs": 814,
      "arch": "arm64",
      "runId": "20e9090a-e78a-4340-9367-720176c11faf",
      "spentMinor": 90,
      "labels": {
        "research": "fixture \u00b7 extractive-fixture",
        "decision": "fixture \u00b7 metadata-fixture",
        "publisher": "local",
        "settlement": "XRPL TESTNET \u00b7 no real value",
        "search": "keyword only (embeddings unavailable)",
        "plan": "fixture \u00b7 scope-fixture"
      },
      "crashRecovered": false,
      "sameSubmission": false,
      "txHash": "A2B630B93E0BAC46D3EA4888E9F6E107715E81DF4B78DF4205CEE35378FEEA5A",
      "ledger": {
        "state": "validated",
        "tx": {
          "Account": "rwi1i3TJfZKmLWoAiNkXUBZmdWVGFxBNRQ",
          "DeliverMax": "90000",
          "Destination": "rDibQptnbQvQTfUCFXdDFLEaKG293UUAU6",
          "Fee": "12",
          "InvoiceID": "D030306CC3302D9592C4504F06903164D875B799580D73B9024A936BEC334626",
          "LastLedgerSequence": 22029295,
          "Sequence": 20497196,
          "SigningPubKey": "EDD27F296E80BB22FB270B3B9F33D65238022A21FC774126592778E679F5057EE7",
          "TransactionType": "Payment",
          "TxnSignature": "3F0C834AE9E132DEA3586CB17972CE94EBF3DD5D55B10EF848F2852FB77E4C924DA85B75A36FEB9B9C1F74639AE735CEBCF9E60F7AC68A4120DAA39BB0B53C05",
          "ctid": "C15023DC000D0001",
          "date": 846998360,
          "ledger_index": 22029276
        },
        "meta": {
          "AffectedNodes": [
            {
              "ModifiedNode": {
                "FinalFields": {
                  "Account": "rwi1i3TJfZKmLWoAiNkXUBZmdWVGFxBNRQ",
                  "Balance": "97611373",
                  "Flags": 0,
                  "OwnerCount": 2,
                  "Sequence": 20497197
                },
                "LedgerEntryType": "AccountRoot",
                "LedgerIndex": "64AA019E3E260072998FB3E304ED0FFC37169221E8AA6DD8C4B41FDDE9DE2D7A",
                "PreviousFields": {
                  "Balance": "97701385",
                  "Sequence": 20497196
                },
                "PreviousTxnID": "867371243470F78ADD52C22B9B4D3FD62D6E23B4D12BBD11A489682DED47E3D1",
                "PreviousTxnLgrSeq": 22029232
              }
            },
            {
              "ModifiedNode": {
                "FinalFields": {
                  "Account": "rDibQptnbQvQTfUCFXdDFLEaKG293UUAU6",
                  "Balance": "104234988",
                  "Flags": 0,
                  "OwnerCount": 1,
                  "Sequence": 21330226
                },
                "LedgerEntryType": "AccountRoot",
                "LedgerIndex": "8B6FECA12E682AE9ED79C2F6D5532F37CBE08DA37AB5F30571818B1C31E05564",
                "PreviousFields": {
                  "Balance": "104144988"
                },
                "PreviousTxnID": "23524417A4B2AAB44F6F763FC6CDBE183200ED34C53D494C17FB1F04D684DB6A",
                "PreviousTxnLgrSeq": 22029146
              }
            }
          ],
          "TransactionIndex": 13,
          "TransactionResult": "tesSUCCESS",
          "delivered_amount": "90000"
        },
        "ledgerIndex": 22029276
      }
    }
  ],
  "sha256": "5e06321c272119d1a7be67c01f948fd16c8e6bcc9f92e125c19724b3df892a43"
}
```

## x64 launch evidence

```json
{
  "sha256": "7cc32f59311cb3ce3a3825aae269ffa1b63e5a01cbd81fcfaa64420bfae50746",
  "at": "2026-11-03T05:21:57.619Z",
  "executablePath": "/var/folders/g8/5_hq0kbs4499lmjhph03mvgc0000gn/T/ra-dmg-hWVzVe/ResearchAgent.app/Contents/MacOS/ResearchAgent",
  "dmg": "/Users/speedpowermac/.t3/worktrees/tftf/t3-52df585a/desktop/out/ResearchAgent-0.7.0-x64.dmg",
  "bytes": 140779598,
  "results": [
    {
      "live": false,
      "data": "/var/folders/g8/5_hq0kbs4499lmjhph03mvgc0000gn/T/ra-accept-FfvPLw",
      "coldStartMs": 51936,
      "arch": "x64",
      "launchOnly": true
    }
  ]
}
```
