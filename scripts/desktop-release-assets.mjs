import { readdirSync, writeFileSync, statSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { sha256 } from './release-contract.mjs'
const dir = process.argv[2]
const artifacts = []
for (const arch of ['arm64','x64']) {
  const matches = readdirSync(dir).filter(f => new RegExp(`^ResearchAgent-[0-9].*-${arch}\\.dmg$`).test(f))
  if (matches.length !== 1) throw Error('Expected one accepted DMG per architecture')
  const file = matches[0]
  for (const name of [file, `ResearchAgent-unsigned-${arch}.dmg`]) {
    if (name !== file) copyFileSync(join(dir,file), join(dir,name))
    artifacts.push({file:name,sourceFile:file,bytes:statSync(join(dir,name)).size,sha256:sha256(join(dir,name))})
  }
}
writeFileSync(join(dir,'desktop-manifest.json'),JSON.stringify({sourceSha:process.argv[3] || process.env.GITHUB_SHA,mode:'unsigned',artifacts},null,2)+'\n')
