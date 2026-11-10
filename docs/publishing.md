# Publish your own expertise in three steps

Use Node ≥22.13. No clone is needed. These commands work in macOS/Linux shells and Windows PowerShell; start in an empty folder. Release v1.0.2 assets remain pinned.

<!-- BEGIN generated:writer-install -->
```sh
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.2/researchagent-mcp-1.0.2.tgz init my-notes
npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.2/researchagent-mcp-1.0.2.tgz publish ./my-notes --testnet
```
<!-- END generated:writer-install -->

The second command keeps serving until Ctrl-C. Edit the generated files before publishing your own work; unedited templates stay labelled SYNTHETIC.

1. **Create notes.** Use the `init my-notes` command above. This writes two
   commented, fictional examples. Replace their bodies with your own notes and
   set `synthetic: false`. Every note needs `title`, `abstract`, `tier` and
   `price`. Comments show optional fields too. Use `tier: FREE` with `price: 0`,
   or `tier: PAID` with, for example, `price: 0.10` (S$0.10). Keep public titles,
   abstracts and topic labels separate from paid answer text. Use at least four
   paragraphs. Real-writer notes allow **150–3,000 words**; fictional examples
   and benchmarks retain **600–1,400**. `--relax` explicitly waives only the
   real-writer length check; it never waives privacy, price or passage checks.
2. **Publish.** Use the `publish ./my-notes --testnet` command above. Validation
   reports field errors together before wallet creation, faucet funding or
   provisioning. npm itself must install the package before it can execute
   validation; reuse the same package/cache on retries. The command saves private
   state under `$XDG_STATE_HOME/researchagent/writers/` (default
   `~/.local/state/researchagent/writers/`), with wallet and registry files mode
   0600. It prints a validated CredentialCreate link and an ephemeral local URL.
   Keep it running. Optional: `--slug my-name`, `--name "My Name"`, `--port N`.
   Port 8790 is reserved and rejected. `--rail simulated` is labelled offline
   settlement and does not register a Testnet origin.
3. **Find and buy.** Run `npx -y https://github.com/Collaboration95/theFastandtheFungible/releases/download/v1.0.2/researchagent-mcp-1.0.2.tgz app --testnet`, using the same XDG
   state directory. Open **Writers · local · Testnet** and ask a question within
   your note's scope. Discovery also picks up writers published after app start
   (reopen the Writers tab to refresh its list). Budget approval authorizes
   deterministic policy to buy; the model cannot spend. Paid delivery uses
   key-reveal escrow. Export receipts and run `researchagent verify receipts.json
   --ledger` with the Python SDK, or `npm run verify:answer -- receipts.json
   --ledger` in a clone.

In a clone, steps 1 and 2 are `npm run publish:init -- my-notes` and
`npm run publish:site -- my-notes --testnet` after `npm ci`.

Only public XRPL Testnet faucet funds are used: **no real value**. Starter notes
are synthetic; author-supplied notes remain unverified. A local Testnet Credential
attests the wallet, not human identity, consent or article truth. The public
real-writers list is separate and requires consenting writers.

Local federation admits at most three numeric loopback origins, including the
built-in origin. Stopped registrations are ignored. Keep unused writers stopped
when the limit is reached. No bearer token or signing key is sent to a writer.
See [writer verification](writer-verification.md) and
[the federation evidence](evidence/round2-f/README.md) for the underlying contracts.

Front matter reference (the body below is abbreviated; `init` supplies full notes):

```markdown
---
title: My evidence note
tier: PAID
price: 0.10
abstract: A concise description of what this note establishes.
tags: research, evidence
synthetic: true
---

## Research scope
Explain the evidence, methodology and limitations here.
```
