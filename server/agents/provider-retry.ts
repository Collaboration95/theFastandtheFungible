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
  try {
    return await Promise.race([operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new ProviderDeadlineError(provider, ms)
        reject(error)
        controller.abort(error)
      }, ms)
    })])
  } finally { clearTimeout(timer); controller.abort() }
}
