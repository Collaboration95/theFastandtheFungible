# +1: document missing ALLORNOTHING inner results and safe reconciliation

Comment draft for [XRPLF/xrpl-dev-portal#3366](https://github.com/XRPLF/xrpl-dev-portal/issues/3366), which remains open. Please add a rollback example to the Batch tutorials. This narrows the already completed warning in [#3968](https://github.com/XRPLF/xrpl-dev-portal/pull/3968); we are not reporting outer `tesSUCCESS` as an undocumented bug.

## Environment and evidence

XRPL Testnet, 12 November 2026; xrpl.js 4.7.0, ripple-binary-codec 2.11.0, Node 22.23.4. Portal master `182f8d20b157aa791433ff399a0f30dbed74a5eb`. Fresh read-only checks at 11:54 UTC reproduced the results below. No new transaction was signed by this research lane.

- Outer rollback Batch: [7C162D61DE09381ED8B36E6DD25898D0E19AD728D75A894564D7F323B2955857](https://testnet.xrpl.org/transactions/7C162D61DE09381ED8B36E6DD25898D0E19AD728D75A894564D7F323B2955857), ledger 22263738, validated `tesSUCCESS`.
- Rolled-back inner hashes: [231A278721E7FCC4FFC27A64CCB6CCACBF584CF5B78919D2FE84586DEB540F92](https://testnet.xrpl.org/transactions/231A278721E7FCC4FFC27A64CCB6CCACBF584CF5B78919D2FE84586DEB540F92) and [156E2759E3E390019BF5EF18F06E088224A8CB00DED4E90057428264F7AC6798](https://testnet.xrpl.org/transactions/156E2759E3E390019BF5EF18F06E088224A8CB00DED4E90057428264F7AC6798). Both return `txnNotFound`; these explorer links identify **uncommitted hashes**, not validated transactions.
- Successful control: [AD28CC333F7B353E2D7932B3CCE19DD127BDF56226E3D893631A27586FF4FAB0](https://testnet.xrpl.org/transactions/AD28CC333F7B353E2D7932B3CCE19DD127BDF56226E3D893631A27586FF4FAB0), ledger 22263736, two committed EscrowCreates.
- [Spike script](https://github.com/Collaboration95/theFastandtheFungible/blob/ad0ad3294f5b165c71adfe82944a2c94da5622aa/scripts/spikes/b-batch.mjs) and [raw metadata](https://github.com/Collaboration95/theFastandtheFungible/blob/ad0ad3294f5b165c71adfe82944a2c94da5622aa/docs/evidence/money/b.json): escrow count stayed 2 after the failed batch. Outer metadata has only fee/sequence changes; no inner failure code.

## Minimal repro

```sh
for hash in 7C162D61DE09381ED8B36E6DD25898D0E19AD728D75A894564D7F323B2955857 231A278721E7FCC4FFC27A64CCB6CCACBF584CF5B78919D2FE84586DEB540F92 156E2759E3E390019BF5EF18F06E088224A8CB00DED4E90057428264F7AC6798; do
  curl -s https://s.altnet.rippletest.net:51234/ -H 'Content-Type: application/json' \
    --data "$(printf '{"method":"tx","params":[{"transaction":"%s","api_version":2}]}' "$hash")"
done
```

To regenerate the original ledger case, run the pinned spike's B1 section: submit a `tfAllOrNothing` Batch containing one affordable EscrowCreate and a second for 99,999,999,999,999,999 drops. Record escrow objects before/after and query both inner hashes. Use Testnet faucet wallets only.

## Expected versus actual

The reference says to look up each inner hash and inspect its result. For an ALLORNOTHING rollback no inner result exists. The concept page says only committed inners exist, but its integration section says all `tes`/`tec` inner results are accessible, without the committed qualifier.

Please show how to establish complete coverage of the outer validated ledger before classifying missing inner hashes as rollback. Missing history, transient unavailability and uncommitted inners must remain distinct. Do not automatically retry a purchase on an ambiguous lookup.

## Suggested fix and scope

The attached optional docs patch qualifies committed results and describes the absence case. This is a **docs clarification**, not a consensus bug. Publishing the particular rejected inner index/code would be a separate rippled observability feature, requiring an explicit design for noncommitted diagnostic data. Related [rippled#8666](https://github.com/XRPLF/rippled/issues/8666) asks for Batch simulation support, which does not establish a historical rollback code. No separate rippled issue is proposed here.
