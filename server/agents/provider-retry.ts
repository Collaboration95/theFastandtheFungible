/** Parse provider pacing without logging headers or response bodies. */
export function retryAfterMs(value: string | null, now = Date.now()): number {
  if (!value) return 1000
  const seconds = Number(value)
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now
  return Number.isFinite(ms) ? Math.max(0, ms) : 1000
}
/** One bounded jittered delay; never shorten the provider's minimum cooldown. */
export const retryDelayMs = (minimum: number, random = Math.random) => minimum + Math.floor(random() * 250)
