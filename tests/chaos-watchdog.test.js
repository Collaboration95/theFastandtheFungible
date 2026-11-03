import { expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runChild } from '../scripts/chaos/child.mjs'
it('captures both pipes, requests a diagnostic, kills a stall and permits the next child', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'chaos-watchdog-'))
  try {
    const r = await runChild(['--import','./scripts/chaos/diagnostics.mjs','--eval', 'console.log("stdout-marker"); console.error("stderr-marker"); setInterval(() => {}, 100)',dir], { env: { ...process.env, CHAOS_DIAGNOSTIC_DIR: dir } }, { watchdogMs: 500, graceMs: 500 })
    expect(r.timedOut).toBe(true); expect(r.signal).toBe('SIGKILL')
    expect(r.tail).toContain('stdout-marker'); expect(r.tail).toContain('stderr-marker')
    expect(r.elapsedMs).toBeLessThan(3000)
    const diagnostic = JSON.parse(readFileSync(join(dir,'diagnostic.json'),'utf8'))
    expect(diagnostic.javascriptStack).toBeDefined(); expect(diagnostic.environmentVariables).toBeUndefined()
    expect((await runChild(['-e','console.log("next")'], {})).code).toBe(0)
  } finally { rmSync(dir,{recursive:true,force:true}) }
})
