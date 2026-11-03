# Receipt contribution v3

A purchase receipt explains observable citation use, separately from signed
passage authenticity and semantic truth. `schemaVersion: 3` explicitly dispatches
`identityVersion: 1 | 2` using Lane F's canonical identity helpers. v1 and v2 remain
valid under their original semantics and reject contribution extensions. Runs
without purchase receipts retain their original bundle version.

v3 requires `contributions.version: structural-v1`. Offline verification recomputes
all purchase rows: intent and canonical source key, status, gross/refund/net, refund
state, each answer version/claim ID/text/citation/span/passage/grant/root link and
final retention. Citation duplicates within one claim are collapsed. Failed proof
content is never linked. Final use is `cited | none`; semantic assessment is always
`not assessed` and `not independently verified`. `requirements` contains frozen
requested facts when present, with no invented claim mapping. Confirmed recorded
refunds reduce net only; pending candidates/refused challenges are distinct.

These fields are exported-data consistency checks. Signed leaf verification binds
the passage, not arbitrary claim semantics or causal contribution. Original audit
heads do not commit answer bodies. A self-contained chain also cannot detect a
wholesale rewrite; independently retain an expected head for audit integrity.

The SDK/MCP presentation exposes contribution rows. Python `Client.receipts(run_id)`
fetches the same portable export; its existing offline verifier dispatches v3.
ReceiptSheet reads existing payout rows for royalty status: direct research is
not applicable, missing hire payouts pending/unresolved, and signed-unconfirmed
rows remain unconfirmed. Only existing hire-v1 policy determines payouts.

The semantic scorecard definition remains unchanged. A separate same-row arithmetic
check counts each proof-PASS purchase's full price once when any gained fact remains
supported in the final answer; gross charged spend is the denominator, zero is null,
and refunds are separate. Runtime structural use is never presented as this score.
