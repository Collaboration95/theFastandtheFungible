// Guarded automatic resume after an UNPLANNED VM restart of an already-qualified release.
//
// startup.sh pauses the stack (reason `deploy`) on every boot-time run, so a host failure during
// the judging week would leave visitors on the paused page until an operator noticed. This module
// decides, from plain files on the state disk plus the API's own health, whether the stack may
// resume itself. It never resumes after a deploy of a different commit, and it never overrides an
// operator pause or a safety pause: a pause is released only when every condition below holds.
//
// Files in the state directory (/state in the API container, /srv/researchagent on the VM):
//   qualified.json     written by `hosted-control resume` when an operator brings the whole
//                      service up: {commit, qualifiedAt}. Cleared by any non-boot startup.sh run.
//   boot-control.json  raw copy of control.json taken by startup.sh before this boot's pause.
//   control.json       the live control document (admissionsPaused, spendingPaused, reasonCode, expiresAt).
//
// The pure decision lives in decideAutoResume() so it can be tested case by case; the runner at the
// bottom reads the files, samples /startupz and /readyz, and resumes through the same
// `hosted-control.mjs resume --local` CLI an operator uses, so all of that CLI's refusals still apply.
import { appendFileSync, readFileSync } from 'node:fs'
import { request } from 'node:http'
import { spawnSync } from 'node:child_process'
import { pathToFileURL, fileURLToPath } from 'node:url'

/** The reason startup.sh gives its own boot-time pause; the only pause this module may release. */
export const BOOT_REASON = 'deploy'
/** The reason an automatic resume writes, so the journal and `status` show who resumed. */
export const AUTO_REASON = 'auto_resume'
export const MARKER_FILE = 'qualified.json'
export const BOOT_CONTROL_FILE = 'boot-control.json'
/** The API must be healthy for at least this many consecutive checks spanning at least this long. */
export const HEALTH_WINDOW = { samples: 3, spanMs: 60000 }

const COMMIT = /^[0-9a-f]{40}$/
const REASON = /^[a-z0-9_-]{1,64}$/
const short = commit => String(commit).slice(0, 12)

/** A control document in the shape `hosted-control.mjs` writes, or undefined when it is not one. */
export function parseControl(value) {
  const c = value
  if (!c || typeof c !== 'object' || typeof c.admissionsPaused !== 'boolean' || typeof c.spendingPaused !== 'boolean') return undefined
  if (typeof c.reasonCode !== 'string' || !REASON.test(c.reasonCode) || typeof c.expiresAt !== 'string' || !Number.isFinite(Date.parse(c.expiresAt))) return undefined
  return { admissionsPaused: c.admissionsPaused, spendingPaused: c.spendingPaused, reasonCode: c.reasonCode, expiresAt: c.expiresAt }
}
/** The qualification marker, or undefined when it is missing or malformed. */
export function parseMarker(value) {
  if (!value || typeof value !== 'object' || typeof value.commit !== 'string' || !COMMIT.test(value.commit)) return undefined
  if (typeof value.qualifiedAt !== 'string' || !Number.isFinite(Date.parse(value.qualifiedAt))) return undefined
  return { commit: value.commit, qualifiedAt: value.qualifiedAt }
}
const isRunning = c => !c.admissionsPaused && !c.spendingPaused
/** The boot-time pause as startup.sh writes it: both halves paused, nothing else. */
const isBootPause = c => c.admissionsPaused && c.spendingPaused && c.reasonCode === BOOT_REASON

/**
 * The trailing run of passing health samples. A sample passes when /startupz answered 200 and
 * /readyz answered with the paused state (the stack is up, initialised, and reports the pause it
 * is under). Anything else (a refused connection, `ended`, the bare paused shell) fails.
 */
export function healthyRun(samples) {
  let n = 0
  while (n < samples.length) {
    const s = samples[samples.length - 1 - n]
    if (s.startupz === 200 && s.state === 'paused') n++
    else break
  }
  return samples.slice(samples.length - n)
}

