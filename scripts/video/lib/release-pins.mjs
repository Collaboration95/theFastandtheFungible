// Same publication allowlist as the builders' corner; live checks use authenticated gh only.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { check } from '../../check-release-urls.mjs'
import { RELEASE_TAG, RELEASE, TGZ, WHEEL } from '../config.mjs'
const links = JSON.parse(readFileSync(fileURLToPath(new URL('../../../shared/links.json', import.meta.url)), 'utf8'))
export function assertPublished(tag = RELEASE_TAG, published = links.publishedReleases) {
  if (!published.includes(tag)) throw new Error(`${tag} is not a published release; use the builders' corner publishedReleases list`)
}
export async function checkVideoPins() {
  assertPublished()
  const failures = await check([RELEASE.replace('/download/', '/tag/'), TGZ, WHEEL])
  if (failures.length) throw new Error(JSON.stringify(failures))
  console.log(`video pins: ${RELEASE_TAG} published; tgz and wheel resolve through gh`)
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await checkVideoPins()
