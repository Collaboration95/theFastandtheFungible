# Writer catalogue and hosted follow-ups · 11 November 2026

Local HTTPS hosted-mode stack, fixture models, simulated payments. No deployed,
live-provider, desktop binary or live Testnet acceptance claim.

The earnings surface uses the same component/API in local, desktop and hosted
modes. It deliberately reports **your retained history**, not total marketplace
earnings: another visitor's sales, questions and learned reputation stay private.
Only recorded Testnet key-reveal payments with a finish hash and reveal ledger
are listed as sales. Simulated payments and unfinished attempts are excluded.
Refund rate uses these listed sales as its denominator. Trust charts are drawn
only when at least two recorded observations exist; no history is invented.

The publishing CTA links docs/publishing.md. Writer public pages show free text
or paid abstracts; purchase, search, facilitator, owner and arbitrary nested
routes are denied by the hosted allowlist. Public reads are capped at 120 per
minute per IP, 512 KiB per upstream page, and five seconds.

Verification uses OFFSET=2600 / DEMO_PORT_OFFSET=2600. Hosted browser tests use
OS-allocated ephemeral ports and the shared heavy-verification lock.

- `writers-1440.png`, `writers-390.png`: the actual hosted writer screen in two
  independent browser contexts; no horizontal scroll at 390 px.
- Hosted access tests exercise a S$1.00 and zero cap, scope/submit reservations,
  foreign-session sales isolation, blocked private/mutation paths, public read
  rate limits and paid-body non-disclosure through the real gateway.
- Hosted Playwright also checks a smaller cap rendered from the status API.
