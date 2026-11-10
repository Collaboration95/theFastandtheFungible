import { describe, it, expect } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { resources } from './helpers/resource-scope.js'
import {
  AUTO_REASON, BOOT_CONTROL_FILE, BOOT_REASON, HEALTH_WINDOW, MARKER_FILE,
  decideAutoResume, healthyRun, parseControl, parseMarker, runAutoResume,
  type AutoResumeInput, type ControlDocument, type HealthSample,
} from '../docker/hosted/autoresume.mjs'

const NOW = Date.parse('2026-11-12T00:00:00Z')
const SHA = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)
const EXPIRES = '2026-11-19T16:00:00Z'
const control = (patch: Partial<ControlDocument> = {}): ControlDocument => ({ admissionsPaused: true, spendingPaused: true, reasonCode: BOOT_REASON, expiresAt: EXPIRES, ...patch })
const running = (patch: Partial<ControlDocument> = {}) => control({ admissionsPaused: false, spendingPaused: false, reasonCode: 'operator_ready', ...patch })
const sample = (at: number, patch: Partial<HealthSample> = {}): HealthSample => ({ at, startupz: 200, readyz: 503, state: 'paused', ...patch })
const healthy = [sample(NOW), sample(NOW + 30000), sample(NOW + 60000)]
/** The eligible baseline: a qualified release, running before the restart, boot pause now, healthy API. */
const eligible = (patch: Partial<AutoResumeInput> = {}): AutoResumeInput => ({
  now: NOW, expectedCommit: SHA, runningCommit: SHA,
  marker: { commit: SHA, qualifiedAt: '2026-11-11T20:00:00Z' },
  before: running(), control: control(), health: healthy, ...patch,
})

