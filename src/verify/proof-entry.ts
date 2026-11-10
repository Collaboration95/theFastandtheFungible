// Standalone entry for the server-rendered proof pages (/proof/:id, lane W1): the same in-browser receipt verifier the
// app loads lazily, built as its own entry at /verify/proof-verify.js so a page without the app can run it. It must not
// import the app (no React boot, no session request): keep this file a pure re-export.
export { verifyInBrowser } from './browser'
