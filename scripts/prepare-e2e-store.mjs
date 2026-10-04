import { mkdir, rm } from 'node:fs/promises'
await mkdir('.playwright',{recursive:true})
for(const name of ['app.db','app.db-wal','app.db-shm','publisher.db','publisher.db-wal','publisher.db-shm']) await rm(`.playwright/${name}`,{force:true})
await rm('.playwright/reports',{recursive:true,force:true})
console.log('Prepared isolated browser-test ledgers.')