describe('guarded auto-resume decision', () => {
  it('resumes a qualified release that was running before the restart and is healthy', () => {
    const verdict = decideAutoResume(eligible())
    expect(verdict).toMatchObject({ resume: true, code: 'resume' })
    expect(verdict.message).toContain('was running')
    expect(verdict.message).toContain('aaaaaaaaaaaa')
  })
  it('also resumes when the only pause before the restart was the boot-time deploy pause itself', () => {
    expect(decideAutoResume(eligible({ before: control() }))).toMatchObject({ resume: true })
  })
  it('stays paused for a new commit, even if one was qualified earlier', () => {
    expect(decideAutoResume(eligible({ expectedCommit: OTHER, runningCommit: OTHER }))).toMatchObject({ resume: false, code: 'new_release' })
  })
  it('stays paused when the running containers do not report the deployed release', () => {
    expect(decideAutoResume(eligible({ runningCommit: OTHER }))).toMatchObject({ resume: false, code: 'release_mismatch' })
    expect(decideAutoResume(eligible({ runningCommit: undefined }))).toMatchObject({ resume: false, code: 'release_mismatch' })
  })
  it('stays paused with no, malformed or unidentified qualification', () => {
    expect(decideAutoResume(eligible({ marker: undefined }))).toMatchObject({ resume: false, code: 'not_qualified' })
    expect(decideAutoResume(eligible({ expectedCommit: 'not-a-commit', runningCommit: 'not-a-commit' }))).toMatchObject({ resume: false, code: 'no_release' })
    expect(parseMarker({ commit: 'abc', qualifiedAt: '2026-11-11T20:00:00Z' })).toBeUndefined()
    expect(parseMarker({ commit: SHA, qualifiedAt: 'yesterday' })).toBeUndefined()
    expect(parseMarker(null)).toBeUndefined()
  })
  it.each(['operator_paused', 'maintenance', 'budget_cap', 'wallet_cap', 'control_unavailable', 'prelaunch'])('never overrides a pause with reason %s that existed before the restart', reasonCode => {
    expect(decideAutoResume(eligible({ before: control({ reasonCode }) }))).toMatchObject({ resume: false, code: 'operator_pause' })
  })
  it('never overrides a partial pause, even one carrying the deploy reason', () => {
    expect(decideAutoResume(eligible({ before: running({ spendingPaused: true, reasonCode: 'maintenance' }) }))).toMatchObject({ resume: false, code: 'operator_pause' })
    expect(decideAutoResume(eligible({ before: control({ admissionsPaused: false }) }))).toMatchObject({ resume: false, code: 'operator_pause' })
  })
  it('stays paused when the state before the restart is unknown', () => {
    expect(decideAutoResume(eligible({ before: undefined }))).toMatchObject({ resume: false, code: 'unknown_before' })
    expect(parseControl({ admissionsPaused: 'no', spendingPaused: false, reasonCode: 'x', expiresAt: EXPIRES })).toBeUndefined()
    expect(parseControl({ admissionsPaused: false, spendingPaused: false, reasonCode: 'Bad Reason', expiresAt: EXPIRES })).toBeUndefined()
    expect(parseControl({ admissionsPaused: false, spendingPaused: false, reasonCode: 'ok', expiresAt: 'never' })).toBeUndefined()
  })
  it('stays paused once the control has expired, before or after the restart', () => {
    expect(decideAutoResume(eligible({ now: Date.parse('2026-11-19T16:00:01Z') }))).toMatchObject({ resume: false, code: 'expired' })
    expect(decideAutoResume(eligible({ control: control({ expiresAt: '2026-11-11T00:00:00Z' }) }))).toMatchObject({ resume: false, code: 'expired' })
    expect(decideAutoResume(eligible({ before: running({ expiresAt: '2026-11-11T00:00:00Z' }) }))).toMatchObject({ resume: false, code: 'expired' })
  })
  it('does nothing when an operator already resumed, and yields to a pause set after the restart', () => {
    expect(decideAutoResume(eligible({ control: running() }))).toMatchObject({ resume: false, code: 'already_running' })
    expect(decideAutoResume(eligible({ control: control({ reasonCode: 'maintenance' }) }))).toMatchObject({ resume: false, code: 'operator_pause_now' })
    expect(decideAutoResume(eligible({ control: running({ spendingPaused: true }) }))).toMatchObject({ resume: false, code: 'operator_pause_now' })
    expect(decideAutoResume(eligible({ control: undefined }))).toMatchObject({ resume: false, code: 'unknown_now' })
  })
  it('asks for health samples before it will resume', () => {
    expect(decideAutoResume(eligible({ health: null }))).toMatchObject({ resume: false, code: 'needs_health' })
  })
  it('needs three consecutive healthy checks spanning a full minute', () => {
    const stays = (health: HealthSample[]) => expect(decideAutoResume(eligible({ health }))).toMatchObject({ resume: false, code: 'unhealthy' })
    stays([])
    stays([sample(NOW), sample(NOW + 30000)])
    stays([sample(NOW), sample(NOW + 10000), sample(NOW + 20000)])
    stays([sample(NOW), sample(NOW + 30000), sample(NOW + 59999)])
    // a failure inside the window resets it; only the trailing run counts
    stays([sample(NOW), sample(NOW + 30000, { startupz: 503 }), sample(NOW + 60000), sample(NOW + 90000)])
    // an API that is up but not initialised (the bare paused shell), unreachable, or past the event
    stays([sample(NOW), sample(NOW + 30000), sample(NOW + 60000, { startupz: 503 })])
    stays([sample(NOW), sample(NOW + 30000), sample(NOW + 60000, { startupz: null, readyz: null, state: null })])
    stays([sample(NOW), sample(NOW + 30000), sample(NOW + 60000, { state: 'ended' })])
    stays([sample(NOW), sample(NOW + 30000), sample(NOW + 60000, { readyz: null, state: null })])
    expect(healthyRun([sample(NOW, { startupz: 503 }), sample(NOW + 1), sample(NOW + 2)])).toHaveLength(2)
    expect(decideAutoResume(eligible({ health: [sample(NOW, { startupz: 503 }), ...healthy.map(s => ({ ...s, at: s.at + 1000 }))] }))).toMatchObject({ resume: true })
    expect(HEALTH_WINDOW).toEqual({ samples: 3, spanMs: 60000 })
  })
  it('keeps every message to one plain line with no secrets', () => {
    const verdicts = [eligible(), eligible({ marker: undefined }), eligible({ expectedCommit: OTHER, runningCommit: OTHER }), eligible({ before: control({ reasonCode: 'maintenance' }) }), eligible({ health: [] })].map(decideAutoResume)
    for (const verdict of verdicts) { expect(verdict.message).not.toMatch(/\n|seed|secret|key|password/i); expect(verdict.message.length).toBeLessThan(260) }
  })
})

