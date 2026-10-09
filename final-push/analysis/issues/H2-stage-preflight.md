**Why:** `make doctor` and `make keys` can pass while the production path fails:
- They call Clef once, with an 8 s timeout (`scripts/doctor.mjs:110`). Production runs 9 parallel calls at 3 s.
- They miss two stage-killers:
  - **Leftover reputation.** If a rehearsal leaves AlphaLeak quarantined, UC3 round 1 shows `SKIP_LOW_TRUST` and the refund scene never happens.
  - **An exhausted daily Cloudflare quota.** Saturday's UTC day starts at 08:00 SGT, so morning rehearsals share the demo's allocation.

**Write scope:**
- `scripts/doctor.mjs` (a new `--stage` mode) and `scripts/demo.mjs` (the backup swap)
- `Makefile` (a `preflight` target)
- one checklist line in `docs/PRESENTATION-READINESS.md`

**Do:** `make preflight` checks the following. Everything is read-only apart from the Clef calls.
- `CLOUDFLARE_ACCOUNT_ID` is set; warn when discovery would be needed.
- **One decision-shaped round:** one `judgeRound` and 8 `judgeCandidate` calls in parallel, at the **server's** timeout. Report the slowest call and any failure.
- **Quota:** a 429 with code 4006 is reported as "daily free quota exhausted (resets 00:00 UTC = 08:00 SGT)".
- **Reputation is clean:** no publisher quarantined or delisted, and all at their prior. Read it through the API or the store.
- The count of unfinished or stale runs in the store.
- The existing settlement and XRPL payer-balance checks.

- **Backup credentials** (owner decision, 8 Oct: the friend's separate account is the backup until the US$5 plan):
  - Check that the backup pair (`CLOUDFLARE_API_TOKEN_2` plus its account ID, stored as `CLOUDFLARE_ACCOUNT_ID_2`) answers one cheap embedding call.
  - Add a one-line swap: `CF_BACKUP=1 make live` (in `scripts/demo.mjs`) maps the `_2` pair onto the primary variables for every Cloudflare client in that process, without printing values.

Print one PASS or FAIL line per check.

**Acceptance:**
- It finishes in under 15 s and exits non-zero on any FAIL.
- Unit tests cover the reputation and quota parsers with fixtures, with no network.

**Depends on:** H1, for the shared timeout value.

---
**Rules:** read `AGENTS.md` and `FINAL-PUSH.md` first; decisions are closed, and the hard gates are in `prompt.md` §2.
- Work in `../tftf-wt/<id>` and stay inside the write scope.
- Never bind 5100, 8788 or 8790.
- `npm run check:fast` must pass.
- Ship with the `ship-pr` skill.
