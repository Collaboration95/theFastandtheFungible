# Filing kit for the upstream drafts · updated 10 Nov 2026

Eight drafts are **final and paste-ready, not filed**. No mainnet incident is claimed. Filing is an owner action tracked in pinned issue #265 (B1); this kit creates no new human task. Do not describe a prepared body as submitted.

## Filing table

Each draft starts with the issue title (H1), a target line, and a rule. Use the H1 as the title and the text under the rule as the body.

| # | Draft | Target repo | Issue title | Class | Severity | Repro (offline) |
|---|---|---|---|---|---|---|
| 1 | `01-issuer-permission.md` | `XRPLF/xrpl-dev-portal` | Document issuer AllowTrustLineLocking preflight for RLUSD token escrow | Observed flags + document-derived refusal | High | `01-issuer-permission.mjs` |
| 2 | `02-delivered-amount.md` | `t54-labs/rlusd-cli` | Document exact delivered-amount checks and negative issued-asset vectors | Code-derived | High | `02-delivered-amount.mjs` |
| 3 | `03-invoice-consumption.md` | `t54-labs/rlusd-cli` | Document same-payment replay after invoice consumption | Code-derived | Medium | `03-invoice-consumption.mjs` |
| 4 | `04-header-only.md` | `t54-labs/rlusd-cli` | x402Fetch returns the unpaid 402 when the v2 challenge is only in the PAYMENT-REQUIRED header | Observed | Medium | `04-header-only.mjs` |
| 5 | `05-expiry-cancel.md` | `XRPLF/xrpl-dev-portal` | Escrow tutorials: show EscrowCancel after CancelAfter (expiry does not return funds by itself) | Observed | Medium | `05-expiry-cancel.mjs` |
| 6 | `06-funding-auth.md` | `t54-labs/rlusd-cli` | Document authenticated access for the RLUSD Testnet faucet (mint-xrpl returns 401) and what faucet fund returns | Observed | Medium | `06-funding-auth.mjs` |
| 7 | `07-endpoint-history.md` | `XRPLF/xrpl-dev-portal` | Public endpoints disagree on retained Testnet history; JSON-RPC over HTTP lacks CORS headers | Observed | Medium | `07-endpoint-history.mjs` |
| 8 | `08-memo-size.md` | `XRPLF/xrpl.js` | Preflight the 1 KiB Memos limit before signing, and report the size in the error | Observed | High (blocker for us) | `08-memo-size.mjs` and an inline snippet |

Drafts 2, 3, 4 and 6 target the public CLI and integration repository, **not a claim that it owns the unpublished x402-xrpl SDK source**: package 0.3.4 omits repository metadata. Ask maintainers to route SDK findings to the source owner. Drafts 1, 5 and 7 are documentation requests. Draft 8 is an SDK request; if maintainers prefer, its documentation half moves to `XRPLF/xrpl-dev-portal`.

Project findings that are **not** upstream defects (B30 to B32) are in `B30-round5.md` to `B32-round5.md` and `ROUND5-FILING-KIT.md`; they go to this repository, not to XRPLF or t54.

## Five-minute procedure

1. Read the drafts (two minutes); each separates what was observed from what is inferred.
2. Run `npm ci`, then any `node scripts/repro/NN-*.mjs` (offline, under 30 s each; 07 reads public Testnet).
3. File each with an authenticated `gh issue create --repo <target> --title '<issue title>' --body-file <draft>` (two minutes). `gh` would include the target and status lines above the rule, so delete everything above the first `---` before filing, or paste the body by hand. No labels are required.
4. Add the returned issue URLs to #265, then to the **Upstream status** column of the top-7 table in [BUILDER-FEEDBACK](../../BUILDER-FEEDBACK.md#top-7-ranked-findings) and to deck slide 11 and Q&A Q13 (`{{UPSTREAM_FILED_URLS}}`).
