/** Parse provider pacing without logging headers or response bodies. */
export function retryAfterMs(value: string | null, now = Date.now()): number {
  if (!value) return 1000
  const seconds = Number(value)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now
  return Number.isFinite(ms) ? Math.max(0, ms) : 1000
}
/** One bounded jittered delay; never shorten the provider's minimum cooldown. */
export const retryDelayMs = (minimum: number, random = Math.random) => minimum + Math.floor(random() * 250)

/** A transport may ignore abort, including while cancelling an SSE reader. Bound the await too. */
export class ProviderDeadlineError extends Error {
  readonly code = 'PROVIDER_DEADLINE'
  constructor(readonly provider: string, readonly deadlineMs: number) {
    super(`${provider} unavailable: deadline exceeded (${deadlineMs} ms)`)
    this.name = 'ProviderDeadlineError'
  }
}
export async function withProviderDeadline<T>(provider: string, ms: number, controller: AbortController, operation: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let abandoned: () => void = () => undefined
  try {
    controller.signal.throwIfAborted()
    return await Promise.race([new Promise<never>((_, reject) => { abandoned = () => reject(new Error('Provider call abandoned')); controller.signal.addEventListener('abort', abandoned, { once: true }) }), operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new ProviderDeadlineError(provider, ms)
        reject(error)
        controller.abort(error)
      }, ms)
    })])
  } finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abandoned); controller.abort() }
}

/** Abortable pacing and a bounded await even for an uncooperative transport. */
export async function abortable<T>(job: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return job
  signal.throwIfAborted()
  let abort: () => void = () => undefined
  try { return await Promise.race([job, new Promise<never>((_, reject) => { abort = () => reject(new Error('Provider call abandoned')); signal.addEventListener('abort', abort, { once: true }) })]) }
  finally { signal.removeEventListener('abort', abort) }
}
export async function pause(ms: number, signal?: AbortSignal) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { await abortable(new Promise<void>(resolve => { timer = setTimeout(resolve, ms) }), signal) } finally { clearTimeout(timer) }
}
