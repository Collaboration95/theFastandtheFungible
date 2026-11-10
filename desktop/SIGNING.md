# Mac signing and notarisation

Unsigned is the default. Local release builds and manual diagnostics use:

```sh
node desktop/download.mjs
node desktop/build.mjs --dmg --unsigned
```

This path disables identity discovery, ignores signing identities and certificate
links, and never runs Developer ID signing, notarytool or stapler. Output is
`desktop/out/ResearchAgent-<version>-arm64.dmg` by default. It makes no Gatekeeper
approval claim. Drag the app into Applications; use Finder → right-click → Open,
or System Settings → Privacy & Security → Open Anyway. Do not disable Gatekeeper.

Only the owner may invoke signing. After importing their Developer ID Application
certificate/private key and storing the `ra-notary` notarytool profile privately:

```sh
CSC_NAME='Developer ID Application: <exact owner identity>' node desktop/build.mjs --dmg --sign
```

`--sign` requires an explicit identity, verifies it is available and preflights the
notary profile with `notarytool history`. Missing credentials fail closed. It then
signs with hardened runtime/JIT entitlement, submits, waits for acceptance and
staples/validates the app before producing a signed DMG. `--sign --unsigned` is
invalid. Signing was not exercised by this lane. Owner signing/publication status
belongs in issue #265. Desktop workflow secrets are dormant: only an owner-dispatched `sign=true`
build can use them. Automatic tag builds and hosted release publishing are off.

Downloads use authenticated `gh` with upstream Electron and pinned DMG helper
checksums. Build staging excludes credentials and runtime databases. Unsigned
artifacts and subsequent signed artifacts have different hashes and each need
fresh acceptance. Signing does not enable silent updates.
