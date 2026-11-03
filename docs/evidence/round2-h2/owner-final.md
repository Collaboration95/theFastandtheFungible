# Finals candidate owner commands

This rehearsal performs no tagging, publication or signing. The SDK and Python
versions were already 1.0.0; H2 aligns the application, lock, MCP manifest and
server.json template. Candidate files are not published packages.

On 9 November, on the selected clean main SHA, run:

```sh
npm ci
caffeinate -dims node scripts/final-acceptance.mjs > scratch/final-acceptance.log 2>&1 &
wait $!
```

Require acceptance.json pass=true, sourceSha equal to the selected SHA, green
same-SHA CI, inspected SVG, manifest/consumer digest agreement, and hashes for
all exact artifacts. Retain dist/final and dist/release outside Git as final
release evidence. A committed report describes its earlier tested source/tree;
it cannot attest to its own future evidence commit. Re-run on the merge SHA.

Only after these checks, the owner may tag (the push triggers the release workflow):

```sh
node scripts/release.mjs 1.0.0 "ResearchAgent finals candidate" --dry-run
node scripts/release.mjs 1.0.0 "ResearchAgent finals candidate" --push
```

Do not replace an existing tag. D's release workflow admits the exact accepted
same-SHA CI artifacts; it must not substitute a historical rehearsal manifest.
After selecting the matching successful CI run ID, the owner downloads:

```sh
gh run list --workflow ci.yml --branch main --status success --json databaseId,headSha
gh run download RUN_ID --name accepted-release-artifacts --dir dist/owner-release
node scripts/check-release-consumers.mjs --manifest dist/owner-release/manifest.json
npm publish dist/owner-release/researchagent-sdk-1.0.0.tgz --access public
python3 -m twine upload dist/owner-release/researchagent-1.0.0-py3-none-any.whl dist/owner-release/researchagent-1.0.0.tar.gz
(cd dist/owner-release && mcp-publisher login github && mcp-publisher publish)
```

Compare manifest sizes/digests and source before each upload. Use generated
server.json, never the root template. Registry account actions remain in #265.
Publication needs a fresh registry consumer receipt; local installation proves
only local artifact consumption.

Owner-only signing, with the exact identity from the owner's Keychain:

```sh
CSC_NAME='Developer ID Application: <exact owner identity>' node desktop/build.mjs --dmg --sign
```

Rehash the signed DMG/app, rerun fixture recovery on its exact app path, and
perform Gatekeeper/quarantined-download acceptance. Signed replacements cannot
inherit unsigned acceptance. Cross-built x64 is labelled "built; native acceptance
pending" until actual Intel acceptance is recorded in #265.
