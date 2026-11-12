# Document Testnet endpoint history coverage and browser CORS checks

## Summary

Please expand the public-server guidance with a history-coverage check before interpreting `txnNotFound`. The table already advertises XRPL Labs CORS support; that part of the older report was overstated. The remaining gap is how to distinguish an endpoint missing a receipt from a receipt that never validated.

## Environment

Portal master `182f8d20b157aa791433ff399a0f30dbed74a5eb`; Node 22.23.4; read-only HTTP JSON-RPC with API v2 and Origin `https://collaboration95.github.io`, 12 November 2026, around 11:54 UTC. No browser session or ledger write.

## Minimal repro

```sh
for url in https://testnet.xrpl-labs.com/ https://s.altnet.rippletest.net:51234/ https://clio.altnet.rippletest.net:51234/; do
  curl --max-time 15 -si "$url" -H 'Content-Type: application/json' -H 'Origin: https://collaboration95.github.io' \
    --data '{"method":"tx","params":[{"transaction":"HASH","binary":false,"api_version":2}]}'
done
```

Replace `HASH` with the literal hash below. Query `server_info` to inspect `complete_ledgers`; for a known ledger, also use a bounded `tx` request and inspect `searched_all`. A missing result alone does not identify the cause; this sample does not prove the Labs server's retention policy.

## Expected versus actual

Expected: documentation teaches readers to establish history coverage and check origin-specific HTTP headers before choosing a receipt-verification endpoint.

Actual: the same historical validated issued-asset Payment returned `txnNotFound` from XRPL Labs with `Access-Control-Allow-Origin: *`, and validated `tesSUCCESS` from s.altnet and Clio with no `Access-Control-Allow-Origin`. This establishes endpoint disagreement and those response headers only; it does not establish a reset, a failed payment, a guaranteed retention window, or future policy.

## Transaction and suggested fix

[1F2449A4660747066E99A89CEA5B49276D266F35820789042A8694EDB1DA23AF](https://testnet.xrpl.org/transactions/1F2449A4660747066E99A89CEA5B49276D266F35820789042A8694EDB1DA23AF)

Fresh responses are retained in `docs/feedback/upstream/r3/evidence/live-reads.json` in ResearchAgent. Add a short preflight beside the Test Networks table, leaving the operator-maintained endpoint list unchanged. Severity medium (receipt verification); no mainnet failure measured.

## Tracker check

Searched `repo:XRPLF/xrpl-dev-portal CORS` and `history is:issue`. [#1607](https://github.com/XRPLF/xrpl-dev-portal/pull/1607) already added the CORS annotation in 2022. No matching open issue for the narrowed history-coverage instructions was found; results are retained with the bundle.
