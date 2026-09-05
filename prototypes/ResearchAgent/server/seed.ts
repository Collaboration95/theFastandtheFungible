import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
await mkdir(join(root, 'data'), { recursive: true })
await writeFile(join(root, 'data', 'runs.json'), '[]\n')
console.log('ResearchAgent fixture store seeded.')
