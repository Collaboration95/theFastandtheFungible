import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { managedSpawn, stopProcess, assertNoProcesses } from './release-processes.js'

test('cleanup kills an npx-shaped grandchild even when it ignores SIGTERM', async () => {
  const child = managedSpawn(process.execPath, ['-e', `
    const {spawn}=require('node:child_process');
    const p=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{}); console.log(process.pid); setInterval(()=>{},1000)"],{stdio:['ignore','pipe','inherit']});
    p.stdout.pipe(process.stdout);
    setInterval(()=>{},1000);
  `], {})
  try {
    const [chunk] = await once(child.stdout, 'data')
    const pid = Number(String(chunk).trim())
    assert(pid > 0)
    await stopProcess(child)
    await assertNoProcesses()
  } finally { await stopProcess(child) }
})
