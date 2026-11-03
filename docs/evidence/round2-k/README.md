# Independent Python receipt verification

LOCAL offline evidence, 4 November 2026, based on main #350 (472ac268).
No live providers, Testnet queries/transactions, real funds or semantic assessment.

Both runners consume `tests/fixtures/receipt-conformance/manifest.json` with explicit
expected verdicts and declarative field mutations. Nine goldens: original verify-278,
round2-f v1/v2, round2-g useful/redundant/refunded v3, both historical RLUSD exports,
and a locally signed secp256k1 free-source fixture. Historical Testnet labels are
preserved; this verification did not look up their ledger transactions.

| Receipt version | Golden | Invalid | Total |
|---|---:|---:|---:|
| v1 | 5 | 69 | 74 |
| v2 | 1 | 17 | 18 |
| v3 | 3 | 78 | 81 |
| Legacy unsupported report | 0 | 1 | 1 |
| Total | 9 | 165 | 174 |

Agreement: **174/174, 100%**, each also matches the manifest expected verdict.
`results.json` records exact counts and Python timing. TS fixture execution was
2.02 seconds locally (175 tests including schema drift guard); Python whole SDK
suite was 9.26 seconds (202 tests). These are local timings, not performance SLAs.

Mutations cover origin, signing key/signature, manifest, passage/salt, signed claim,
receipt version, grant, amount, retention/citation and audit links/hashes/head.
Legacy retention extensions are rejected; retained-claim semantics only exist in
v3. v3 link mutations include every link field. The packet incorporates both
verify-278 tampered and unsupported pre-bundle fixtures. Mutation generation is
repeatable and does not use verdicts to choose expected outcomes.

Every Python conformance case replaces socket creation, DNS lookup, connection
helpers and subprocess.Popen with failing sentinels. It runs solely against local
JSON plus packaged schemas/curve code. Additional tests cover CLI exit codes,
independent audit heads, canonical JSON, RFC8032 known-answer vector and secp256k1
DER signing/verification. The shared secp fixture was signed independently by TS.
No TS verifier semantics changed and no TS verifier bug was found.

Python verifies Ed25519 and secp256k1 writer signatures, wallet derivation and
manifest domain bytes, with no delegated checks. It vendors MIT ecdsa 0.19.1 and
six 1.17.0 with licenses and pinned wheel hashes. No external runtime dependency
is needed; strictly speaking it is stdlib plus vendored curve code. Node wrapper
remains available only through explicit `Client.verify(..., repo_dir=...)`.

Reproduce:

```sh
node --import tsx scripts/receipt-conformance.ts
npx vitest run tests/receipt-conformance.test.ts
python3 -m pytest packages/sdk-python
npm run check:fast
make release-artifacts
node scripts/check-release-consumers.mjs --manifest dist/release/manifest.json
```

The wheel and sdist build and all three clean release consumers pass locally.
The installed wheel CLI is also exercised from an isolated temporary directory,
with no source path, no dependency install and no Node in PATH. Publication is
owner-only and was not performed. CI and squash merge status are reported in the
PR handoff, not inferred from these local results. No gate/threshold was loosened.
