# Testnet operator key rotation

Two validated rotations passed on fresh Testnet account `rENjW2xoETLw8ABVhsKRbxou8rViJCF2ga`: `AE3B3258DEFFBB1BE8FA211603AE105F335F29CC1FF578A82D187A288E2B3C55`, then `8296784FA04D8DFECED1962DB97614E801F9AB331EA795958A1FF6F229F23918`. The second was signed with the first regular key; an attempted third rotation with that stale key was refused. See `regulated-testnet.json` for ledger indices and credential lifecycle observations. No hosted key was changed.

1. Pause new purchases (`SPENDING_PAUSED=1`) and drain pending signed transactions, escrows and refunds. Preserve journals and old key backups. Keep the master key offline for recovery; this script never disables it.
2. Confirm that the selected account and both keys are Testnet-only. Keep the signing seed in a mode 0600 JSON file shaped `{ "seed": "…" }`. Do not put it on the command line, in shell history, a screenshot or an evidence file.
3. Use a new private output path that does not exist. The script saves the next seed and then the exact signed submission in that file before broadcasting. Run under Node 22:

   ```sh
   ROTATION_ACCOUNT=rYourTestnetAccount \
   ROTATION_SIGNER_FILE=/private/current.json \
   ROTATION_NEXT_FILE=/private/next.json \
   node --import tsx publisher/publishing/rotate-operator.ts --testnet
   ```

   `testnetUrl()` allows only Testnet nodes. The script checks network ID 1, persists the next key before signing, caps the fee at 2,000 drops, submits `SetRegularKey`, checks `tesSUCCESS` in a validated ledger, and reads back `RegularKey`. Output contains only public addresses, ledger index and hash.
4. Independently read validated `account_info`. If the result is uncertain, retain both files and reconcile before retrying; do not generate another key or discard the saved next key. Repeat the same command with `--resume` to reuse its saved key and exact signed blob. If the key is already installed, resume verifies the saved transaction hash on ledger and returns without submitting again. A final failure or expiry requires reconciliation before starting a new rotation with a new output file.
5. A ledger regular key is not a replacement account. When using xrpl.js, construct the signer with `Wallet.fromSeed(nextSeed, { masterAddress: account })`; keep transaction `Account` equal to the original account. Test a second rotation signed by the first regular key, then verify the old regular key is rejected. Do not disable the master key during this drill.
6. Promote the regular key only in a signer that supports the original account address. The existing engine and publisher manifest signer currently derive their identity directly from the seed, so replacing `XRPL_PAYER_SEED` or a publisher seed blindly would select a different account. This lane proves ledger operator/issuer rotation and provides the runbook; it does not change the separate signer implementation owned by the payment-speed lane. Keep the master key available until that integration is qualified.
7. Resume purchases after an exact-address smoke check and verify the five gates. Store transaction hashes in public evidence; store all seeds privately. For emergency rollback, use the retained master key to set the previous regular key, verify on ledger, then investigate before resuming.

This is a Testnet procedure, not production key custody or an assertion of legal compliance.
