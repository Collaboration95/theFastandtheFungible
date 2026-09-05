import { execFileSync } from 'node:child_process'

const projectRoot = process.cwd()
const ports = [5173, 5174, 8788]
const projectPids = new Set()

for (const port of ports) {
  let output = ''
  try {
    output = execFileSync('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
  } catch {
    continue
  }

  for (const pid of output.trim().split(/\s+/).filter(Boolean)) {
    let command = ''
    try {
      command = execFileSync('ps', ['-p', pid, '-o', 'command='], { encoding: 'utf8' }).trim()
    } catch {
      continue
    }
    if (command.includes(projectRoot)) projectPids.add(pid)
  }
}

if (projectPids.size === 0) {
  console.log('No ResearchAgent dev processes found.')
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
