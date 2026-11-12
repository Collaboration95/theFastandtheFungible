# Publish negative issued-asset settlement vectors for x402 integrations

## Summary and target

Documentation/conformance request for `t54-labs/rlusd-cli`, which imports `x402-xrpl` for buyer flows. Please route to the x402 SDK/facilitator maintainer if tests belong there. This report does **not** claim that the CLI is a payment verifier, or that the hosted facilitator accepts underpayments. The published npm `x402-xrpl@0.3.4` metadata still has no source repository field.

## Environment and tracker

CLI main `155ab72076c9cb455a6c6c2d46254768e941193b`, npm SDK 0.3.4, Node 22.23.4; fixtures offline. Searched `org:t54-labs delivered_amount` and the CLI's x402 tracker. No duplicate found. The unrelated `monid-x402-xrpl` project is a Python gateway and is not the npm SDK source.

## Minimal repro

```sh
gh repo clone Collaboration95/theFastandtheFungible researchagent-repro
cd researchagent-repro
git checkout bc247cf54789b710ad9f72154f0e6fd8c302c887
npm ci
node scripts/repro/02-delivered-amount.mjs
```

The fixture starts from validated payment [1F2449A4660747066E99A89CEA5B49276D266F35820789042A8694EDB1DA23AF](https://testnet.xrpl.org/transactions/1F2449A4660747066E99A89CEA5B49276D266F35820789042A8694EDB1DA23AF) and retains its original currency/issuer/value. It independently mutates `meta.delivered_amount` to a smaller value, a wrong issuer, and `unavailable`. The ResearchAgent verifier rejects all three. These are synthetic mutations of a real receipt; there was no live attack or rejected-payment hash.

## Expected versus actual

Expected: published settlement conformance vectors show that validated issued-asset delivery must match currency, issuer and exact decimal amount, and that missing/unavailable delivery is not proof of payment.

Actual: the CLI's x402 tests exercise buyer selection and command negotiation; they do not demonstrate these settlement-verifier negative cases. `Amount`/`DeliverMax` is an instruction and does not by itself prove delivered value. Existing XRPL [partial payment documentation](https://xrpl.org/docs/concepts/payment-types/partial-payments) already covers the protocol risk; this asks to carry the vectors into x402 integration guidance, not to rediscover that warning.

## Suggested fix and validation

Publish portable cases: correct issued delivery, smaller value, wrong issuer/currency, unavailable/missing metadata, and partial/conversion fields inconsistent with an exact scheme. Use decimal strings rather than float equality. Validate `validated` and `tesSUCCESS` as well as delivery. Principal and fee checks should remain separate.

Upstream command `npm test -- test/unit/x402.test.ts test/unit/x402-command.test.ts`: 20 passed on unchanged current main. `node scripts/repro/02-delivered-amount.mjs`: passed. Neither proves hosted facilitator behavior. Severity medium documentation gap; no Mainnet incident or exploitable SDK defect established. No speculative verifier code patch is supplied without its source.
