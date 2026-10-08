// Pure parsers for `make preflight` (doctor --stage, #196). No network and no store writes here,
// so tests/stage-checks.test.ts covers them with fixtures. Each returns { ok, line } for one PASS/FAIL line.

export const QUOTA_LINE = 'daily free quota exhausted (resets 00:00 UTC = 08:00 SGT)'
const TERMINAL = new Set(['DONE', 'FAILED', 'STOPPED'])
// Beta prior (server/reputation.ts REPUTATION.alpha0/beta0): a newcomer has H = 0.8 and no evidence.
const atPrior = r => !r.r && !r.s && !r.passes && !r.fails && !r.refunds && !r.refusals && !r.n

/** Cloudflare `errors[].code` values from an error body (JSON string or object); [] when there are none. */
export function errorCodes(body) {
  let payload = body
  if (typeof body === 'string') { try { payload = JSON.parse(body) } catch { return [] } }
  return Array.isArray(payload?.errors) ? payload.errors.map(e => Number(e?.code)).filter(Number.isFinite) : []
}
/** A 429 with Cloudflare code 4006 is the daily free allocation, which no retry clears. */
export const isDailyQuota = (status, body) => status === 429 && errorCodes(body).includes(4006)

/** Reputation left over from a rehearsal: anyone quarantined, delisted or moved off the prior fails the stage. */
export function reputationCheck(records) {
  const blocked = records.filter(r => r.status !== 'active').map(r => `${r.publisherSlug} ${r.status}`)
  const moved = records.filter(r => r.status === 'active' && !atPrior(r)).map(r => `${r.publisherSlug} H ${Number(r.H).toFixed(2)}`)
  if (!blocked.length && !moved.length) return { ok: true, line: `reputation clean (${records.length ? `${records.length} at prior` : 'no records'})` }
  return { ok: false, line: `reputation not clean: ${[...blocked, ...moved].join(', ')}; reset trust (POST /api/reputation/reset or make reset)` }
}

/** Runs the server would resume on boot, or that a rehearsal left mid-flight. */
export function unfinishedRunsCheck(runs) {
  const open = runs.filter(run => !TERMINAL.has(run.phase))
  return open.length
    ? { ok: false, line: `${open.length} unfinished run(s) in the store (${open.slice(0, 3).map(r => `${String(r.runId).slice(0, 8)} ${r.phase}`).join(', ')}); make reset clears them` }
    : { ok: true, line: `no unfinished runs (${runs.length} in the store)` }
}

/**
 * One decision-shaped round: results of 1 judgeRound + N judgeCandidate calls made in parallel.
 * Each result is { ms, error?: { status?: string } }.
 */
export function decisionRoundCheck(results, timeoutMs) {
  const slowest = Math.max(0, ...results.map(r => r.ms))
  const failures = results.filter(r => r.error)
  const statuses = [...new Set(failures.map(r => typeof r.error?.status === 'string' ? r.error.status : 'error'))]
  if (statuses.includes('daily quota')) return { ok: false, line: `decision round: ${QUOTA_LINE}; swap with CF_BACKUP=1 make live` }
  if (failures.length) return { ok: false, line: `decision round: ${failures.length}/${results.length} calls failed (${statuses.join(', ')}); slowest ${slowest} ms at a ${timeoutMs} ms timeout` }
  return { ok: true, line: `decision round: ${results.length} parallel calls answered; slowest ${slowest} ms (timeout ${timeoutMs} ms)` }
}

/** The backup pair's one embedding call: { ms, status?, body?, error? }. */
export function backupPairCheck(result) {
  if (result.missing) return { ok: false, line: `backup pair: ${result.missing} not set` }
  if (isDailyQuota(result.status, result.body)) return { ok: false, line: `backup pair: ${QUOTA_LINE}` }
  if (result.error) return { ok: false, line: `backup pair: embedding call failed (${result.status ? `HTTP ${result.status}` : result.error})` }
  return { ok: true, line: `backup pair answered one embedding in ${result.ms} ms` }
}

/** CF_BACKUP=1: copy the _2 pair onto the primary variables (in place). Returns the names swapped, never values. */
export function applyBackupPair(env) {
  const pairs = [['CLOUDFLARE_API_TOKEN_2', 'CLOUDFLARE_API_TOKEN'], ['CLOUDFLARE_ACCOUNT_ID_2', 'CLOUDFLARE_ACCOUNT_ID']]
  const missing = pairs.filter(([from]) => !env[from]).map(([from]) => from)
  if (missing.length) throw new Error(`CF_BACKUP=1 needs ${missing.join(' and ')} in .env`)
  for (const [from, to] of pairs) env[to] = env[from]
  return pairs.map(([, to]) => to)
}

/** `make live`'s decision provider (#214): an explicit openai or cloudflare is honoured; anything else (unset, fixture) is cloudflare. */
export const liveDecisionProvider = value => value === 'openai' || value === 'cloudflare' ? value : 'cloudflare'

/**
 * One cheap OpenAI Decisions call (a single gap question): { ms, status?, body?, error? }. Access, credit and the model
 * in plain words; never the key or the response text.
 */
export function decisionsAccessCheck(result, model = 'gpt-6-luna') {
  if (result.missing) return { ok: false, line: `OpenAI Decisions: ${result.missing} not set` }
  const code = (() => { try { return JSON.parse(result.body ?? '')?.error?.code } catch { return undefined } })()
  if (result.status === 401 || result.status === 403) return { ok: false, line: `OpenAI Decisions: key rejected (HTTP ${result.status})` }
  if (code === 'insufficient_quota' || result.status === 402) return { ok: false, line: 'OpenAI Decisions: no credit left on this key; top up, or revert with DECISION_PROVIDER=cloudflare' }
  if (result.status === 404) return { ok: false, line: `OpenAI Decisions: model ${model} or the endpoint is not available to this key (HTTP 404)` }
  if (result.status === 429) return { ok: false, line: 'OpenAI Decisions: rate limited now (HTTP 429)' }
  if (result.error) return { ok: false, line: `OpenAI Decisions: call failed (${result.status >= 400 ? `HTTP ${result.status}` : result.error})` }
  return { ok: true, line: `OpenAI Decisions: ${model} answered in ${result.ms} ms` }
}
