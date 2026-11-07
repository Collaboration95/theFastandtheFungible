import { spawn, execFileSync, type SpawnOptionsWithoutStdio, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { join, basename } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export function groupMembers(group: number): number[] {
  return execFileSync('ps', ['-axo', 'pid=,pgid=,stat='], { encoding: 'utf8' }).trim().split('\n')
    .map(line => line.trim().split(/\s+/)).filter(([, pgid, state]) => Number(pgid) === group && !state.startsWith('Z')).map(([pid]) => Number(pid))
}
function signal(group: number, value: NodeJS.Signals) {
  try { process.kill(-group, value) } catch (error) {
    if (!['ESRCH', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
  }
}
/** Bound the entire group, even after its leader exits. Zombies are not live processes. */
export async function stopProcess(child: ChildProcessWithoutNullStreams) {
  try {
    if (!child.pid) return
    signal(child.pid, 'SIGTERM')
    const deadline = Date.now() + 1500
    while (groupMembers(child.pid).length && Date.now() < deadline) await delay(25)
    if (groupMembers(child.pid).length) signal(child.pid, 'SIGKILL')
    const killed = Date.now() + 3000
    while (groupMembers(child.pid).length && Date.now() < killed) await delay(25)
    if (groupMembers(child.pid).length) throw Error(`Owned process group ${child.pid} survived cleanup`)
  } finally { child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy() }
}

/** Own only resources created here. Register handles immediately; closers run LIFO,
 * groups stop first and scratch is removed last, even when another closer fails.
 * Live journals belong in evidenceDir(), outside disposable scratch, from creation. */
export class ResourceScope {
  private closers: (() => void | Promise<void>)[] = []
  private children: ChildProcessWithoutNullStreams[] = []
  private roots: string[] = []
  private closing?: Promise<void>
  private open() { if (this.closing) throw Error('ResourceScope is closed') }
  defer(close: () => void | Promise<void>) { this.open(); this.closers.push(close) }
  tempDir(prefix = 'ra-') {
    this.open()
    const path = mkdtempSync(join(tmpdir(), basename(prefix)))
    this.roots.push(path)
    return path
  }
  /** Private durable state, retained indefinitely for manual obligation reconciliation.
   * No automatic expiry: deleting a signed journal can permit a duplicate payment. */
  evidenceDir(prefix: string, reason: string) {
    this.open()
    if (!reason.trim()) throw Error('Retention requires a reason')
    const parent = join(process.env.XDG_STATE_HOME || join(homedir(), '.local/state'), 'researchagent', 'acceptance')
    mkdirSync(parent, { recursive: true, mode: 0o700 })
    const path = mkdtempSync(join(parent, basename(prefix)))
    writeFileSync(join(path, 'retention.json'), JSON.stringify({ reason, createdAt: new Date().toISOString(), expiry: 'manual reconciliation required' }) + '\n', { mode: 0o600 })
    return path
  }
  spawn(command: string, args: string[], options: SpawnOptionsWithoutStdio = {}) {
    this.open()
    const child = spawn(command, args, { ...options, detached: true, stdio: 'pipe' })
    this.children.push(child)
    if (child.pid && process.env.RA_RESOURCE_REGISTRY) writeFileSync(join(process.env.RA_RESOURCE_REGISTRY, `${child.pid}.json`), JSON.stringify({ group: child.pid }))
    return child
  }
  own<T extends { close(): void | Promise<void> }>(handle: T): T {
    const close = handle.close.bind(handle)
    let closed = false
    handle.close = (() => { if (!closed) { closed = true; return close() } }) as T['close']
    this.defer(() => handle.close())
    return handle
  }
  timer(timer: ReturnType<typeof setTimeout>) { this.defer(() => clearTimeout(timer)); return timer }
  close(): Promise<void> {
    return this.closing ??= (async () => {
      const errors: unknown[] = []
      const attempt = async (fn: () => void | Promise<void>) => { try { await fn() } catch (error) { errors.push(error) } }
      await Promise.all(this.children.map(child => attempt(() => stopProcess(child))))
      for (const close of this.closers.reverse()) await attempt(close)
      for (const root of this.roots) await attempt(() => rm(root, { recursive: true, force: true }))
      if (errors.length) throw new AggregateError(errors, 'Resource cleanup failed')
    })()
  }
}
export async function withResourceScope<T>(run: (scope: ResourceScope) => Promise<T>): Promise<T> {
  const scope = new ResourceScope()
  try { return await run(scope) } finally { await scope.close() }
}
/** Reports before deletion: cleanup must never hide a failed leak gate. */
export function resourceLeaks(root: string, registry?: string) {
  const directories = readdirSync(root)
  const groups = registry && existsSync(registry) ? readdirSync(registry).map(file => Number(file.split('.')[0])).filter(group => groupMembers(group).length) : []
  return { directories, groups }
}

/** Startup readiness with one deadline; listeners and timer are removed on every outcome. */
export function waitForOutput(child: ChildProcessWithoutNullStreams, pattern: RegExp, timeoutMs: number): Promise<RegExpMatchArray> {
  return new Promise((resolve, reject) => {
    let output = ''
    const cleanup = () => { clearTimeout(timer); child.stdout.off('data', data); child.off('exit', exited); child.off('error', failed) }
    const failed = (error: Error) => { cleanup(); reject(error) }
    const exited = () => failed(Error('Process exited before readiness'))
    const data = (chunk: Buffer) => { output += chunk; const match = output.match(pattern); if (match) { cleanup(); resolve(match) } }
    const timer = setTimeout(() => failed(Error(`Process readiness timeout (${timeoutMs} ms)`)), timeoutMs)
    child.stdout.on('data', data); child.once('exit', exited); child.once('error', failed)
    if (child.exitCode !== null || child.signalCode !== null) exited()
  })
}
