// Bundles the api and publisher into single ESM files so the runtime images need no
// devDependencies, tsx or TypeScript. Usage: node docker/bundle.mjs <outdir>
import { build } from 'esbuild'
const outdir = process.argv[2] ?? 'dist-docker'
await build({
  entryPoints: { api: 'server/index.ts', publisher: 'publisher/server.ts' },
  outdir, outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm', target: 'node22',
  // playwright-core ships its own browser-driver assets; it is copied into the api image as is.
  external: ['playwright-core'], alias: { '@playwright/test': './docker/playwright-shim.mjs' },
  // Bundled CommonJS dependencies (xrpl, express, OpenTelemetry) still call require().
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: 'warning',
})