const cli = (args: string[], env: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, ['scripts/hosted-control.mjs', ...args], { encoding: 'utf8', env: { ...process.env, RA_COMMIT: '', HOSTED: '', ...env } })
const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'))

describe('qualification marker written by the control CLI', () => {
  it('records the running release when an operator resumes the whole service, privately', () => {
    const dir = resources().tempDir('ra-ar-marker-'), file = join(dir, 'control.json'), marker = join(dir, MARKER_FILE)
    const args = ['--local', '--execute', '--path', file]
    expect(cli(['init', ...args]).status).toBe(0)
    expect(cli(['resume', ...args], { RA_COMMIT: SHA }).status).toBe(0)
    expect(read(marker)).toMatchObject({ commit: SHA })
    expect(Number.isFinite(Date.parse(read(marker).qualifiedAt))).toBe(true)
    expect(statSync(marker).mode & 0o777).toBe(0o600)
    expect(read(file)).toMatchObject({ admissionsPaused: false, spendingPaused: false, reasonCode: 'operator_ready' })
    const status = JSON.parse(cli(['status', ...args]).stdout)
    expect(status.qualified).toMatchObject({ commit: SHA })
  })
  it('records nothing without a release id, or for a partial or automatic resume, and pausing keeps it', () => {
    const dir = resources().tempDir('ra-ar-nomarker-'), file = join(dir, 'control.json'), marker = join(dir, MARKER_FILE)
    const args = ['--local', '--execute', '--path', file]
    cli(['init', ...args])
    expect(cli(['resume', ...args]).status).toBe(0) // no RA_COMMIT: an unidentified release is never armed
    expect(existsSync(marker)).toBe(false)
    expect(JSON.parse(cli(['status', ...args]).stdout).qualified).toBeNull()
    cli(['pause', ...args])
    expect(cli(['resume', 'admissions', ...args], { RA_COMMIT: SHA }).status).toBe(0) // spending still paused
    expect(existsSync(marker)).toBe(false)
    cli(['pause', ...args, '--reason', BOOT_REASON])
    expect(cli(['resume', ...args, '--reason', AUTO_REASON], { RA_COMMIT: SHA }).status).toBe(0) // automatic: leaves the operator's marker alone
    expect(existsSync(marker)).toBe(false)
    expect(cli(['resume', ...args], { RA_COMMIT: SHA }).status).toBe(0)
    expect(read(marker).commit).toBe(SHA)
    cli(['pause', ...args, '--reason', 'maintenance'])
    expect(read(marker).commit).toBe(SHA)
    // a whole-service resume of a release with no id (an older release, or a rollback to one) deletes
    // the marker: another release's qualification must never carry over to it
    expect(cli(['resume', ...args]).status).toBe(0)
    expect(existsSync(marker)).toBe(false)
    expect(cli(['resume', ...args], { RA_COMMIT: OTHER }).status).toBe(0)
    expect(read(marker).commit).toBe(OTHER)
    // a malformed marker is ignored, never trusted
    writeFileSync(marker, '{"commit":"nope"}')
    expect(JSON.parse(cli(['status', ...args]).stdout).qualified).toBeNull()
  })
  it('refuses to resume when the pause is no longer the expected one', () => {
    const dir = resources().tempDir('ra-ar-only-if-'), file = join(dir, 'control.json')
    const args = ['--local', '--execute', '--path', file]
    cli(['init', ...args])
    cli(['pause', ...args, '--reason', 'maintenance'])
    const refused = cli(['resume', ...args, '--reason', AUTO_REASON, '--only-if-reason', BOOT_REASON])
    expect(refused.status).not.toBe(0)
    expect(refused.stderr).toContain('not resuming')
    expect(read(file)).toMatchObject({ admissionsPaused: true, spendingPaused: true, reasonCode: 'maintenance' })
    cli(['pause', ...args, '--reason', BOOT_REASON])
    expect(cli(['resume', ...args, '--reason', AUTO_REASON, '--only-if-reason', BOOT_REASON]).status).toBe(0)
    expect(read(file)).toMatchObject({ admissionsPaused: false, spendingPaused: false, reasonCode: AUTO_REASON })
    // the CLI's own refusals still apply: an expired control is never resumed
    writeFileSync(file, JSON.stringify(control({ expiresAt: '2020-01-01T00:00:00Z' })))
    expect(cli(['resume', ...args, '--only-if-reason', BOOT_REASON]).status).not.toBe(0)
  })
})