const stay = (code, message) => ({ resume: false, code, message })
/**
 * Decide whether the stack may resume itself. Checks run in this order and the first failure wins:
 * qualified release, same commit, pre-restart state, live control, then sustained health.
 * `health` is null until the caller has sampled the API (the verdict is then `needs_health`).
 * input: {now, expectedCommit, runningCommit, marker, before, control, health}
 * returns {resume: boolean, code: string, message: string}; the message is one plain line.
 */
export function decideAutoResume(input) {
  const { now, expectedCommit, runningCommit, marker, before, control, health } = input
  if (!COMMIT.test(expectedCommit || '')) return stay('no_release', 'the deployed release is not identified')
  if (!marker) return stay('not_qualified', 'no operator-qualified release is recorded; an operator resume arms it')
  if (marker.commit !== expectedCommit) return stay('new_release', `release ${short(expectedCommit)} was deployed but only ${short(marker.commit)} was qualified by an operator`)
  if (runningCommit !== expectedCommit) return stay('release_mismatch', 'the running containers do not report the deployed release')
  if (!before) return stay('unknown_before', 'the state before the restart could not be read')
  if (Date.parse(before.expiresAt) <= now) return stay('expired', 'the control had already expired before the restart')
  if (!isRunning(before) && !isBootPause(before)) {
    const scope = before.admissionsPaused && before.spendingPaused ? 'paused' : 'partly paused'
    return stay('operator_pause', `the service was ${scope} (reason ${before.reasonCode}) before the restart; an operator or safety pause is never overridden`)
  }
  if (!control) return stay('unknown_now', 'the control file could not be read')
  if (Date.parse(control.expiresAt) <= now) return stay('expired', 'the control has expired; an operator must renew it')
  if (isRunning(control)) return stay('already_running', 'the service is already running; nothing to do')
  if (!isBootPause(control)) return stay('operator_pause_now', `the service was paused with reason ${control.reasonCode} after the restart; that pause wins`)
  if (!health) return stay('needs_health', 'health has not been sampled yet')
  const run = healthyRun(health)
  const last = health[health.length - 1]
  const span = run.length ? run[run.length - 1].at - run[0].at : 0
  if (run.length < HEALTH_WINDOW.samples || span < HEALTH_WINDOW.spanMs) {
    const seen = last ? `/startupz ${last.startupz ?? 'no answer'}, /readyz ${last.readyz ?? 'no answer'}${last.state ? ` (${last.state})` : ''}` : 'no checks yet'
    return stay('unhealthy', `the API was not healthy for ${HEALTH_WINDOW.spanMs / 1000} s across ${HEALTH_WINDOW.samples} checks (last: ${seen})`)
  }
  return { resume: true, code: 'resume', message: `release ${short(expectedCommit)} was qualified by an operator at ${marker.qualifiedAt}, the service was ${isRunning(before) ? 'running' : 'only under the boot-time pause'} before the restart, and the API stayed healthy for ${HEALTH_WINDOW.spanMs / 1000} s (/startupz OK, /readyz reporting only the pause)` }
}

// ---------------------------------------------------------------- runner (VM only)
const sleep = ms => new Promise(done => setTimeout(done, ms))
function readJson(file) { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return undefined } }
/** One GET against the API with the public origin's Host header (the gateway refuses any other host). */
export function probe({ port, host, path, timeoutMs = 3000 }) {
  return new Promise(resolve => {
    const done = value => resolve(value)
    const req = request({ hostname: '127.0.0.1', port, path, method: 'GET', headers: { host }, timeout: timeoutMs }, res => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', chunk => { if (text.length < 4096) text += chunk })
      res.on('error', () => done({ status: null, state: null }))
      res.on('end', () => {
        let state = null
        try { const body = JSON.parse(text); if (typeof body.status === 'string') state = body.status } catch { /* the bare paused page is HTML */ }
        done({ status: res.statusCode ?? null, state })
      })
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => done({ status: null, state: null }))
    req.end()
  })
}

/**
 * Run the guarded auto-resume once and return the single plain line to log.
 * options: {state, commit, runningCommit, origin, port, pollMs, maxWaitMs, readyWaitMs, cli, now, sleep}; the last
 * two are clocks a test can fake.
 */
