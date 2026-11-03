// Preloaded before tsx/application imports: even an import-time stall leaves evidence.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
const dir = process.env.CHAOS_DIAGNOSTIC_DIR ?? process.argv[2]
const sample = phase => {
  const row = { phase, at: new Date().toISOString(), memory: process.memoryUsage(), resources: process.getActiveResourcesInfo() }
  writeFileSync(join(dir, 'progress.json'), JSON.stringify(row))
  console.error(JSON.stringify(row))
}
sample('bootstrap')
const timer = setInterval(() => sample('heartbeat'), 5000)
timer.unref()
process.on('SIGUSR2', () => {
  const report = process.report.getReport()
  // Deliberately omit environment, command line, shared objects and network addresses.
  writeFileSync(join(dir, 'diagnostic.json'), JSON.stringify({ javascriptStack: report.javascriptStack, nativeStack: report.nativeStack, resourceUsage: report.resourceUsage, libuv: report.libuv.map(({type,is_active,is_referenced}) => ({type,is_active,is_referenced})) }))
  sample('watchdog-diagnostic')
})
