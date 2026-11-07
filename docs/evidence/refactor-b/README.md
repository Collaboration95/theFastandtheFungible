# Lane B: parallel browser admission

Fixture app and judge checks; replay observations retain live read-only Testnet
hash checks and both full 60-second observation windows. No spending authorized.

The required browser job runs three independent groups and explicitly waits for
all three exit statuses. Demo tests run fully parallel with four workers; judge
retains its serial shared server. Output directories are separate. A single
Vite replay build in this job supplies both suites. SHA-256 checks of every
output file run before and after consumption. Nothing is restored from another
SHA or workflow run. Clean release consumers and their manifests are unchanged.
The requiredJobs list and aggregate needs are unchanged because no job was split;
CLI regressions now cover every required job's failure, cancellation, skip and
missing result. The docs-only skip predicate is unchanged.

All five previously omitted specs passed locally: ux, ux2, settings, foundation,
perf (11 tests, 25.5 s including build/startup). CI enables the full default
Playwright match rather than maintaining a second file list. No assertion,
coverage floor, timeout or performance threshold changed.

Chromium download caching uses the exact installed Playwright version and OS;
system dependencies still install. Retention is of browser binaries only, never
acceptance results. pip wheels are not cached: the baseline pytest installation
finished in about two seconds; there is no measured net-saving case for another
cache restore/upload. Consumers continue installing clean.

Package review found no source imports for Bricolage Grotesque or Newsreader;
Geist and Geist Mono remain. The private root bin pointed at a nonexistent .mjs
file (the supported publisher command uses .ts) and was removed with lock data.

## Measurements

before.json pins the five latest successful main runs before this lane, including
job and step timestamps. This refresh differs from the audit's historical
355 s median; preserve that historical figure when comparing the stated target.
Local judge: 10/10 passed, 57.2 s. Local demo: 4/4 passed, about 63 s;
both minute observations ran concurrently. Local packed consumer acceptance uses
exact generated manifests; generated sizes: MCP tgz 3,462,192 bytes, MCPB
3,291,559 bytes, SDK tgz 89,744, wheel 113,069, sdist 107,473. All below 8 MB.
After measurements will be recorded after Actions completes.
The >=50 net LOC deletion target is not met; no unrelated build code was deleted
to manufacture a count. No portable shared-chunk changes were made in C's lane.

Nothing loosened.
