import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * The local JSON store is deliberately small and single-process. These modes
 * describe the storage boundary, not the fixture/Testnet settlement runtime.
 */
export type PersistenceMode = 'fresh' | 'seeded'

export type LoadedRunStore<T> = {
  runs: Map<string, T>
  mode: PersistenceMode
}

type RunRecord = { runId: unknown }

function isRunRecord(value: unknown): value is RunRecord {
  const runId = value && typeof value === 'object' ? (value as RunRecord).runId : undefined
  return typeof runId === 'string' && runId.length > 0
}

/**
 * Read persisted runs without turning a corrupt or unexpected file into an
 * empty store. An absent file is the only fresh-store condition.
 */
export async function loadRunStore<T extends { runId: string }>(file: string): Promise<LoadedRunStore<T>> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { runs: new Map(), mode: 'fresh' }
    throw error
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Unable to parse persisted research runs at ${file}: ${(error as Error).message}`)
  }
  if (!Array.isArray(parsed) || parsed.some((value) => !isRunRecord(value))) {
    throw new Error(`Persisted research runs at ${file} must be a JSON array of records with runId values.`)
  }

  const runs = new Map<string, T>()
  for (const value of parsed) {
    const run = value as T
    if (runs.has(run.runId)) throw new Error(`Persisted research runs at ${file} contain duplicate runId ${run.runId}.`)
    runs.set(run.runId, run)
  }
  return { runs, mode: runs.size ? 'seeded' : 'fresh' }
}

/**
 * Replace the JSON file atomically so a restart never observes a half-written
 * run history. The temporary file lives beside the target for same-volume
 * rename semantics on Windows and POSIX.
 */
export async function persistRunStore<T>(file: string, runs: Iterable<T>): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify([...runs], null, 2))
    await rename(temporary, file)
  } catch (error) {
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}
