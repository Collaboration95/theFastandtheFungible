# Publish your own expertise

From a clone with Node 22.13+ and `npm ci`, turn a Markdown folder into a local
writer that UI and MCP agents can search and pay:

```sh
cp -R examples/writer-starter my-notes
npm run publish:site -- ./my-notes
# Beside another stack: OFFSET=800 npm run publish:site -- ./my-notes
```

The command serves the site, signed manifests and an x402 facilitator on loopback,
creates and faucet-funds an **XRPL Testnet** wallet, and prints the time to ready.
Keep it running and use the printed `PUBLISHER_URL` with the UI/MCP engine.
It also registers the writer in the ignored `data/local-writers/` directory;
the next normal publisher start includes it alongside the built-in writers.
Stop that site before starting the normal stack on the same port. Ctrl-C stops
the host; rerun the same command after edits. Use `--slug my-name`, `--name "My Name"`,
`--port 9590`, or `--rail simulated` for an explicitly labelled offline run.
`node scripts/publish-site.mjs ./my-notes` is the equivalent repo-local bin entry.

Each top-level `.md` file needs scalar front matter (plain or quoted values):

```markdown