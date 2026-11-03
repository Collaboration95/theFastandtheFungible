import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { admitRelease, validateManifest, releaseJobs } from './release-contract.mjs'
const manifestFile = resolve('dist/release/manifest.json')
const manifest = JSON.parse(readFileSync(manifestFile))
const receipt = JSON.parse(readFileSync('dist/release/consumer-results.json'))
const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
if (sha !== process.env.GITHUB_SHA || process.env.ACCEPTANCE_RESULT !== 'success') throw Error('Same-tag acceptance required')
validateManifest(manifest, resolve('dist/release'))
admitRelease(manifest, {...receipt,manifestFile}, sha, Object.fromEntries(releaseJobs.map(j=>[j,process.env.ACCEPTANCE_RESULT])))
