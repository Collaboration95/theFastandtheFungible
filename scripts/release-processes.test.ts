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

test('startup error still closes the owned group', async () => {
  const { ResourceScope, waitForOutput } = await import('../shared/resource-scope.js')
  const scope = new ResourceScope()
  const child = scope.spawn(process.execPath, ['-e', 'process.exit(17)'])
  try { await assert.rejects(waitForOutput(child, /ready/, 1000), /before readiness/) }
  finally { await scope.close() }
  await assertNoProcesses()
})