/** A stand-in for the API: /startupz and /readyz follow the real control file; the Host header must match. */
async function fakeApi(controlFile: string, behaviour: { startupz?: number; failFirst?: number; onSample?: () => void } = {}) {
  const hosts: string[] = []
  let samples = 0
  const server: Server = createServer((req, res) => {
    hosts.push(String(req.headers.host))
    const doc = (() => { try { return JSON.parse(readFileSync(controlFile, 'utf8')) } catch { return undefined } })()
    const paused = !doc || doc.admissionsPaused || doc.spendingPaused
    res.setHeader('content-type', 'application/json')
    if (req.url === '/startupz') { samples++; behaviour.onSample?.(); res.statusCode = samples <= (behaviour.failFirst ?? 0) ? 503 : behaviour.startupz ?? 200; res.end(JSON.stringify({ status: 'ok' })); return }
    if (req.url === '/readyz') { res.statusCode = paused ? 503 : 200; res.end(JSON.stringify({ status: paused ? 'paused' : 'ready' })); return }
    res.statusCode = 404; res.end('{}')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  resources().defer(() => new Promise<void>(resolve => server.close(() => resolve())))
  return { port, hosts, samples: () => samples }
}
/** A virtual clock: sleeping advances it, so a ten-minute wait costs no real time. */
const clock = () => { let t = Date.parse('2026-11-12T00:00:00Z'); return { now: () => t, sleep: async (ms: number) => { t += ms } } }

describe('guarded auto-resume runner', () => {
  const setup = (before: ControlDocument | undefined, marker: { commit: string } | undefined, now = control()) => {
    const dir = resources().tempDir('ra-ar-run-')
    writeFileSync(join(dir, 'control.json'), JSON.stringify(now) + '\n')
    if (before) writeFileSync(join(dir, BOOT_CONTROL_FILE), JSON.stringify(before) + '\n')
    if (marker) writeFileSync(join(dir, MARKER_FILE), JSON.stringify({ ...marker, qualifiedAt: '2026-11-11T20:00:00Z' }) + '\n')
    return dir
  }
  const options = (dir: string, port: number, extra = {}) => ({ state: dir, commit: SHA, runningCommit: SHA, origin: 'https://ra-front-1.example.test', port, ...clock(), ...extra })

  it('resumes through the control CLI, leaves the operator marker alone and logs one plain line', async () => {
    const dir = setup(running(), { commit: SHA })
    const api = await fakeApi(join(dir, 'control.json'))
    const before = readFileSync(join(dir, MARKER_FILE), 'utf8')
    const line = await runAutoResume(options(dir, api.port))
    expect(line).toMatch(/^autoresume: resumed\. release aaaaaaaaaaaa was qualified by an operator at 2026-11-11T20:00:00Z, the service was running before the restart, and the API stayed healthy for 60 s \(\/startupz OK, \/readyz reporting only the pause\)\. Readiness after resume: ready\.$/)
    expect(read(join(dir, 'control.json'))).toMatchObject({ admissionsPaused: false, spendingPaused: false, reasonCode: AUTO_REASON, expiresAt: EXPIRES })
    expect(readFileSync(join(dir, MARKER_FILE), 'utf8')).toBe(before)
    expect(api.samples()).toBeGreaterThanOrEqual(3)
    // the gateway refuses any Host but the public origin, so every probe must carry it
    expect(new Set(api.hosts)).toEqual(new Set(['ra-front-1.example.test']))
  })
  it('resumes after a boot-time deploy pause that was itself the only pause', async () => {
    const dir = setup(control(), { commit: SHA })
    const api = await fakeApi(join(dir, 'control.json'))
    expect(await runAutoResume(options(dir, api.port))).toContain('only under the boot-time pause')
  })
  it('waits out a slow start, then resumes once the API has been healthy for a minute', async () => {
    const dir = setup(running(), { commit: SHA })
    const api = await fakeApi(join(dir, 'control.json'), { failFirst: 2 })
    const line = await runAutoResume(options(dir, api.port))
    expect(line).toContain('autoresume: resumed.')
    // two failed checks do not count toward the window: it needs three healthy ones after them
    expect(api.samples()).toBe(5)
  })
  it('stays paused after a deploy of a new commit', async () => {
    const dir = setup(running(), { commit: OTHER })
    const api = await fakeApi(join(dir, 'control.json'))
    const line = await runAutoResume(options(dir, api.port))
    expect(line).toBe(`autoresume: stayed paused (new_release): release ${'a'.repeat(12)} was deployed but only ${'b'.repeat(12)} was qualified by an operator`)
    expect(read(join(dir, 'control.json')).admissionsPaused).toBe(true)
    expect(api.samples()).toBe(0)
  })
  it.each([
    ['an operator pause before the restart', () => setup(control({ reasonCode: 'maintenance' }), { commit: SHA }), 'operator_pause'],
    ['a budget pause before the restart', () => setup(control({ reasonCode: 'budget_cap' }), { commit: SHA }), 'operator_pause'],
    ['no qualification', () => setup(running(), undefined), 'not_qualified'],
    ['no record of the state before the restart', () => setup(undefined, { commit: SHA }), 'unknown_before'],
    ['an expired control', () => setup(running({ expiresAt: '2026-11-11T00:00:00Z' }), { commit: SHA }, control({ expiresAt: '2026-11-11T00:00:00Z' })), 'expired'],
    ['an operator pause set after the restart', () => setup(running(), { commit: SHA }, control({ reasonCode: 'maintenance' })), 'operator_pause_now'],
  ])('stays paused on %s', async (_name, build, code) => {
    const dir = build()
    const api = await fakeApi(join(dir, 'control.json'))
    const before = readFileSync(join(dir, 'control.json'), 'utf8')
    const line = await runAutoResume(options(dir, api.port))
    expect(line).toMatch(new RegExp(`^autoresume: stayed paused \\(${code}\\): `))
    expect(readFileSync(join(dir, 'control.json'), 'utf8')).toBe(before)
  })
  it('stays paused when the API never becomes healthy within the wait', async () => {
    const dir = setup(running(), { commit: SHA })
    const api = await fakeApi(join(dir, 'control.json'), { startupz: 503 })
    const before = readFileSync(join(dir, 'control.json'), 'utf8')
    const line = await runAutoResume(options(dir, api.port, { maxWaitMs: 300000 }))
    expect(line).toMatch(/^autoresume: stayed paused \(unhealthy\): the API was not healthy for 60 s across 3 checks \(last: \/startupz 503, \/readyz 503 \(paused\)\)$/)
    expect(readFileSync(join(dir, 'control.json'), 'utf8')).toBe(before)
    expect(api.samples()).toBeGreaterThan(3)
  })
  it('stays paused when nothing answers, and when an operator pauses while it is still sampling', async () => {
    const dir = setup(running(), { commit: SHA })
    expect(await runAutoResume(options(dir, 1, { maxWaitMs: 120000 }))).toMatch(/\(unhealthy\).*no answer/)
    const api = await fakeApi(join(dir, 'control.json'), { onSample: (() => { let n = 0; return () => { if (++n === 3) writeFileSync(join(dir, 'control.json'), JSON.stringify(control({ reasonCode: 'maintenance' })) + '\n') } })() })
    expect(await runAutoResume(options(dir, api.port))).toMatch(/^autoresume: stayed paused \(operator_pause_now\)/)
    expect(read(join(dir, 'control.json')).reasonCode).toBe('maintenance')
  })
  it('stays paused when the origin is unknown, and when the resume command itself refuses', async () => {
    const dir = setup(running(), { commit: SHA })
    expect(await runAutoResume(options(dir, 1, { origin: '' }))).toMatch(/\(no_origin\)/)
    const api = await fakeApi(join(dir, 'control.json'))
    const refuses = join(resources().tempDir('ra-ar-cli-'), 'cli.mjs')
    writeFileSync(refuses, "console.error('Error: Control missing, invalid or expired'); process.exit(1)\n")
    expect(await runAutoResume(options(dir, api.port, { cli: refuses }))).toBe('autoresume: stayed paused (resume_refused): the resume command refused (Control missing, invalid or expired)')
    expect(read(join(dir, 'control.json')).admissionsPaused).toBe(true)
  })
  it('reports, without re-pausing, a resume that is not ready yet', async () => {
    const dir = setup(running(), { commit: SHA })
    const server = createServer((req, res) => {
      const doc = read(join(dir, 'control.json'))
      res.setHeader('content-type', 'application/json')
      res.statusCode = req.url === '/startupz' ? 200 : 503
      res.end(JSON.stringify({ status: req.url === '/startupz' ? 'ok' : doc.admissionsPaused || doc.spendingPaused ? 'paused' : 'degraded' }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    resources().defer(() => new Promise<void>(resolve => server.close(() => resolve())))
    const line = await runAutoResume(options(dir, (server.address() as { port: number }).port))
    expect(line).toMatch(/^autoresume: resumed\. .* Readiness after resume: not ready yet \(degraded\); new work is refused until it clears by itself\.$/)
    expect(read(join(dir, 'control.json')).admissionsPaused).toBe(false)
  })
  it('runs as the image command with only an ephemeral port and prints one line', () => {
    const dir = setup(running(), undefined)
    const out = execFileSync(process.execPath, ['docker/hosted/autoresume.mjs', '--state', dir, '--commit', SHA, '--origin', 'https://ra-front-1.example.test', '--port', '1'], { encoding: 'utf8', env: { ...process.env, RA_COMMIT: SHA } })
    expect(out.trim().split('\n')).toHaveLength(1)
    expect(out).toContain('autoresume: stayed paused (not_qualified)')
    expect(readFileSync(join(dir, 'autoresume.log'), 'utf8')).toMatch(/^\d{4}-\d\d-\d\dT[\d:.]+Z autoresume: stayed paused \(not_qualified\)/)
    expect(statSync(join(dir, 'autoresume.log')).mode & 0o777).toBe(0o600)
    expect(spawnSync(process.execPath, ['docker/hosted/autoresume.mjs', '--bogus'], { encoding: 'utf8' }).stdout).toContain('stayed paused (error)')
  })
})

describe('startup script wiring', () => {
  const startup = readFileSync('docker/hosted/startup.sh', 'utf8')
  it('is valid shell, as are the other VM scripts', () => {
    for (const file of ['docker/hosted/startup.sh', 'docker/hosted/update.sh']) expect(spawnSync('bash', ['-n', file]).status).toBe(0)
  })
  it('copies the control file before the boot-time pause and clears the qualification on any later run', () => {
    const block = startup.slice(startup.indexOf('# boot-state: begin'), startup.indexOf('# boot-state: end'))
    expect(startup.indexOf('# boot-state: begin')).toBeLessThan(startup.indexOf('hosted-control.mjs pause --local --execute'))
    expect(startup.indexOf('# boot-state: begin')).toBeGreaterThan(startup.indexOf('mountpoint -q /srv/researchagent'))
    // the pause line itself is unchanged: still the CLI first, the durable file as the fallback
    expect(startup).toMatch(/hosted-control\.mjs pause --local --execute --path \/state\/control\.json --reason deploy \|\| pause_on_disk/)
    const dir = resources().tempDir('ra-ar-boot-')
    const script = block.replaceAll('/srv/researchagent', dir).replaceAll('chown 1000:1000', 'true')
    const state = (name: string) => join(dir, name)
    // a stub systemctl records what the script would ask of systemd
    const bin = resources().tempDir('ra-ar-bin-'), calls = join(bin, 'calls')
    writeFileSync(join(bin, 'systemctl'), `#!/bin/sh\necho "$@" >>'${calls}'\n`, { mode: 0o700 })
    const exec = (bootRun: number) => execFileSync('bash', ['-c', `set -euo pipefail\nboot_run=${bootRun}\n${script}`], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
    // first run after a boot: the copy is the control exactly as it was, privately
    writeFileSync(state('control.json'), '{"admissionsPaused":false,"spendingPaused":false,"reasonCode":"operator_ready","expiresAt":"2026-11-19T16:00:00Z"}\n')
    writeFileSync(state('qualified.json'), `{"commit":"${SHA}","qualifiedAt":"2026-11-11T20:00:00Z"}\n`)
    exec(1)
    expect(readFileSync(state(BOOT_CONTROL_FILE), 'utf8')).toBe(readFileSync(state('control.json'), 'utf8'))
    expect(statSync(state(BOOT_CONTROL_FILE)).mode & 0o777).toBe(0o600)
    expect(existsSync(state('qualified.json'))).toBe(true)
    expect(existsSync(calls)).toBe(false) // a boot run never touches systemd here
    // a stale copy never survives a boot with no control file
    writeFileSync(state(BOOT_CONTROL_FILE), 'stale')
    execFileSync('rm', [state('control.json')])
    exec(1)
    expect(existsSync(state(BOOT_CONTROL_FILE))).toBe(false)
    // any later run (an operator deploy or re-render) drops the marker and the copy
    writeFileSync(state(BOOT_CONTROL_FILE), '{}')
    exec(0)
    expect(existsSync(state('qualified.json'))).toBe(false)
    expect(existsSync(state(BOOT_CONTROL_FILE))).toBe(false)
    expect(readFileSync(calls, 'utf8').trim()).toBe('stop researchagent-autoresume.service')
  })
  it('detects the first run after a boot with a file in /run, which a reboot clears', () => {
    const detect = startup.slice(startup.indexOf('boot_run=1'), startup.indexOf(': >/run/researchagent-startup.seen') + ': >/run/researchagent-startup.seen'.length)
    const dir = resources().tempDir('ra-ar-seen-')
    const script = detect.replaceAll('/run/researchagent-startup.seen', join(dir, 'seen'))
    // Read the result from a file, not stdout, and give the child a minimal environment: the answer must not
    // depend on whatever the surrounding runner exports.
    const out = join(dir, 'boot_run')
    const bootRun = () => {
      execFileSync('/bin/bash', ['-c', `set -euo pipefail\n${script}\nprintf '%s' "$boot_run" >'${out}'`], { env: { PATH: '/usr/bin:/bin' }, stdio: 'ignore' })
      return readFileSync(out, 'utf8')
    }
    expect(bootRun()).toBe('1')
    expect(bootRun()).toBe('0')
    expect(bootRun()).toBe('0')
    execFileSync('rm', [join(dir, 'seen')]) // a reboot
    expect(bootRun()).toBe('1')
  })
  it('starts the decision detached, only on a boot run and only after the release marker, never fatally', () => {
    const tail = startup.slice(startup.lastIndexOf('researchagent-startup.done'))
    expect(tail).toContain('if (( boot_run )); then')
    expect(tail).toContain('systemd-run --unit=researchagent-autoresume --collect --no-block --setenv=HOME=/root -p SyslogIdentifier=researchagent-autoresume')
    expect(tail).toContain('exec -T api \\\n    node /app/docker/hosted/autoresume.mjs --commit "$commit" || true')
    expect(startup.lastIndexOf('researchagent-startup.done')).toBeLessThan(startup.indexOf('systemd-run'))
    expect(startup.match(/systemd-run/g)).toHaveLength(1)
    // a later run stops a decision left over from the boot before it clears the marker
    expect(startup).toContain('systemctl stop researchagent-autoresume.service || true')
  })
  it('names the release for the API container so an operator resume can qualify it', () => {
    expect(readFileSync('docker/hosted/compose.yaml', 'utf8')).toContain('RA_COMMIT: ${RA_COMMIT:-}')
    expect(readFileSync('docker/hosted/ops.mjs', 'utf8')).toContain('`RA_COMMIT=${sha}`')
    expect(readFileSync('docker/hosted/Dockerfile', 'utf8')).toContain('COPY docker/hosted/ docker/hosted/')
    // the CLI is the only writer of the marker; the resume it runs is the operator CLI with --local
    const run = readFileSync('docker/hosted/autoresume.mjs', 'utf8')
    expect(run).toContain("'resume', 'all', '--local', '--execute'")
    expect(run).not.toMatch(/writeFileSync|renameSync/)
  })
})
