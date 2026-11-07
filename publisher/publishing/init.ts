import notes from './starter-notes.json' with { type: 'json' }
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'

export async function initNotes(folder: string) {
  await mkdir(resolve(folder), { recursive: true })
  for (const [name, body] of Object.entries(notes)) await writeFile(join(resolve(folder), name), body, { flag: 'wx' })
  console.log(`Created two SYNTHETIC starter notes in ${resolve(folder)}. Replace with your work; set synthetic: false. Then publish ${folder} --testnet.`)
}
export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1) throw new Error('Usage: init <dir>')
  await initNotes(args[0])
}
