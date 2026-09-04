# Ripple track ethos

## The north star

Do not build an agent that merely sends an XRP transaction. Build a useful
business that becomes possible, or meaningfully better, because an agent can
discover, decide, transact, and deliver value.

The intended loop is:

```text
real customer problem
  -> agent understands the objective
  -> agent discovers or selects a service
  -> agent decides within explicit constraints
  -> payment settles on XRPL
  -> customer receives a useful outcome
```

## Why XRPL belongs in the loop

XRPL is a payment-first public ledger. Its appeal for this challenge is fast,
predictable settlement; low-cost transactions; an open network; and native
payments, tokens, exchange, escrow, and other financial primitives. The point
is to use those properties to improve a business workflow, not to add a token
as decoration.

XRP is the native asset and can provide liquidity or bridge currencies. A
stablecoin such as RLUSD may be more appropriate when the product needs a
stable unit of account. The agent should never have unrestricted spending
authority: use budgets, allowlists, expiry, transaction checks, and approval
gates where appropriate.

## Why x402 or MPP matters

x402 and MPP are ways for machines and agents to pay for services as part of a
request. A paid API can return a payment challenge, the agent can evaluate it,
sign an allowed payment, retry the request, and receive the service response.
XRPL is the settlement rail; x402 or MPP is the machine-payment interface.

## What a convincing demo proves

- The customer problem is real and immediately understandable.
- The agent makes a meaningful discovery or economic decision.
- The payment is necessary to unlock the service or outcome.
- At least one XRPL transaction succeeds on Testnet or Devnet.
- The UI shows what happened, why it happened, and what was delivered.
- Unsafe, redirected, expired, or over-budget requests are refused clearly.

The design principle is autonomy with accountability: models may reason and
recommend, while deterministic code controls money, permissions, limits,
idempotency, and evidence.
