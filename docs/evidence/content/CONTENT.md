# Real content evidence

12,104 public-docs passages in 1,136 article chunks; 13,372,294 bytes. Each passage is at most 1,200 characters. No ledger writes, model calls or transactions in this step.

## Reproduce

```sh
npm run corpus:public-docs
FREE_TIER=public-docs npm run dev:publisher
```

Authenticated `gh api` downloads pinned tarballs to a scoped temporary directory outside the repository. The index is larger than 8 MB and ignored; only the manifest and deterministic builder are committed. `docker/hosted/build.mjs` rebuilds the index inside its temporary archive before Docker runs (handoff to R3-REACH). No deployment. Startup fails if the opt-in index is missing. Tiny stubs are excluded to retain the existing article validation; code fences and template directives are omitted. XRPL private snippets, source-image notes and underscore-prefixed templates are excluded because they are not public pages. Known page-title heading templates are resolved; unsupported dynamic headings cite the page root. Markdown links in heading labels do not leak their target path into the anchor. No length or leak guard was loosened.

## Sources and licences

- XRPLF/xrpl-dev-portal at `182f8d20b157aa791433ff399a0f30dbed74a5eb`: 8,756 passages, 841 chunks. MIT; full licence text retained in manifest.
- coinbase/x402 at `0e6e8c55d86b4f14234fb6e49a4052074fb93e57`: 3,348 passages, 295 chunks. Apache-2.0; full licence text retained in manifest.

## Five answers drawn only from public docs

These are source-extract checks, not live-model results.

**What does account_info return?**
The `account_info` command retrieves information about an account, its activity, and its XRP balance. All information retrieved is relative to a particular version of the ledger.
Source: https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_info#account_info

**What does gateway_balances calculate?**
The `gateway_balances` command calculates the total balances of trust line tokens issued by a given account, optionally excluding amounts held by operational addresses. This method doesn't support MPTs.
Source: https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/gateway_balances#gateway_balances

**What is account_lines?**
The `account_lines` method returns information about an account's trust lines, which contain balances in all non-XRP currencies and assets. All information retrieved is relative to a particular version of the ledger.
Source: https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_lines#account_lines

**What does a facilitator do?**
The `x402-xrpl` package is maintained by [T54](https://xrpl-x402.t54.ai) and is the reference implementation of X402 for the XRP Ledger. It is available on [PyPI](https://pypi.org/project/x402-xrpl/). T54 also operates a hosted Mainnet facilitator, `xrpl-facilitator-mainnet.t54.ai`, listed as a production option in x402's official facilitator directory. The testnet facilitator, `xrpl-facilitator-testnet.t54.ai`, is intended for development only and should not be used for production traffic.
Source: https://xrpl.org/docs/agents/agentic-payments-x402#agentic-payments-with-x402-on-the-xrp-ledger

**What is HTTP 402 used for?**
X402 is an open protocol for HTTP-native machine-to-machine payments. It extends the existing HTTP 402 Payment Required status code into a complete payment flow: a service responds with its payment requirements, a client fulfills them with an on-chain transaction, and the service delivers the resource.
Source: https://xrpl.org/docs/agents/agentic-payments-x402#agentic-payments-with-x402-on-the-xrp-ledger

## Verification incident (12 Nov)

At clean head `c074461afa56066445483eb850c535ff5bd825ff`, `check:fast` passed (3,070 unit checks; 20 chaos iterations, zero invariant violations). The full Node 22 gate passed all steps except hosted browser startup: desktop staging and the hosted web server both rebuild `dist/` concurrently. Hosted startup failed with `ENOENT ... dist/.vite/manifest.json`, while desktop staging succeeded. Receipt: `1794474650280-27304-f5d75ed4-a9e7-4193-a90d-58471695dcee.json` in the shared Git local-gate store. The gate now schedules desktop staging after hosted checks; every check and budget is retained.
