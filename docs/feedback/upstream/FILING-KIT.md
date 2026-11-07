# Five-minute filing kit · 7 Nov 2026

Top three bodies are final, **not filed**. No mainnet incident is claimed.
Filing remains an owner action tracked in pinned issue #265; this kit creates no new human task.

| Target repo | Title | Body file | Labels |
|---|---|---|---|
| XRPLF/xrpl-dev-portal | Document issuer AllowTrustLineLocking preflight for RLUSD token escrow | `docs/feedback/upstream/01-issuer-permission.md` | none (let maintainers triage) |
| t54-labs/rlusd-cli | Document exact delivered-amount checks and negative issued-asset vectors | `docs/feedback/upstream/02-delivered-amount.md` | none |
| t54-labs/rlusd-cli | Document same-payment replay after invoice consumption | `docs/feedback/upstream/03-invoice-consumption.md` | none |

The last two target the public CLI integration/docs repository, **not a claim that
it owns the unpublished x402-xrpl SDK source**. Package 0.3.4 omits repository
metadata. Ask maintainers to route SDK conformance findings to its source owner.

1. Read the three body files (one minute); they distinguish observations from inferred failures.
2. Run `npm ci`, then `node scripts/repro/01-issuer-permission.mjs`,
   `node scripts/repro/02-delivered-amount.mjs`, and
   `node scripts/repro/03-invoice-consumption.mjs` (offline, one minute).
3. Use authenticated `gh issue create --repo <target> --title '<title>' --body-file <body-file>`
   with the table's values (two minutes). No special labels are required.
4. Add returned issue URLs to #265 (one minute). Do not describe a prepared body as submitted.
