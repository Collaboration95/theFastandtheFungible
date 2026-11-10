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
