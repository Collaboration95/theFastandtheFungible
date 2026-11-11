# Proof of refusal (as built, lane W1)

An agent that proves it did **not** spend. A finished run that read paid sources, judged none worth buying and spent
nothing can be shared as a permalink, `/proof/<id>`, that anyone can open and re-check against XRPL Testnet.
This sits on the existing hard gates; it adds no way to spend and reads no premium bytes.

## What can be shared

`refusalEligibility(run)` in `shared/refusal-proof.ts` is the one rule (the server decides; the web app only shows its words):

| Code | Run state | Visitor sees |
|---|---|---|
| `not_finished` | not `DONE` | nothing |
| `purchased` | any spend, reservation, receipt, grant or non-skipped intent | nothing |
| `answered` | an answer with cited claims | nothing |
| `simulated` | settlement is not `XRPL TESTNET · no real value` | "Simulated payments leave nothing on the ledger…" |
| `anchor_pending` | no `ledgerAnchor` yet, run ended under 2 min ago | "Sharing opens once the answer is anchored on XRPL…" (polls ≤ 2 min) |
| `anchor_missing` | no anchor after 2 min, or a recorded anchor failure | "No ledger anchor is recorded…" |
| `private_question` | question has a key or an email address (same pattern as the hosted gateway) | refused with the reason |
| `too_large` / `verification_failed` | snapshot over 256 KiB, or the offline checks fail | refused with the reason |

Sharing is **explicit**: the decline view shows "Share proof of refusal"; a second step names the question that will be
public (hosted) or says nothing leaves the computer (local) before anything is written.

## The snapshot (`ProofSnapshotSchema`)

Built once, from a whitelist, then frozen. One proof per run; a second share returns the first.

- the question the visitor chose to publish; asked and shared times; environment (Testnet; fixture or live models; hosted or local);
- found: paid-article count, writers, and up to 12 rows of title, writer, price and a plain-words verdict (never model text or scores);
- bought: 0 articles, S$0.00;
- the anchor: transaction hash, ledger index, account, audit head;
- the run's own receipts bundle (`/proof/<id>/receipts.json`), sanitized: free-tier sources and the hash-chained audit rows
  of this run only. Other runs' rows are opaque hash links; `requirements` are dropped. `sanitizeBundle` throws if the export
  carries a payment, grant, key reveal, paid text or another run's row;
- the offline verification result at share time (`verifyAnswer`, no network).

Never included: premium text or keys, signed blobs, payment seeds, other sessions' questions, runs or principals.
The run's own audit rows carry the session's pseudonymous principal (a SHA-256 of its cookie), because the audit hash covers it.

## Storage and immutability

Table `refusal_proofs` in the app database, so hosted retention and backups cover it. `UPDATE` is blocked by a trigger,
`DELETE` is blocked until the row's retention date, and every read recomputes the stored digest, so a row altered behind
the triggers is not served. Hosted retention: promised only "through 19 November 2026" (the demo's providers end 20 Nov 00:00 SGT and its VM stops 20 Nov 00:30 SGT); kept until 19 Nov 16:00 UTC, or two days after creation if later; local: ten years.
Hosted caps: 5 proofs per session per day, 400 in all, 256 KiB each. A retention sweep (hosted, every minute) deletes only expired rows.
Clearing history, pruning run bodies or deleting the run does not remove a shared proof; it is a snapshot.

## Routes

| Route | Who | Notes |
|---|---|---|
| `GET /api/runs/:id/proof` | owner | `{ eligible, code?, message?, proof? }`; reads only |
| `POST /api/runs/:id/proof` | owner | 201 created, 200 existing, 409 + code, 429 `proof_limit` |
| `GET /proof/:id` | public | HTML, link-preview metadata, CSP with a nonce, `noindex` |
| `GET /proof/:id/receipts.json` | public | the sanitized bundle for `verify:answer` and the in-browser check |
| `GET /proof/:id/card.html` | public | self-contained download: no script, no network, receipts embedded |

Hosted: the owner routes go through the gateway's run-ownership check, so another session gets `404`. The public routes mint
no session and set no cookie, accept only `GET`/`HEAD` with no query, and share the writer pages' 120 reads per minute per address.
`/proof/` is routed to the API by Vite, both nginx configs, the app server and the desktop shell.

Desktop shell (11 Nov): `GET /proof/<id>` is served with the page's own policy and nothing added, so its nonce'd script runs (the shell's
`script-src 'self'` would block it); the policy is passed through only if `acceptableProofCsp` (`desktop/policy.mjs`) finds it deny-by-default
with the page, a nonce, data images and the two Testnet nodes as its only allowances, otherwise the shell's policy is added as for any
other response. The app shell's own policy gains exactly those two `wss://` origins (so the in-app "Verify in your browser" works on Testnet
runs) and its request filter lets exactly those through. "Open proof page" opens `/proof/<32 hex>` in its own window, which cannot navigate
away. Without a public address a proof has no link worth copying: the app shows no URL and no "Copy link", only the card to send.

## The page

Server-rendered (works for link previews, screen readers and phones without our app). "Verify on XRPL in your browser" loads
`/verify/proof-verify.js`, the same lazy verifier the app uses (own stable entry in `vite.config.ts`, no app boot), fetches
`receipts.json` and runs `sdk/verify.ts` client-side with read-only `tx` lookups on public Testnet nodes. The page states one total: the
ledger-record row reads "13 of 17 checks passed when shared" and the button's result "15 of 17 checks passed", naming what the browser
skips (writer credentials: they cannot be checked from the receipts alone). The header chip stays on a phone in a short form
("Testnet demo · no real value"). Link preview:
`og:title` "Refused to spend · verified on XRPL", a per-proof `og:description` with the question, and one static card,
`public/og/refusal-proof.png` (`node design/brand/build-proof-og.mjs`).

## What it does and does not prove

Proves: the run's signed audit log has no payment for the question, and that log's fingerprint was written to XRPL Testnet
before anyone looked at the page. Does not prove: that declining was right, anything about paid text (none was delivered), or
real money (Testnet test funds). The card carries the environment label: fixture or live models.

## Not done

Unsharing; a per-proof rendered preview image (the question travels in `og:description`); proofs of free-source answers.
