# Local release rehearsal, 10 Nov 2026

Lane R, fixture providers and simulated settlement only. No remote tag push,
release creation, registry publication, live model call or Testnet purchase.
Port offset 1200; browser/engine tests use ephemeral ports.

## Retained unsuccessful attempt

The Node 22.13.0 full gate passed all 19 steps on clean temporary version/tag
`v1.0.3-rc.1200`, source `6262164ca5a1e3d1d973a9a7c2c687f8d202354d`.
Full soak completed 200 warmups, 2,000 measured asks, zero workload failures,
burst and 20 restarts, but **failed acceptance**: RSS slope 5.688 MiB/100 asks
(limit 5), loop p99 188.744 ms (limit 50). RSS median, maximum and latency passed.
Host load at acceptance start was 20.01 / 28.25 / 17.91 on ten CPUs.
This does not establish whether runtime, contention or product behavior caused
the miss. The supported Node 26 runtime is qualified separately.

[node22-failed-acceptance.json](node22-failed-acceptance.json) preserves the
partial acceptance report. After coverage floors, Python, replay/ledger/browser,
site and other checks passed, remaining work was explicitly terminated to avoid
running known-failed packaging/chaos beside the next isolated soak. It is neither
complete nor accepted. [Raw soak](node22-failed-soak.json.gz) preserves all asks,
samples and intervals (gzip); [summary](node22-failed-soak-summary.json) records
the uncompressed SHA-256. No threshold or assertion was changed.

An earlier Node 22 setup attempt was interrupted during the gate after detecting
an overbroad temporary lockfile version replacement. Only root lock version
metadata was corrected before the measured attempt above. Both rehearsal version
commits are reverted before shipping; direct dependency versions remain unchanged.

The publisher's default path always performs a fresh full gate and full local
all-architecture acceptance. It stops before publication when any stage fails.

## Completed contended Node 26 attempt

Source `f08939aa`, temporary tag/version `v1.0.3-rc.1200`, Node 26.3.1.
Full gate passed 19/19. Full acceptance ran to completion (1,642.561 s) and
**failed**; the publisher exited nonzero before any tag push/release creation
([actual stdout/stderr](node26-publisher-refusal.log)). Host load at acceptance
start was 47.70 / 40.68 / 28.10 on ten cores. The orchestrator subsequently
reported peak host load 93 and mandated a shared heavy-run lock.

Full soak: 2,000 asks, 200 warmups, 20 restarts, zero failed asks; RSS slope
1.701 MiB/100 asks (limit 5), median delta -7.990 MiB (limit 100), maximum
881.309 MiB (limit 1536), latency p95 drift -173.317 ms (limit 250) all passed.
Loop p99 **278.921 ms failed the unchanged 50 ms limit**.

Both unsigned DMGs, native arm64 recovery (13 cases), release artifacts, five
installed consumers, both receipt verifiers, Python, replay/ledger/site checks
and full 200-episode chaos passed. Coverage hit a 30 s timeout in unchanged
`tests/character.test.tsx`; the app browser hit the known popover overlap at
`tests/ux2.spec.ts:159` owned by lane GF. Coverage floors/check-fast correctly
remained blocked rather than reporting success. These are retained failures,
not an accepted release. [Full report](node26-contended-acceptance.json),
[raw soak](node26-contended-soak.json.gz), [summary](node26-contended-soak-summary.json).

The owner permits lane R to merge with documented host-load performance misses
only after all non-performance checks pass and refusal is demonstrated. The
real v1.1.0 release still needs full quiet-host acceptance. No threshold changes.
All subsequent heavy runs use the orchestrator's shared heavy-lock.sh.

## Publisher regression checks

On rebased main, Node 22.23.4 passes six local-release tests and 33 CI-contract
tests, TypeScript and targeted ESLint. The real publisher CLI runs against
isolated local Git remotes with fixture package/test producers: failed acceptance
prevents both tag push and release creation; successful dry-run stages admitted
hashes, both DMG aliases and annotation notes with prerelease/Latest flags and
no remote publication. These fixtures check orchestration, not real packaging.

The shipping PR is [#433](https://github.com/Collaboration95/theFastandtheFungible/pull/433).
GF merged as #434 (`d63049ac`) on 11 Nov; this branch has rebased onto it.
Local-gate Git/GitHub CLI captures now share a 64 MiB output buffer, with a
regression that exercises pending/success/failure publication using 2 MiB
commit responses and a 2 MiB Git blob (16 runner tests pass).
The temporary rehearsal versions/tag will be removed before merge.

## Locked Node 22 rehearsal, 11 Nov

Source `e03a0a41`, Node 22.23.4, full gate 19/19 PASS. Full acceptance completed
in 658.095 s, but failed and publication stopped. Starting load was
4.72 / 7.04 / 6.90 on ten CPUs; later load fell below three. Do not attribute
this quieter-host RSS miss to the earlier load-93 contention.

The complete 2,000-ask soak (200 warmups, zero failed asks, passing burst and
20 restarts) missed RSS slope at **5.179450 / 5 MiB per 100 asks**. Median delta
92.063 / 100 MiB, max 746.703 / 1,536 MiB, loop p99 33.473 / 50 ms and latency
drift 65.967 / 250 ms passed. Separately, payments line coverage was
2,621 / 2,654, one covered line short of the unchanged 2,179 / 2,206 baseline.
All other acceptance rows passed, including both DMGs, arm64 recovery, packages,
five consumers, both verifiers, browsers and 200 chaos episodes (zero violations).

[Full acceptance](node22-locked-acceptance.json), [raw soak](node22-locked-soak.json.gz),
[soak summary/hash](node22-locked-soak-summary.json),
[gate](node22-locked-full-gate.json), [publisher refusal](node22-locked-publisher.log)
and [coverage floor failure](node22-locked-coverage-gate.log) retain the result.
The publisher correctly refused this run; it does not qualify for a
performance-only merge exception. A durable finish-retirement/restart regression
test adds missing payment recovery coverage without changing product code or
coverage floors. A fresh full rehearsal follows on supported Node 26.3.1.

## Locked Node 26 repeat, 11 Nov

Source `8ee186de`, full gate 19/19 PASS, acceptance 664.126 s FAILED. The new
journal test lifted payments lines to 2,628 / 2,654, passing their floor. The
coverage gate then exposed server lines at 3,714 / 3,953, seven covered lines
below its unchanged 2,499 / 2,655 baseline. Every other component floor passes.
The direct audit-export router test addresses that separate gap; existing export
scenarios exercise child processes. The complete coverage check will run before
the next full publisher attempt. No baseline or product code changed.

Full soak: 2,000 asks, zero failed, passing burst and 20 restarts. RSS slope
**19.706597 / 5 MiB per 100 asks** and median growth **419.584 / 100 MiB** failed;
max 1,455.294 / 1,536 MiB, loop p99 32.391 / 50 ms and latency drift
14.740 / 250 ms passed. Starting load was 8.66 / 8.53 / 7.19. These are measured
memory misses, not proven host-load noise. All other acceptance rows passed.
Publication correctly stopped; this still has a non-performance failure.

[Acceptance](node26-locked-acceptance.json), [raw soak](node26-locked-soak.json.gz),
[summary/hash](node26-locked-soak-summary.json), [gate](node26-locked-full-gate.json),
[publisher refusal](node26-locked-publisher.log),
[coverage failure](node26-locked-coverage-gate.log).
