# Owner upload packet

LOCAL fixture acceptance at source `02bdd39a2b490ae54da927907959e0012aaede3b`. These files have not been
published. Local runtime: v26.3.1, Python 3.14.7.
All three installed consumers: 8 delivered citations, one receipt/VERIFIED intent,
same-key retry reused the run, budget capped at 200 minor. Hashes below identify
this local build, not future CI builds (archive timestamps may change hashes).

| File in dist/release | Bytes | SHA-256 |
|---|---:|---|
| researchagent-sdk-1.0.0.tgz | 70855 | `3d6d13dffabc525df1a3d768a47de8bea781cc481947ba89ab52aa7740200068` |
| researchagent-1.0.0-py3-none-any.whl | 4708 | `bf66b3939dd2b5da39b69c381736b549c9ec210b345423abf9649dc12bc48955` |
| researchagent-1.0.0.tar.gz | 5824 | `7f3c98592ae9fc3175fcd2ef067b3b4c3c840ca9b844a077ea3e8b30a82aff87` |
| ResearchAgent.mcpb | 18929572 | `70468c7a1acbdd23900e3fc77ac73a39a9c7d1f7e3ae719ecbf4c701a9565b02` |
| server.json | 725 | `b33e9f04945c063f930a35945ba7bb6e586ffe73e41cf3b056f8493f5308ddac` |

Publication commands for the owner, after selecting the same-SHA accepted CI run:

```sh
# Use the merge/tag SHA's successful run; never reuse this historical local receipt.
gh run list --workflow ci.yml --branch main --status success --json databaseId,headSha
# Substitute the selected run's numeric ID; confirm headSha is the intended merged SHA.
gh run download RUN_ID --name accepted-release-artifacts --dir dist/release
node scripts/check-release-consumers.mjs --manifest dist/release/manifest.json
npm publish dist/release/researchagent-sdk-1.0.0.tgz --access public
python3 -m twine upload dist/release/researchagent-1.0.0-py3-none-any.whl dist/release/researchagent-1.0.0.tar.gz
cd dist/release
mcp-publisher login github
mcp-publisher publish
```

Before upload, compare the downloaded manifest sourceSha, file sizes and SHA-256
with the downloaded consumer receipt. The tag workflow performs this admission
automatically, builds unsigned DMGs, creates stable ResearchAgent-arm64.dmg and
ResearchAgent-x64.dmg aliases with desktop-manifest.json, and reuses accepted
SDK/Python/MCPB files. Root server.json is a template; upload the generated,
hash-pinned dist/release/server.json only. Never alter historical releases.

For a future 1.0.0 app release, first submit package.json/lock version changes in
a normal PR and merge on green. On its accepted merged SHA, the OWNER may run:

```sh
node scripts/release.mjs 1.0.0 "ResearchAgent finals" --dry-run
node scripts/release.mjs 1.0.0 "ResearchAgent finals" --push
```

The helper never bumps a version or pushes main. Tagging/publication and signing
remain owner-only. Explicit owner signing is a separate workflow_dispatch on
desktop.yml with sign=true and the exact signing_identity; default agent/tag
builds use --unsigned and do not expose signing secrets. No signing acceptance
is claimed. The orchestrator posts this packet to existing issue #265.
