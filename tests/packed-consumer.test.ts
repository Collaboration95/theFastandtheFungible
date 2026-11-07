import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { existsSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { packedArtifact, packedStdio, withPackedSession } from '../scripts/packed-consumer.js'
import { groupMembers } from '../shared/resource-scope.js'

it.each(['success', 'preflight', 'boot', 'command', 'bank', 'artifact'])('owns cleanup after %s', async mode => {
  let root = '', pid = 0
  const result = withPackedSession(false, async ({ scope, scratch, run }) => {
    root = scratch
    if (mode === 'preflight') packedArtifact(join(root, 'missing'))
    if (['bank', 'artifact'].includes(mode)) {
      const bank = JSON.stringify({ questions: [] }), hash = (s: string) => createHash('sha256').update(s).digest('hex')
      writeFileSync(join(root, 'bank.json'), bank); writeFileSync(join(root, 'packed.tgz'), '{}')
      writeFileSync(join(root, 'results.json'), JSON.stringify({ bankSha256: mode === 'bank' ? 'wrong' : hash(bank), artifactSha256: mode === 'artifact' ? 'wrong' : hash('{}'), values: [] }))
      execFileSync(process.execPath, ['--import', 'tsx', resolve('scripts/judge-bank-testnet.ts'), join(root, 'packed.tgz')], { env: { ...process.env, RA_ACCEPT_TESTNET: '1', XDG_STATE_HOME: root, J1_STATE_DIR: root, J1_RESUME: '1', JUDGE_OUT_DIR: root, JUDGE_BANK: join(root, 'bank.json') }, stdio: 'pipe' })
    }
    if (mode === 'command') await run(process.execPath, ['-e', 'process.exit(1)'])
    if (mode === 'boot') {
      const child = scope.spawn(process.execPath, ['-e', 'process.exit(1)']); pid = child.pid!
      await packedStdio(scope, child)
    }
    expect(await run(process.execPath, ['-e', 'console.log("ok")'])).toBe('ok\n')
  })
  if (mode === 'success') await result
  else await expect(result).rejects.toThrow(['bank', 'artifact'].includes(mode) ? /wrong/ : undefined)
  expect(existsSync(root)).toBe(false)
  if (pid) expect(groupMembers(pid)).toEqual([])
})
