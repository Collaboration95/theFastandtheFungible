import { readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
const data = resolve('data')
for (const file of await readdir(data)) if (/\.db(?:-wal|-shm)?$/.test(file)) await rm(resolve(data,file))
await rm(resolve(data,'reports'),{recursive:true,force:true})
console.log('Reset only demo SQLite ledgers and generated reports. Corpus preserved.')
