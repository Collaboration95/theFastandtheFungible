# Round 4 J3 · local writer onboarding

7 Nov 2026. Public XRPL Testnet faucet only; no real value, cloud resources or
live model calls. Node 26.3.1, macOS. This is a generated 300-word acceptance note,
not a consenting external writer or evidence of adoption. Its `synthetic: false`
exercises the author-supplied contract; the text explicitly labels its generated
acceptance purpose. Built-in models remain labelled fixtures.

## Current zero-clone timing after J2 integration

Fresh npm cache, newly packed slim MCP tgz (about 3.3 MB), fresh XDG state:

- `npx -y <tgz> init notes`: **1.396 s**, including cold installation.
- `npx -y <tgz> publish bad --testnet`: **1.510 s**, exit 1, field-level hints.
- `npx -y <tgz> publish notes --testnet`: **32.491 s** to validated Credential,
  first try with the retained 300-word author-contract acceptance note.
- Cold init plus publish: **33.888 s** (the separate malformed-note probe excluded).

All timing targets pass with the integrated slim package. The historical misses
below remain retained rather than being relabelled or omitted. Init reuses the
existing bundled publish entry and imports the starter snapshot statically; no
separate init file or JSON asset has to be copied by the slim release builder.
The bundled-extension test executes init after unpacking the MCPB and checks both
notes against the source examples byte for byte.

## Current slim-package buyer proof

The fresh-cache `npx <tgz> app --testnet` listed the new writer under
Writers · local · Testnet. The same scope query bought exactly one note by key
reveal. `slim-verify.txt` reports **PASS testnet 6/6; PASS audit anchor; RESULT PASS**.
The app's SDK/API surface was used, with explicit S$1/S$5 caps; no manual browser
acceptance or external-writer adoption is claimed.

- [CredentialCreate](https://testnet.xrpl.org/transactions/4AA1A23B93937026333CCE9EAB446823F06457D9771C5208C06C8B8C082E2CB7)
- [EscrowCreate](https://testnet.xrpl.org/transactions/5636C68E82096B570820608B9B4078C1E579568558BE8D6C876E98D716AE48F8)
- [EscrowFinish](https://testnet.xrpl.org/transactions/0FA6A2834B3EDBC721E648CB43EFF20A43AC6B035A566EF73896BB3403D7B0CF)
- [Answer anchor](https://testnet.xrpl.org/transactions/48E9DE629990CBC8F841B78B543E3C0B4C07438A043286A726CE41CE4E1237DB)

Current receipts: `slim-receipts.json`; timings and transaction details:
`slim-onboarding.json`. `slim-malformed.txt` retains all field-level hints.

## Historical timings before J2 integration

- Fresh-cache `npx -y file://<local MCP tgz> init notes`: **37.364 s**, including
  installation. Two commented examples were written successfully.
- Installed portable executable, malformed note: **0.428 s**, exit 1; all missing
  fields, invalid price, word count and paragraph errors printed together.
- Installed portable executable, fresh faucet writer → validated Credential:
  **33.203 s**. `timings.json` contains the independent fresh-wallet transaction.
- Repeating `npx -y <tgz> publish bad --testnet`: **45.903 s** including npm
  re-resolution. `npx … publish notes --testnet`: **68.693 s** including that
  overhead. These end-to-end tarball invocations **miss** the 3 s / 60 s targets.
  No code inside an npm package runs before npm installs/resolves it. The installed
  validation and provisioning paths meet those targets. Release/package-size work
  remains a follow-up; no timeout or acceptance threshold was increased.

The first author-contract note contained 300 generated method tokens and published
first try. A second 300-word generated methodology note (`acceptance-note.md`)
then exercised the full buyer loop. Local discovery listed `notes` through
`app --testnet`'s `/api/local-writers`. The ask used the app's authenticated SDK/API
surface (no manual browser acceptance), explicit S$1 per-call / S$5 daily MCP caps,
and the unchanged fixture decision threshold. `mcp/policy.ts`'s zero default is
unchanged. The UI budget/modal path remains covered by the existing suite.

## Historical buyer result

Question: `Quasar thermal drift calibration instrument readings observation methodology uncertainty measurement`

One purchase from local writer `notes`; key reveal, decryption and proof all
verified. `verify.txt`: **PASS testnet 6/6; PASS audit anchor; RESULT PASS**.
`receipts.json` is the exported bundle and can be verified independently.
`attempts.json` retains earlier no-purchase probes: the unchanged fixture judge
skips broad or weak keyword matches. This is a remaining discoverability limit,
not a reason to lower its threshold.

- [Publisher CredentialCreate](https://testnet.xrpl.org/transactions/2F11B77B777B97CDF7F4B4D52C58E66D0CD05DF17DCDBDEF0D6222DDBC659DA1)
- [Fresh installed-runtime timing CredentialCreate](https://testnet.xrpl.org/transactions/1184A32B55AB70A13695B181FD592806A9B5232F51B8485C292CDD249716EB45)
- [EscrowCreate](https://testnet.xrpl.org/transactions/49E2C8CB0AF19C825A050F7193CC95ABF9B21FF136C6AB2160C8947A4AD8EFD2)
- [EscrowFinish](https://testnet.xrpl.org/transactions/E1E70A2C6B9D926E254EE37D282E26D80FA4BDA9F9B8B1A793392D0B59375BC6)
- [Answer anchor](https://testnet.xrpl.org/transactions/1F6E8E753DC5DC19111459C22D83A7389F3DF73A53DF9F0D4962CE8FB49D00D4)

## Reproduce

Build the portable MCP package using the existing release-artifacts pipeline.
In a fresh directory with a private `XDG_STATE_HOME`, run `npx -y <tgz> init notes`.
Replace the examples with `acceptance-note.md` (one note), then run
`npx -y <tgz> publish notes --testnet`. Keep it running. With the same state dir,
run `app --testnet`, check Writers · local · Testnet, and ask the question above
with a S$1 budget. Export receipts after the answer anchor appears.

In a clone, verify this retained proof:

```sh
npm run verify:answer -- docs/evidence/round4-j3/slim-receipts.json --ledger
```

The portable runtime used for the live proof includes the new scaffold, validation,
ephemeral port and dynamic discovery. Final source additionally retains historical
error wording, documents explicit real-length waivers and avoids rehosting active
writers in the built-in publisher. Unit tests cover those final changes.

Real-writer limits are explicitly relaxed from 600–1,400 to 150–3,000. Explicit
`--relax` waives real-writer length only and persists its label. Fictional corpus,
benchmark, price, passage, leak, spending and one-charge checks remain intact.
