# ResearchAgent security posture

Design: [FINAL-PUSH.md](../FINAL-PUSH.md) (D3–D7, §8–§9). The controls below are built; fixture and stub tests establish bounded behaviour,
not a claim that live models resist every injection. Desktop implementation and
live-evidence limits are specified separately below.

- Source text is treated as quoted, untrusted evidence; it is never executed
  as instructions.
- Premium bodies and payment details are server-only. Public source responses
  contain metadata and preview until a verified payment grants the article.
- Search hits never carry premium bytes: only the writer's abstract,
  tags, relevance, and a signed manifest (D3).
- The server owns integer-cent budget enforcement, source ID binding, invoice
  identity, and access grants. The browser cannot approve a payment or submit a
  transaction payload.
- Every claim is allowlisted to a source and evidence span in the dossier
  contract. Derivative sources do not add independent families.
- Offline scenario mode settles in a labelled simulation and never produces a
  fake Testnet hash. With `SETTLEMENT_RAIL=xrpl-testnet` and a payer seed,
  the buyer server signs a Payment bound to the article's x402 terms; the
  publisher's facilitator verifies the signed blob, submits it to the
  configured XRPL Testnet endpoint, waits for validation, and records the
  transaction hash. The buyer records the receipt and explorer URL. Both
  sides restrict ledger access to Testnet; Testnet XRP has no real value.
- Each paid article carries a writer manifest signed with the XRPL
  key that receives payment. The buyer accepts it only if the key derives to
  the payee wallet and the signature verifies. The signed message is
  domain-prefixed canonical JSON, so it can never double as a valid
  transaction (D4).
- A failed proof triggers `POST /challenge`. The writer's facilitator
  re-checks and refunds with a Payment to the payer. A refund is write-once per
  intent. The trust penalty applies whether or not the writer refunds (D5).
- `XRPL_PAYER_SEED` is server-only and must stay in the ignored local `.env`;
  never copy it into `.env.example`, the client bundle, logs, or persisted run
  data. A receiver secret is not needed to receive a Payment.

## macOS desktop boundary (#259)

The desktop app never loads the clone's `.env`. Offline fixture mode needs no
credentials and makes no provider/ledger calls. The bundled Node engine runs in
an Electron utility process (with its existing isolated worker); both API and
publisher listen on random `127.0.0.1` ports. The desktop API checks Host and
rejects foreign Origin requests. This is local, single-user isolation, not API
authentication against other programs running as the same macOS user. Remote
engine/publisher settings remain disabled until #286 provides token auth.

Windows load only bundled `app://researchagent` content. Context isolation,
renderer sandboxing, no Node integration, strict script/connect CSP, denied
permissions/popups and navigation controls constrain the renderer. A main-process
protocol proxy reuses the existing UI contracts; the typed SDK handles wallet
status and the packaged MCP adapter. Only the Settings window's top frame may
invoke the narrow desktop IPC operations. The research renderer receives no
seeds or provider keys. Paid passages reach it only after engine grants.

Seed records and provider/token credentials are macOS Keychain generic passwords
under service `ResearchAgent`. `security -i` receives writes over stdin, never
credential-bearing argv. Credentials are base64-encoded records (not encryption
by themselves); Keychain supplies encryption at rest. Live startup reads them
into main memory and passes an allowlisted environment to the utility process
and worker. Signing objects retain plaintext in memory; JavaScript cannot
guarantee zeroisation. User-entered provider credentials also briefly exist in
the dedicated Settings renderer. Nothing promises that the seed never leaves
Keychain at runtime.

There is no arbitrary seed import: seeds contain no network identifier.
Wallet creation funds only Testnet and ledger endpoints are restricted to
`*.rippletest.net`. Fixture and Testnet stores are separate. Non-secret preferences,
SQLite stores, granted evidence and receipts live in Application Support.
MCP caps and the desktop pause are implemented; a wallet-wide shared cap/pause is
#286. Unsigned local installation and offline smoke do not prove live settlement,
Developer ID signing, notarisation or a human usability judgment.
- Publisher keys are needed at runtime to sign manifests and refunds. They are
  server-only, and never logged, traced, persisted in run data, or sent to a
  model.
- Built-in writers and articles are original synthetic content attributed to fictional
  writers and labelled SYNTHETIC. Draft questions name real institutions with
  invented facts (O3). No real article body is scraped, bypassed, or
  redistributed.
- Locally published writers are labelled unverified (no KYB on Testnet). Author-supplied content is distinguished from SYNTHETIC starter content. Publisher keys are stored in an ignored, mode-0600 `.env.writer` beside the private corpus. An operator denylist is checked before funding a new wallet and before purchase signing; it is not sanctions screening.
- Persistence is SQLite (`node:sqlite`): `data/app.db` and the publisher journal.
  It is local demo storage, not multi-user production storage; deployers should
  add encryption, retention, rate limits, and a managed
  database before production use.


## Admission and operator controls (#286)

One `server/spend-policy.ts` admission seam covers web `/runs`, MCP and SDK
(the SDK uses the MCP surface). `Store.admit` atomically records surface,
principal, idempotency key, requested/admitted budget, UTC day and policy
version (`wallet-v1`) before launching work. The `admissions` table imports
old `mcp_requests` rows on boot; changed questions cannot reuse a key. Future
x402/agent routes must call this seam with operator-owned surface caps.

