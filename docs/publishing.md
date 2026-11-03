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
