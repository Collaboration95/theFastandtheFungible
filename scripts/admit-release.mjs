// Read-only local admission of the receipts prepared by the release publisher.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { admitLocalRelease } from './release-contract.mjs'
import { sourceIdentity } from './ship-check.mjs'
const load = file => JSON.parse(readFileSync(file))
const manifestFile = resolve('dist/release/manifest.json')
admitLocalRelease({ manifest: load(manifestFile), receipt: { ...load('dist/release/consumer-results.json'), manifestFile }, gate: load('dist/local-release/assets/local-gate.json'), acceptance: load('dist/final/acceptance.json'), ...sourceIdentity(), version: load('package.json').version, root: resolve('dist/release'), dmgRoot: resolve('desktop/out') })
