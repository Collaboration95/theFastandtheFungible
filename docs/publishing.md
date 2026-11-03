# Publish your own expertise

From a clone with Node 22.13+ and `npm ci`, turn a Markdown folder into a local
writer that UI and MCP agents can search and pay:

```sh
cp -R examples/writer-starter my-notes
npm run publish:site -- ./my-notes --rail simulated
# Beside another stack: OFFSET=800 npm run publish:site -- ./my-notes --rail simulated
```

The command serves the site, signed manifests and an x402 facilitator on loopback,
uses labelled simulated settlement in the command above, and prints the time to ready.
Testnet is an explicit operator choice; it is not needed for this offline first run.
Keep it running and use the printed `PUBLISHER_URL` with the UI/MCP engine.
It also registers the writer in the ignored `data/local-writers/` directory;
the next normal publisher start includes it alongside the built-in writers.
Stop that site before starting the normal stack on the same port. Ctrl-C stops
the host; rerun the same command after edits. Use `--slug my-name`, `--name "My Name"`,
`--port 9590`, or `--rail simulated` for an explicitly labelled offline run.
`node scripts/publish-site.mjs ./my-notes` is the equivalent repo-local bin entry.

Each top-level `.md` file needs scalar front matter (plain or quoted values):

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

Use `tier: FREE` and `price: 0` for free articles. The starter folder contains
complete synthetic examples. Set `synthetic: false` only for your own real work;
this field labels provenance, not verification of a writer's claims. The parser
accepts scalar front matter and derives article identity from each filename.

### Independent local origins (Lane F)

`PUBLISHER_URLS=http://127.0.0.1:<port>,http://127.0.0.1:<port>,http://127.0.0.1:<port>` admits at most three operator-configured numeric loopback origins. `PUBLISHER_URL` retains singleton compatibility. This is the labelled pinned-local-origin finals topology; public remote federation is deferred. Discovery/search has one two-second deadline per origin, four HTTP slots, 50 writers/origin and 50 returned hits/query, with healthy partial results.

Federated runtime references carry `source` version 1: origin, signed seller public key, profileId, resourceId and version. `shared/source-identity.ts` supplies the canonical tuple and citation key. TS, Python and MCP preserve that identity; wallet reputation crosses hosts. Receipt bundles dispatch v1/v2 explicitly. Historical missing origins remain unresolved; invoices, signed manifests, blobs, audit entries and intent IDs are unchanged. New obligations save endpoint context before signing; removal prevents new admission while recovery uses the saved endpoint. No engine bearer, delivery token or payment signature is forwarded across origins.

Offline reproduction: `node --import tsx scripts/demo-multi-origin.ts --fixture --output scratch/multi-origin.json`. Evidence and migration handoff: `docs/evidence/round2-f/README.md`. The proof is synthetic, uses simulated payments and an explicit fixture judging/citation rubric, and does not establish adoption or live model quality.

### Get a verified writer identity

Ask the operator for its trusted credential issuer and type. That issuer vouches
for your seller wallet with Testnet CredentialCreate; accept with CredentialAccept.
The same seller wallet carries its identity across approved origins. Verification
attests identity, not article truth, and never changes purchase policy or prices.
See [writer verification](writer-verification.md) for setup, limits and revocation.
