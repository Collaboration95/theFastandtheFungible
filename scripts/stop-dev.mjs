import { execFileSync } from 'node:child_process'

const projectRoot = process.cwd()
const ports = [5100, 8788]
const projectPids = new Set()

const normalizeForComparison = (value) => process.platform === 'win32'
  ? value.replaceAll('\\', '/').toLowerCase()
  : value

const isProjectProcess = (command) => normalizeForComparison(command).includes(normalizeForComparison(projectRoot))

const readUnixProcessCommand = (pid) => execFileSync('ps', ['-p', pid, '-o', 'command='], { encoding: 'utf8' }).trim()

const readUnixListeningPids = (port) => {
  try {
    return execFileSync('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
      .trim()
      .split(/\s+/)
      .filter(Boolean)
  } catch (error) {
    // lsof exits 1 when no matching listener exists; that is a clean result.
    if (error.status === 1 && !error.code) return []
    throw error
  }
}

const readWindowsProcessCommand = (pid) => {
  const command = [
    '$process = Get-CimInstance Win32_Process -Filter "ProcessId = ' + pid + '" -ErrorAction Stop',
    'if ($null -ne $process) { $process.CommandLine }',
  ].join('; ')
  return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8' }).trim()
}

const readWindowsListeningPids = (port) => {
  const output = execFileSync('netstat.exe', ['-ano', '-p', 'tcp'], { encoding: 'utf8' })
  const portSuffix = `:${port}`
  return output.split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/))
    .filter((columns) => columns.length >= 5 && columns[0].toUpperCase() === 'TCP')
    .filter((columns) => columns[1].endsWith(portSuffix) && columns[3].toUpperCase() === 'LISTENING')
    .map((columns) => columns[4])
}

let inspectionAvailable = true

for (const port of ports) {
  let pids
  try {
    pids = process.platform === 'win32'
      ? readWindowsListeningPids(port)
      : readUnixListeningPids(port)
  } catch (error) {
    inspectionAvailable = false
    console.warn(`Could not inspect port ${port}; leaving any process untouched (${error.code ?? error.message}).`)
    continue
  }

  for (const pid of pids) {
    let command
    try {
      command = process.platform === 'win32' ? readWindowsProcessCommand(pid) : readUnixProcessCommand(pid)
    } catch (error) {
      inspectionAvailable = false
      console.warn(`Could not inspect process ${pid} on port ${port}; leaving it untouched (${error.code ?? error.message}).`)
      continue
    }
    if (isProjectProcess(command)) projectPids.add(pid)
  }
}

if (projectPids.size === 0) {
  if (inspectionAvailable) console.log('No ResearchAgent dev processes found.')
  else console.warn('ResearchAgent dev process inspection was incomplete; no process was terminated without a project match.')
  process.exit(0)
}

for (const pid of projectPids) {
  try {
    process.kill(Number(pid), 'SIGTERM')
    console.log(`Stopped ResearchAgent dev process ${pid}.`)
  } catch (error) {
    console.error(`Could not stop process ${pid}: ${error.message}`)
    process.exitCode = 1
  }
}
