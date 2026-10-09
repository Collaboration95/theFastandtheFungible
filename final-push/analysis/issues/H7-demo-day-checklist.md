Owner checklist for Sat 10 Oct. Most items are human steps.

**Decisions**
- [ ] **v1.2 UI work** (uncommitted in the main checkout): decided 8 Oct. The agents ship it in PR 1 by **Fri 10:00 SGT**, after `npm run verify` passes. Never land it between rehearsals.
- [x] **Fallback policy:** decided 8 Oct. No decision fallback: if live Clef fails, the round fails and nothing is bought (H3).

**Cloudflare daily allowance** (decided 8 Oct)
- [ ] For now: stay on the free plan, with the friend's account (`CLOUDFLARE_API_TOKEN_2`) as the backup.
  - Add its account ID to `.env` as `CLOUDFLARE_ACCOUNT_ID_2`.
  - The swap is `CF_BACKUP=1 make live` (#196).
- [ ] Later: upgrade the demo account to the US$5/month plan, then retire the backup.
- [x] No batch jobs on rehearsal or demo days (benchmarks, `make embeddings` sweeps, `make corpus`). Stop at the first quota error and swap.

**Decision model (M1)**
- [ ] The OpenAI Decisions key has credit, and `make preflight` checks it.
- [ ] Rehearse with the provider the live comparison chose.
- [ ] Know both reverts:
  - `DECISION_PROVIDER=cloudflare`, then restart;
  - the tag `known-good-2026-10-08`.

**Stage cut (decided 8 Oct), Sat 10 Oct by 08:30 SGT**
- [ ] On the latest `main`: reset reputation, `make preflight`, `make smoke`.
- [ ] If both pass, tag that commit `demo-oct10` and present it. Otherwise present `known-good-2026-10-08`.

**Before every rehearsal and before the slot**
- [ ] `make preflight` (H2).
- [ ] Reset reputation (Presenter "Reset reputation" or `make reset`). A leftover quarantine kills the UC3 refund scene.

**Rehearsal**
- [ ] Rehearse UC3 live twice. Its gap_material swings 0.33–0.53 against the 0.15 bar.
- [ ] Watch UC2 round 2 for a second purchase. One recorded round 2 had gap_material 0.40 with S$1.10 left.
- [ ] Check the offline fixture backup (`make run`) once on the presenting laptop.

**Housekeeping**
- [ ] Refresh STATUS "Needs you". It still lists O1, O3 and O4, and still says `.env` has `LLM_PROVIDER=groq`.
- [ ] Decide whether the "second account" wording in the public bench branch (`protocol-deviations.md`, `summary.json`) should be reworded before the talk. The talk leads with Cloudflare.
