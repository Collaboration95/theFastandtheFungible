import { mkdir, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const file = resolve(process.cwd(), '.playwright', 'runs.json')
await mkdir(dirname(file), { recursive: true })
await unlink(file).catch((error) => {
  if (error?.code !== 'ENOENT') throw error
})
console.log(`Prepared isolated Playwright run store at ${file}`)
