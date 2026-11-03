# Lane Z: zero-clone installation

4 November 2026. Fixture providers, fictional corpus, simulated settlement only.
Local file URLs stand in for unpublished release URLs. No tag or publication.

No developer checkout is used by the installed consumers. The harness supplies a fixture HTTP engine for the SDKs; SDKs are clients, not engine distributions. MCP npx boots its own engine and publisher. Node v26.3.1, Python 3.14.7, macOS arm64. Each single-run wall time includes installation and the first cited answer plus the idempotency retry and validation; Python also includes venv creation and offline receipt verification. SDK timing excludes fixture engine setup; these are client installation timings, not cold hosted-service provisioning. npm may use its existing dependency cache; npx uses a fresh cache.

- TypeScript: 1.024 seconds.
- Python: 1.845 seconds.
- MCP npx: 13.587 seconds.

All five consumers pass exact delivered citations, one verified receipt/intent, same-key retry and the 200-minor cap. JSON files bind these historical local bytes to their hashes; CI rebuilds and checks landing bytes.

Verified today from `/tmp` with a fresh venv:

```sh
pip install "git+https://github.com/Collaboration95/theFastandtheFungible#subdirectory=packages/sdk-python"
```

The pip installer internally fetches Git; the developer needs no checkout. npm has no native git-subdirectory equivalent, so no such command is claimed. Local SDK installation and MCP npx are verified by the consumer runner. Release URLs are generated only with `node scripts/install-snippets.mjs --tag v1.0.0` after owner publication. No release asset URL is linked in README; an offline regression rejects them. No gates or thresholds were loosened.
