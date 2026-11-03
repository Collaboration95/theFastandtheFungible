# App MCP HTTP proof

Real XRPL Testnet settlement; fictional corpus and fixture research/decision providers. No mainnet funds or live model calls. SDK Streamable HTTP client → per-agent bearer → policy admission (requested S$999 clamped to S$1) → exactly one purchase. This proves the HTTP/payment path using the local Testnet payer, not a packaged Electron/Keychain acceptance run.

Transaction: https://testnet.xrpl.org/transactions/0EDB64594916EF8127B06496919FCC469B3176C943B34423B20EC578CE7278B1

Command: OFFSET=900 node --import tsx scripts/app-mcp-proof.mjs

```json
{
  "at": "2026-11-03T04:59:25.583Z",
  "runId": "2bba3bdf-10ad-4d51-bf8b-bb974cd6f197",
  "principal": "2aec2023-874e-4fec-8836-84717e3f0c3e",
  "budgetMinor": 100,
  "spentMinor": 90,
  "labels": {
    "research": "fixture · extractive-fixture",
    "decision": "fixture · metadata-fixture",
    "publisher": "local",
    "settlement": "XRPL TESTNET · no real value",
    "search": "keyword only (embeddings unavailable)",
    "plan": "fixture · scope-fixture"
  },
  "txHash": "0EDB64594916EF8127B06496919FCC469B3176C943B34423B20EC578CE7278B1",
  "ledger": {
    "state": "validated",
    "tx": {
      "Account": "rwi1i3TJfZKmLWoAiNkXUBZmdWVGFxBNRQ",
      "DeliverMax": "90000",
      "Destination": "rDibQptnbQvQTfUCFXdDFLEaKG293UUAU6",
      "Fee": "12",
      "InvoiceID": "EFB12BD97A86B2AF472398B5376DBD42FC76EA4515C2E4161709F17A0DA05B65",
      "LastLedgerSequence": 22028945,
      "Sequence": 20497148,
      "SigningPubKey": "EDD27F296E80BB22FB270B3B9F33D65238022A21FC774126592778E679F5057EE7",
      "TransactionType": "Payment",
      "TxnSignature": "01C979F6F4105E8E2C4578FC33FBBFBA9CF406946B513B5D09B85D773F49541BAAB2E1A55D2680A481A1124B6DB52FCDEAF69C14E8B61399C2514A2A2AD59A0B",
      "ctid": "C150227E00000001",
      "date": 846997162,
      "ledger_index": 22028926
    },
    "meta": {
      "AffectedNodes": [
        {
          "ModifiedNode": {
            "FinalFields": {
              "Account": "rwi1i3TJfZKmLWoAiNkXUBZmdWVGFxBNRQ",
              "Balance": "99081949",
              "Flags": 0,
              "OwnerCount": 2,
              "Sequence": 20497149
            },
            "LedgerEntryType": "AccountRoot",
            "LedgerIndex": "64AA019E3E260072998FB3E304ED0FFC37169221E8AA6DD8C4B41FDDE9DE2D7A",
            "PreviousFields": {
              "Balance": "99171961",
              "Sequence": 20497148
            },
            "PreviousTxnID": "F79AAD7AAE9D5EC8A7296BA568E0F065E1ACDC858FB3651EA736FE8575908A80",
            "PreviousTxnLgrSeq": 22028924
          }
        },
        {
          "ModifiedNode": {
            "FinalFields": {
              "Account": "rDibQptnbQvQTfUCFXdDFLEaKG293UUAU6",
              "Balance": "103784988",
              "Flags": 0,
              "OwnerCount": 1,
              "Sequence": 21330226
            },
            "LedgerEntryType": "AccountRoot",
            "LedgerIndex": "8B6FECA12E682AE9ED79C2F6D5532F37CBE08DA37AB5F30571818B1C31E05564",
            "PreviousFields": {
              "Balance": "103694988"
            },
            "PreviousTxnID": "F79AAD7AAE9D5EC8A7296BA568E0F065E1ACDC858FB3651EA736FE8575908A80",
            "PreviousTxnLgrSeq": 22028924
          }
        }
      ],
      "TransactionIndex": 0,
      "TransactionResult": "tesSUCCESS",
      "delivered_amount": "90000"
    },
    "ledgerIndex": 22028926
  }
}
```

Local validation (3 Nov 2026): `OFFSET=900 npm run check:fast` passed 724 tests
and 20 chaos iterations with zero invariant violations or double charges.
`npm run readme:check` passed. `node desktop/build.mjs` staged the app.
The staged app launched with Electron 42; all four settings panels rendered,
research-window agent IPC was refused, and a disposable fixture principal was
created in Keychain, its config copied, then paused and permanently revoked.
This smoke did not make a payment. No four-client interactive acceptance,
new DMG installation, signing or notarisation is claimed.
`npm run gate:audit -- --db data/app-mcp-http-proof/app.db`: one live run,
zero violations across all ten rules (no separately captured leak observations).
