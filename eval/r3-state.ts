import { existsSync, readFileSync, renameSync, truncateSync, writeFileSync } from 'node:fs'

export function atomicJson(path: string, value: unknown) {
  const temp = `${path}.tmp`
  writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  renameSync(temp, path)
}
export function resumeState<T>(path: string, identity: Record<string, unknown>): T | undefined {
  if (!existsSync(path)) return undefined
  const saved = JSON.parse(readFileSync(path, 'utf8'))
  if (JSON.stringify(saved.identity) !== JSON.stringify(identity)) throw new Error('R3 resume configuration changed; use a new output directory')
  return saved as T
}

/** A killed append can leave a partial final SSE frame. Keep every complete line. */
export function readObservations<T>(path: string): T[] {
  if (!existsSync(path)) return []
  const bytes = readFileSync(path), end = bytes.lastIndexOf(10) + 1
  if (end < bytes.length) truncateSync(path, end)
  return bytes.subarray(0, end).toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line) as T)
}