Defaults are **500 cents per run, 100 per source and 2000 gross per wallet per
UTC day**, all SGD. `WALLET_DAILY_CAP_MINOR` configures the wallet cap; MCP's
`MCP_MAX_BUDGET_MINOR` and `MCP_DAILY_CAP_MINOR` still default to zero. Refunds
never replenish authority. Unfinished budgets and ambiguous SUBMITTING intents
reserve authority across midnight and restarts; receipt dates own gross spend.
The wallet is the engine's single payer and durable database: separate stores
must not be used to operate the same wallet as independent authorities.
Reservations and the RESERVED → SUBMITTING claim recheck the wallet cap.

`SPENDING_PAUSED=1` or authenticated `POST /api/wallet/pause {"paused":true}`
blocks reservations with “Spending paused by the operator; nothing was
charged”. The persisted switch is visible in `/api/wallet/status`, SDK/MCP
wallet status (`wallet.paused`) and the web wallet label. Resume uses
`{"paused":false}` but cannot override the environment switch. Work already
SUBMITTING still reconciles; pause never claims to undo a payment.

## Authentication contract (web, SDK, MCP and native app)

- `RA_API_TOKEN` is a bearer secret. When set, every mutating route (including
  stop, retry, reset and reports) and every `/api/mcp/*` requires it. Pause
  always requires a token. Comparison is constant time for equal-length
  values; telemetry masks the token. Errors never echo credentials.
- An unconfigured token permits anonymous development only when both the
  socket and HTTP Host are loopback. Non-loopback `HOST` without a token
  refuses startup naming `RA_API_TOKEN`. It is not a public anonymous mode.
- The Host allowlist always includes `localhost`, `127.0.0.1` and `[::1]`.
  Add exact external hostnames with `RA_ALLOWED_HOSTS` (comma-separated,
  without scheme or port). Other Hosts return 403 before auth or routing,
  including DNS rebinding. Forwarded Host/IP headers do not grant authority.
- If a request has Origin, it must equal `RA_WEB_ORIGIN` (default
  `http://127.0.0.1:<5100 + DEMO_PORT_OFFSET>`). Native clients omit Origin.
  There is no permissive CORS or cookie authentication.
- `make run`, demo, record and clip generate a random local token and pass it
  through the bundled Vite server-side proxy, without shipping it to browser
  JavaScript. Vite checks Host/Origin and the socket before attaching it. `dev:client` binds
  `127.0.0.1`; `RA_CLIENT_LAN=1 npm run dev:client -- --host 0.0.0.0` explicitly
  enables a trusted LAN proxy. Configure `RA_WEB_ORIGIN` for that web address.
  This opt-in authorizes clients of that web proxy to use its operator token.
- Embedded/native: `const engine = await startEngine({dataDir, apiToken?})`
  returns `{apiUrl, publisherUrl, apiToken, close}`. Token precedence is the
  option, then `RA_API_TOKEN`, then 32 random bytes encoded as hex. Keep it
  in the main process / Keychain; pass
  `createClient({baseUrl: engine.apiUrl, token: engine.apiToken})`. No query
  tokens. Remote mode reads the operator token from `RA_API_TOKEN`.
- SDK defaults to `RA_API_TOKEN` in Node when `token` is omitted; JSON and SSE
  requests carry the header. MCP forwards that token to `RA_BACKEND_URL`,
  or the embedded engine's generated token. No token is returned by a tool.

## Decision injection posture

Frozen requirements remain the purchase target. The requirement batch omits
source-derived `conclusion` entirely and skips gap_material. Historical fixture
scenarios retain legacy gaps; live legacy runs require `LEGACY_GAP=1`.
Candidate title (200), publisher (120), abstract (1200), family (160), tags
(16 × 80), identifiers (160; version 80), and license strings (80/200) are capped and spans matching
`INSTRUCTION` removed. Unknown fields, bodies, wallets, URLs and manifests are
excluded from the candidate model view. Writer identifiers stay in structured data, never provider question instructions. Read-source metadata is limited to 50 records; coverage references are capped at 400 characters. Coverage/relevance use at most
100/64 passages of 2000 characters, filtered by the same predicate. The model
is told that writer fields and passages are quoted, untrusted data. MCP hits,
run results and citation passages carry `untrusted: true` and tool descriptions
explain it. Filtering is defence in depth, not a security boundary.

`tests/client-admission.test.ts` checks the bundled proxy and credential-file denial.
`tests/admission.test.ts` pins Host/Origin/auth, the shared daily cap, migration,
restart/idempotency and masking. `tests/injection.test.ts` attacks titles,
abstracts, free-source text and an MCP “S$500” question with the honest fixture
and an all-BUY live-provider stub. It asserts capped/structured inputs, no
conclusion, unchanged honest selection, deterministic budget/per-source/wallet
refusals, one receipt across concurrent retries, refund gross accounting, midnight reservations, and pause before submission.
These are offline simulations and provider stubs, not live-injection evidence.
