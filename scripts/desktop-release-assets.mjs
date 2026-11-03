import { readdirSync, copyFileSync, writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { sha256 } from './release-contract.mjs'
const dir = process.argv[2]
const artifacts = []
for (const arch of ['arm64','x64']) {
  const matches = readdirSync(dir).filter(f => new RegExp(`^ResearchAgent-[0-9].*-${arch}\\.dmg$`).test(f))
  if (matches.length !== 1) throw Error('Expected one accepted DMG per architecture')
  const file = `ResearchAgent-${arch}.dmg`
  copyFileSync(join(dir,matches[0]),join(dir,file))
  artifacts.push({file,sourceFile:matches[0],bytes:statSync(join(dir,file)).size,sha256:sha256(join(dir,file))})
}
writeFileSync(join(dir,'desktop-manifest.json'),JSON.stringify({sourceSha:process.env.GITHUB_SHA,mode:'unsigned',artifacts},null,2)+'\n')
