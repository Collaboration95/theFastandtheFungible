# UO-10 verification evidence

Date: 2026-09-20
Environment: Windows, Node/npm from the shared checkout, fixture LLM and fixture settlement

## Package gates

| Package | Result | Changed paths | Evidence | Remaining limitation |
| --- | --- | --- | --- | --- |
| UO-07 centered workspace | PASS | `src/App.tsx`, `src/styles.css` | `tests/uo-07-10.spec.ts`; width captures 360/390/768/1024/1440 | Overview, Sources, and Activity are mutually-exclusive accessible tabs; history/library remain intentionally unavailable |
| UO-08 exact approval/recovery | PASS | `src/App.tsx`, `src/ui/index.tsx`, `src/styles.css` | Existing purchase E2E plus focused cancel/focus-trap test; fixture labels and no-retry unknown state | Live XRPL settlement and real access recovery remain external gates; not exercised |
| UO-09 answer/citations | PASS | `src/App.tsx` | Existing open-only/premium-only E2E; citation buttons and protected-preview labels in focused screenshots | Live-provider synthesis is not exercised; fixture answer remains synthetic and labelled |
| UO-10 responsive/a11y evidence | PASS | `tests/uo-07-10.spec.ts` | 4 focused tests passed; reduced-motion, 200% zoom, and keyboard-tab checks | Qualitative pilot **NOT RUN**; demo rehearsal **NOT RUN** |

## Retained captures

- [Desktop workspace at 1440px](workspace-1440.png)
- [Mobile workspace at 390px](workspace-390.png)

These two captures are representative review evidence, not proof of the full
responsive matrix. The automated run covered 360, 390, 768, 1024, and 1440
CSS-pixel widths; the other transient captures were intentionally removed.

## Commands actually run

```text
npm run typecheck                         PASS
npm test                                  PASS (22 tests)
npx playwright test tests/uo-07-10.spec.ts --reporter=line
                                           PASS (4 tests)
npm run test:e2e                           PASS (17 tests)
npm run test:a11y                          PASS (standalone baseline; also included in full E2E)
```

The default lane never uses a funded wallet, live publisher, or paid LLM. The
purchase modal's explicit confirmation remains separate from plan approval;
cancel is side-effect free, and an unknown confirm outcome disables retry so a
second submission cannot silently double-settle.
