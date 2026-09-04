# XRPL feedback drafts — pending manual review

These drafts are research-based documentation/integration observations. They
have **not** been submitted. Review each one and submit only if it accurately
describes your team’s actual developer experience.

## 1. Cross-tool chain identifiers

Evidence: [XRPL x402 guide](https://xrpl.org/docs/agents/agentic-payments-x402) and `skills/xrpl-agentic-resources/ows/docs/07-supported-chains.md`.

> The XRPL x402 guide uses `xrpl:1` for Testnet and `xrpl:0` for Mainnet, while the OpenWallet Standard reference uses the canonical CAIP-2 identifiers `xrpl:testnet` and `xrpl:mainnet`. A builder combining x402 payments with a policy-gated wallet can pass a valid-looking identifier that another layer rejects or interprets differently. Publishing one canonical mapping and a conversion helper would remove a subtle cross-tool integration failure.

## 2. Destination tags and hosted-account payments

Evidence: [XRPL destination-tag tutorial](https://xrpl.org/docs/tutorials/payments/send-xrp) and [XRPL x402 guide](https://xrpl.org/docs/agents/agentic-payments-x402).

> The XRPL x402 quickstart models `payTo` as a plain classic address, but many hosted accounts require a DestinationTag and XRPL payments can fail when the destination account enforces one. The quickstart should explain whether x402 payment requirements can carry a destination tag or X-address, how the client validates it, and how a merchant advertises the requirement. Without that path, an agent can pay the right institution but still receive a validated failure such as `tecDST_TAG_NEEDED`.

## 3. SourceTag ownership and audit integrity

Evidence: [XRPL x402 guide](https://xrpl.org/docs/agents/agentic-payments-x402) and [Agent Wallet skill](https://xrpl.org/docs/agents/xrpl-agent-wallet-skill).

> The XRPL x402 payer example says the on-chain SourceTag is the value declared by the merchant, while the Agent Wallet guidance presents SourceTag as a way to attribute agent-generated activity. Those ownership models conflict: an untrusted paywall can choose the tag that appears in the payer’s transaction and distort agent or merchant analytics. The protocol should define whether the payer, merchant, or facilitator owns each attribution field and provide a tamper-resistant convention for both sides.

## 4. Testnet resets and reproducible agent tests

Evidence: [XRPL Testnet faucets](https://xrpl.org/resources/dev-tools/xrp-faucets) and [XRPL x402 guide](https://xrpl.org/docs/agents/agentic-payments-x402).

> The XRPL faucet documentation warns that testnet balances and ledger history may be reset, while the agentic-payment quickstart presents a wallet, payment, and explorer flow without a reset-aware test fixture or verification strategy. After a reset, saved addresses, transaction hashes, and trustline state can silently become invalid and make a demo look nondeterministic. A documented disposable-wallet bootstrap, network-health check, and reset-safe integration test would make agent demos much easier to reproduce.

## 5. JSON-RPC and WebSocket endpoint pairing

Evidence: [XRPL x402 guide](https://xrpl.org/docs/agents/agentic-payments-x402) and [Agent Wallet skill](https://xrpl.org/docs/agents/xrpl-agent-wallet-skill).

> The XRPL agent materials use a WebSocket endpoint on port 51233 for the wallet flow and an HTTP JSON-RPC endpoint on port 51234 for the x402 payer, but do not explain why the transports and ports differ or how to health-check that they refer to the same network. A builder can copy the wrong endpoint into an otherwise correct payment flow and get opaque connection or ledger-state errors. The quickstarts should show a network-identity check and a small endpoint matrix for WebSocket, JSON-RPC, Testnet, and Mainnet.
