// Import unedited public-view PNGs captured with the shared browser after REDEPLOYED.
// Never asks a question, creates a visitor run, recovers tokens, or changes the deployment.
// node docs/submission/deck/export.mjs --refresh-shots
// First capture Home, recorded Verify, Writers and scoreboard to the manifest below.
// Historical answer images/manifest remain unchanged with their actual build/date labels.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const assets = join(root, 'docs/submission/deck/assets')
const source = join(root, 'scratch/fin-final/public-captures.json')
const manifest = JSON.parse(readFileSync(source, 'utf8'))
const selected = JSON.parse(readFileSync(join(root, 'shared/judge-run.json'), 'utf8'))
const expected = process.env.FIN_REDEPLOYED_SHA
if (!expected || !/^[a-f0-9]{40}$/.test(expected) || manifest.deployedSha !== expected) throw Error('Need the exact REDEPLOYED SHA and matching capture manifest')
if (manifest.bundleSha256 !== selected.sha256 || manifest.questionsSubmitted !== 0) throw Error('Need selected recorded-run evidence and zero new questions')
if (manifest.gates.length !== 5 || manifest.gates.some(x => x !== 'Passed' && x !== 'Held')) throw Error('Need five observed passing browser gates')
if (manifest.result !== '24 passed · 2 not checked') throw Error('Need the actual featured browser result, including skips')
const required = ['home', 'judges-corner', 'writers', 'scoreboard']
const imported = []
for (const name of required) {
  const shot = manifest.shots[name]
  if (!shot?.path || !shot.sha256) throw Error(`Missing original ${name} PNG`)
  const bytes = readFileSync(shot.path)
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (hash !== shot.sha256 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error(`Changed or invalid PNG: ${name}`)
  mkdirSync(assets, { recursive: true })
  const file = `hosted-${name}.png`
  copyFileSync(shot.path, join(assets, file))
  imported.push({ name, file, sha256: hash, viewport: shot.viewport })
}
const publicManifest = { ...manifest }
delete publicManifest.shots
writeFileSync(join(assets, 'hosted-public-shots.json'), JSON.stringify({ ...publicManifest, shots: imported, note: 'Original shared-browser PNGs copied byte-for-byte. No new hosted question; historical answer imagery unchanged.' }, null, 2) + '\n')
console.log(`hosted: imported ${imported.length} public-view captures; zero questions`)
