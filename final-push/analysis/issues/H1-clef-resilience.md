**Why:** Clef-flash stays the one-line revert after the Luna switch (M1), and Workers AI also serves search embeddings. A live Clef round can die on stage in three ways. All three were verified at HEAD `77e01d8`.

1. **Account lookup.** `ClefDecisionProvider.resolveAccount()` caches its promise with `this.account ??= this.request('/accounts')…` (`server/agents/clef.ts:98`).
   - A rejected lookup stays cached for the life of the process.
   - The startup call swallows the failure (`server/routes.ts:43`).
   - `CLOUDFLARE_ACCOUNT_ID` is not set in the demo `.env`.
   - So one network blip at boot turns every decision in the session into a labelled fixture fallback.
2. **429 stall.** On HTTP 429 the client sleeps for `Retry-After`, up to 60 s, then retries (`clef.ts:73-89`).
   - The daily-quota 429 (Cloudflare error code 4006, "Daily free allocation of 10000 neurons exhausted") will not clear in 60 s.
   - The stage freezes for a minute and then falls back anyway.
   - The decisions benchmark hit exactly this error on 8 Oct using the demo token (`bench/decisions/out/blocked-cloudflare.json` on `bench/decisions-vs-clef`).
3. **Timeout.** The live per-attempt timeout is 3 s (`clef.ts:83`), across up to 9 parallel calls (one round call plus 8 candidates).
   - `make doctor` uses 8 s (`scripts/doctor.mjs:110`), so it never sees the problem.
   - Measured per-call p95 is 1.4 s on a contended account, with a maximum of 3.1 s.

**Write scope:**
- `server/agents/clef.ts`
- `server/routes.ts` (the timeout option only)
- `.env.example` (document `CLOUDFLARE_ACCOUNT_ID`)
- a new `tests/clef-transport.test.ts`

**Do:**
- **Ops, no code:** set `CLOUDFLARE_ACCOUNT_ID` in the demo `.env`. Document it in `.env.example` as recommended for live runs.
- **Clear a rejected account promise** so the next call retries discovery:
  ```ts
  const p = this.request('/accounts').then(...)
  this.account = p
  p.catch(() => { if (this.account === p) this.account = undefined })
  ```
- **On 429:**
  - If the body's `errors[].code` is 4006, throw `ClefUnavailableError('daily quota')` at once, without retrying.
  - Otherwise cap the pause at about 2 s.
- **Timeout:**
  - Make the live timeout configurable (`CLEF_TIMEOUT_MS`), default 5 s, and keep 2 attempts.
  - Not 6 s: two attempts would then stall for 12 s.

**Acceptance:** mock-fetch tests, with no network:
- (a) The first `/accounts` call rejects and the second succeeds; the next `judgeRound` reaches the model.
- (b) A 429 with code 4006 makes one request, does not sleep, and throws `ClefUnavailableError`.
- (c) A 429 with `Retry-After: 60` pauses for at most about 2 s.
- (d) The configured timeout is honoured.
- The existing decision tests are unchanged.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- Work in `../tftf-wt/<id>` and stay inside the write scope.
- Never bind 5100, 8788 or 8790.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
