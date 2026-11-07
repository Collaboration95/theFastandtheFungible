# Short description: three lengths

For the SingHacks finals form (Ripple track). Pick the tier that fits the field.
Every claim is merged and dated; the label check at the bottom maps each one to
its PR or evidence file. Facts as of **7 Nov 2026**.

`{{…}}` marks a number or link from work still landing. Replace each one before
pasting, or delete the sentence it sits in (see [README](README.md#placeholders)).

## ~50 words

ResearchAgent is research with a wallet. It answers from free sources, then buys
the missing article from its writer over x402 on XRPL, inside your budget. Only
policy code can spend. The writer is paid only by publishing the article key on
the ledger. One command runs it on XRPL Testnet and verifies the result.

## ~150 words

ResearchAgent is an AI agent that does research with a wallet. It answers from
free sources first, then buys only the article that fills the gap, paying the
writer over x402 on the XRP Ledger. A model judges what is worth buying, but only
deterministic policy code can spend, and never past your budget.

Since SingHacks we have merged 183 pull requests. The writer is now paid by
*key reveal*: their EscrowFinish publishes the article's decryption key on the
ledger, so delivery and payment are one transaction. The same escrow settles in
a stablecoin-style test token. Two independent verifiers, one of them Python with
no Node, re-check every receipt against the ledger.

Try it with no clone:
`npx -y <release>/researchagent-mcp-1.0.0.tgz try --testnet`. It
finished in 84 s from an empty cache, with six Testnet links and `RESULT PASS`.

Everything runs on XRPL Testnet (no real money). The research writers are
fictional; the TEST-SGD token stands in for RLUSD.

## ~300 words

ResearchAgent is an AI agent that does research with a wallet. You ask a question
and set a budget. It answers from free sources first, then buys only the article
that fills the gap, paying the writer directly over x402 on the XRP Ledger. A
decision model judges what is worth buying, but only deterministic policy code can
spend, and never past your budget. Five hard gates hold on every run, and a
read-only audit checks them.

What's new since SingHacks (183 merged pull requests, 11 tagged releases):

- **Key-reveal escrow.** The buyer locks payment in a native XRPL Escrow whose
  condition is the hash of the article's key. To get paid, the writer must
  publish that key in the EscrowFinish, so delivery and payment are one ledger
  event. The buyer decrypts and checks every promised passage; a broken promise
  is refunded.
- **Stablecoin escrow.** The same flow settles in TEST-SGD, our Testnet token,
  through XLS-85 token escrow. Official RLUSD payments work on Testnet; RLUSD
  escrow waits on one issuer flag, which we document as builder feedback.
- **Verify, don't trust.** TypeScript and Python verifiers re-check receipts
  against the ledger. Our public ledger page re-validates 45 transactions in
  about 2 seconds.
- **Zero clone.** One line runs the whole judge path on Testnet in 84 s and ends
  with `RESULT PASS`:
  `npx -y <release>/researchagent-mcp-1.0.0.tgz try --testnet`.
  The same package is an MCP server for Claude Code and a local web app.
- **Writers in one command.** A Markdown folder becomes a Testnet writer with an
  XRPL Credential in 44 s.

Proof: [release v1.0.0](https://github.com/Collaboration95/theFastandtheFungible/releases/tag/v1.0.0) ·
[browser replay](https://collaboration95.github.io/theFastandtheFungible/demo/) ·
[live ledger check](https://collaboration95.github.io/theFastandtheFungible/ledger/).

What is real and what is not: payments settle on **XRPL Testnet**, with no real
money. The research writers are fictional. A team-authored writer answers XRPL
questions from our own build notes; it is labelled and is not an independent
writer. TEST-SGD is our own token, a stand-in for RLUSD. There is no hosted
instance: everything runs on your machine. Mainnet is disabled in code.

## Label check (for whoever pastes these)

| Claim | Label | Source |
|---|---|---|
| "183 merged pull requests" | 21 Sep–7 Nov 2026 SGT, `main` | `gh pr list --state merged` filtered to after 20 Sep |
| "11 tagged releases" | v0.1.0–v0.8.0, v1.0.0-rc.1, rc.2 (pre-releases), v1.0.0 | `gh release list` |
| Key-reveal escrow, refund | XRPL Testnet, fixture models, fictional writers; the refund after a finish is writer-signed (the fixture writer cooperates) | [#377](https://github.com/Collaboration95/theFastandtheFungible/pull/377), [#379](https://github.com/Collaboration95/theFastandtheFungible/pull/379), [key-reveal-escrow.md](../key-reveal-escrow.md) |
| Stablecoin escrow | TEST-SGD · IOU issued by our Testnet issuer · no real value · stand-in for RLUSD | [#381](https://github.com/Collaboration95/theFastandtheFungible/pull/381), [#384](https://github.com/Collaboration95/theFastandtheFungible/pull/384), [m1-iou](../evidence/m1-iou/README.md) |
| "Official RLUSD payments work on Testnet" | Official Testnet RLUSD issuer, UC2 0.90 paid, UC3 0.30 refunded, 3 Nov | [rlusd.md](../evidence/rlusd.md) |
| "RLUSD escrow waits on one issuer flag" | Issuer flags 2174353408 lack AllowTrustLineLocking; predicted refusal, never submitted | [BUILDER-FEEDBACK §1](../BUILDER-FEEDBACK.md#1-issuer-permission-blocks-rlusd-escrow) |
| "45 transactions in about 2 seconds" | 45/45 in 1.97 s, one read-only measurement, 7 Nov | [#388](https://github.com/Collaboration95/theFastandtheFungible/pull/388), [live-ledger.json](../evidence/round4-l4/live-ledger.json) |
| "84 s … `RESULT PASS`" | One cold run (empty npm cache, fresh faucet wallets), 84.2 s, 7 Nov. Two of four cold attempts finished under the 90 s deadline | [#387](https://github.com/Collaboration95/theFastandtheFungible/pull/387), [round4-j2](../evidence/round4-j2/README.md) |
| "Credential in 44 s" | 43.8 s cold, synthetic starter notes, public faucet | [#378](https://github.com/Collaboration95/theFastandtheFungible/pull/378), [round3-c](../evidence/round3-c/README.md) |
| Team-authored writer | team-authored · real content · not an independent writer · Testnet; v2 held-out 8/20; v1 dev 16/20 buy-and-cite | [#390](https://github.com/Collaboration95/theFastandtheFungible/pull/390), [J5 evidence](../evidence/j5-coverage/README.md) |