export async function runAutoResume(options) {
  const { state = '/state', commit, runningCommit = process.env.RA_COMMIT, origin = process.env.HOSTED_ORIGIN, port = Number(process.env.PORT || 8788), pollMs = 30000, maxWaitMs = 600000, readyWaitMs = 300000, now = Date.now, sleep: wait = sleep } = options
  const cli = options.cli || fileURLToPath(new URL('../../scripts/hosted-control.mjs', import.meta.url))
  const controlPath = `${state}/control.json`
  const gather = () => ({ now: now(), expectedCommit: commit, runningCommit, marker: parseMarker(readJson(`${state}/${MARKER_FILE}`)), before: parseControl(readJson(`${state}/${BOOT_CONTROL_FILE}`)), control: parseControl(readJson(controlPath)) })
  const stayed = verdict => `autoresume: stayed paused (${verdict.code}): ${verdict.message}`
  let host
  try { host = new URL(origin).host } catch { return stayed(stay('no_origin', 'HOSTED_ORIGIN is not set')) }
  let verdict = decideAutoResume({ ...gather(), health: null })
  if (verdict.code !== 'needs_health') return stayed(verdict)
  const samples = []
  const deadline = now() + maxWaitMs
  for (;;) {
    const startup = await probe({ port, host, path: '/startupz' })
    const ready = await probe({ port, host, path: '/readyz' })
    samples.push({ at: now(), startupz: startup.status, readyz: ready.status, state: ready.state })
    verdict = decideAutoResume({ ...gather(), health: samples })
    if (verdict.code !== 'unhealthy' || now() + pollMs > deadline) break
    await wait(pollMs)
  }
  if (!verdict.resume) return stayed(verdict)
  // Decide again from fresh reads immediately before acting; --only-if-reason makes the CLI refuse
  // if anyone changed the pause between that read and its own.
  verdict = decideAutoResume({ ...gather(), health: samples })
  if (!verdict.resume) return stayed(verdict)
  const run = spawnSync(process.execPath, [cli, 'resume', 'all', '--local', '--execute', '--path', controlPath, '--reason', AUTO_REASON, '--only-if-reason', BOOT_REASON], { encoding: 'utf8' })
  if (run.status !== 0) return stayed(stay('resume_refused', `the resume command refused (${String(run.stderr || '').trim().split('\n').filter(Boolean).pop()?.replace(/^Error:\s*/, '').slice(0, 160) || 'no detail'})`))
  let after
  for (const end = now() + readyWaitMs; ; ) {
    after = await probe({ port, host, path: '/readyz' })
    if (after.status === 200 || now() + 5000 > end) break
    await wait(5000)
  }
  const readiness = after.status === 200 ? 'ready' : `not ready yet (${after.state ?? 'no answer'}); new work is refused until it clears by itself`
  return `autoresume: resumed. ${verdict.message}. Readiness after resume: ${readiness}.`
}

function parseArgs(argv) {
  const out = {}
  const numeric = { '--port': 'port', '--poll-ms': 'pollMs', '--max-wait-ms': 'maxWaitMs', '--ready-wait-ms': 'readyWaitMs' }
  const text = { '--state': 'state', '--commit': 'commit', '--running-commit': 'runningCommit', '--origin': 'origin', '--cli': 'cli' }
  for (let i = 0; i < argv.length; i++) {
    if (numeric[argv[i]] && argv[i + 1] !== undefined) out[numeric[argv[i]]] = Number(argv[++i])
    else if (text[argv[i]] && argv[i + 1] !== undefined) out[text[argv[i]]] = argv[++i]
    else throw Error('Unknown or incomplete argument')
  }
  return out
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // One plain line to the journal (stdout of the systemd unit) and to a log on the state disk,
  // which survives the journal. Nothing secret is ever in the line.
  const log = line => { console.log(line); try { appendFileSync(`${parsed.state || '/state'}/autoresume.log`, `${new Date().toISOString()} ${line}\n`, { mode: 0o600 }) } catch { /* the journal line is enough */ } }
  let parsed = {}
  try { parsed = parseArgs(process.argv.slice(2)); log(await runAutoResume(parsed)) }
  catch (error) { log(`autoresume: stayed paused (error): ${String(error?.message || error).slice(0, 160)}`); process.exitCode = 1 }
}
