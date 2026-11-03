# Mac signing and notarisation

`make dmg` prints **UNSIGNED BUILD** when no valid Developer ID Application
identity exists in the login Keychain. It does not claim Gatekeeper approval.
The unsigned Apple Silicon DMG installs by dragging ResearchAgent to Applications.
On first launch use Finder → right-click → Open; if macOS blocks it, open
System Settings → Privacy & Security → Open Anyway. Do not disable Gatekeeper.

With a valid Developer ID Application certificate and its private key in the
Keychain, the same command automatically signs the app and DMG, enables hardened
runtime, submits the signed app to Apple, staples the accepted ticket, and validates
it. The only entitlement is JIT for Electron/V8. `CSC_NAME` can select a particular
valid identity; an invalid selection fails the build. A missing notarisation
profile or Apple's rejection also fails the signed build; it never silently falls
back to unsigned. The signed path is implemented but has not been exercised with
a Developer ID. Owner status is tracked exclusively on [#265](https://github.com/Collaboration95/theFastandtheFungible/issues/265).

One-time setup after obtaining the certificate: import the Developer ID
Application certificate and private key into the login Keychain, then run:

```sh
security find-identity -v -p codesigning
xcrun notarytool store-credentials ra-notary
make dmg
```

`notarytool` prompts for the Apple ID, team ID and app-specific password and stores
them in the Keychain. Do not put them in `.env`, Git, logs or command-line flags.
`make dmg` uses `ditto` to zip the signed app, `notarytool submit --wait` with that
profile, and `stapler staple` / `stapler validate` before building the DMG.

CI runs only on tags and manual dispatch. Hosted macOS runners have no owner
identity, so they currently produce unsigned DMGs; the local Keychain does not
travel to GitHub. On a runner provisioned with the same identity/profile the
pipeline activates automatically. No certificate export or cloud resource is
created by this change.

Electron and the DMG helper are downloaded through authenticated `gh` from their
upstream release assets. The helper's SHA-256 is pinned to electron-builder's
published checksum. Build output lives in ignored `desktop/out/`; public releases
contain a versioned DMG, not source credentials or runtime databases.

Hosted CI also activates signing automatically when all five repository secrets
exist: `APPLE_CERTIFICATE_BASE64` (PKCS#12), `APPLE_CERTIFICATE_PASSWORD`,
`APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_SPECIFIC_PASSWORD`. It imports the
certificate into an ephemeral runner Keychain, stores `ra-notary`, and uses the
same sign → notarise → staple/validate build path. No secrets means an explicitly
unsigned build; partial secrets fail closed. Certificate files are deleted after
import. Secrets are passed via masked CI environment and subprocess argument
arrays with output suppressed; never enable shell tracing. Runner teardown
removes the ephemeral Keychain. Actual Apple acceptance still needs signed-build
evidence once the owner provides the secrets tracked in #265.
