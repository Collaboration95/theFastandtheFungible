import { spawn } from 'node:child_process'
/** Drain both pipes; ask for a report before killing; always settle on spawn failure or close. */
export function runChild(args, options, { watchdogMs = 45000, graceMs = 1000 } = {}) {
  return new Promise((done, fail) => {
    const launched = Date.now(), child = spawn(process.execPath, args, { ...options, stdio: ['ignore','pipe','pipe'] })
    let tail = '', timedOut = false, killTimer
    const capture = chunk => { tail = (tail + chunk).slice(-8000) }
    child.stdout.on('data', capture); child.stderr.on('data', capture)
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGUSR2')
      killTimer = setTimeout(() => child.kill('SIGKILL'), graceMs)
    }, watchdogMs)
    const clear = () => { clearTimeout(timer); clearTimeout(killTimer) }
    child.once('error', error => { clear(); fail(error) })
    child.once('close', (code, signal) => { clear(); done({ code, signal, tail, timedOut, elapsedMs: Date.now()-launched, watchdogMs }) })
  })
}
