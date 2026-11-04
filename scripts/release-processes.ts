import { spawn, execFileSync, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'

// Separate groups include npm/npx grandchildren and their fixture workers.
const groups = new Set<number>()
export function managedSpawn(command: string, args: string[], options: SpawnOptionsWithoutStdio) {
  const child = spawn(command, args, { ...options, detached: true, stdio: 'pipe' })
  if (child.pid) groups.add(child.pid)
  return child
}
function members(group: number) {
  return execFileSync('ps', ['-axo', 'pid=,pgid=,stat='], { encoding: 'utf8' })
    .trim().split('\n').map(line => line.trim().split(/\s+/))
    .filter(([, pgid, state]) => Number(pgid) === group && !state.startsWith('Z'))
    .map(([pid]) => Number(pid))
}
function signal(group: number, signal: NodeJS.Signals) {
  try { process.kill(-group, signal) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
  }
}
export async function stopProcess(child: ChildProcessWithoutNullStreams) {
  try {
    if (!child.pid) return
    signal(child.pid, 'SIGTERM')
    const deadline = Date.now() + 1500
    while (members(child.pid).length && Date.now() < deadline) await delay(25)
    if (members(child.pid).length) signal(child.pid, 'SIGKILL')
    const killedDeadline = Date.now() + 3000
    while (members(child.pid).length && Date.now() < killedDeadline) await delay(25)
    assert.deepEqual(members(child.pid), [], 'consumer process group survived cleanup')
  } finally {
    child.stdin.destroy()
    child.stdout.destroy()
    child.stderr.destroy()
  }
}
export async function assertNoProcesses() {
  for (const group of groups) assert.deepEqual(members(group), [], 'leftover consumer process')
  console.log('Process cleanup verified: ' + [...groups].join(', '))
}
