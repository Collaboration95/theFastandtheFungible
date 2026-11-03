# Testnet custody and compliance boundary

ResearchAgent is a single-tenant Testnet prototype, not a regulated payment
service. Writers and example evidence are synthetic and unverified. No mainnet
payments are supported.

Ordinary research purchases pay writers directly from the operator's wallet.
**Hire the agent (#274) receives and holds the caller's Testnet XRP, then pays
writers, citation royalties and caller change from the ResearchAgent wallet.**
This flow is receive-and-forward custody; “we never hold funds” and a blanket
“non-custodial” claim are incorrect. The operator controls the development seed
and the retained service fee. The receiving account is not segregated escrow.

Admission, wallet-wide caps, pause and deterministic spend/royalty policy apply
to the hire flow. Its durable payment rows and receipts support retry and
reconciliation. Network fees are paid separately by senders. A failed payout
stays reserved until reconciled; receiving payment does not promise immediate
fulfilment during an outage. See [the protocol contract](x402-xrpl.md).

Moving receive-and-forward operations to mainnet would require legal review of
payment-service licensing, custody and safeguarding, identity/sanctions checks,
monitoring, retention, key management and incident recovery. This prototype
makes no licensing, KYC/AML or regulatory-compliance claim. #288 owns the
remaining audit/export/retention work and its integration with these payments.
