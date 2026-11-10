// Small process helpers shared by the recorder and the assembler.
import { spawn } from 'node:child_process'

/** Run a command to completion; resolves with {code, stdout, stderr}. Never prints the environment. */
export function run(cmd, args, { cwd, env, input, quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: env ?? process.env, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', d => { stdout += d })
    child.stderr.on('data', d => { stderr += d })
    child.on('error', reject)
    child.on('close', code => {
      if (!quiet && stderr) process.stderr.write(stderr)
      resolve({ code, stdout, stderr })
    })
    if (input !== undefined) child.stdin.end(input); else child.stdin.end()
  })
}

/** Like run, but throws with the tail of stderr on a non-zero exit. */
export async function must(cmd, args, options) {
  const result = await run(cmd, args, options)
  if (result.code !== 0) throw new Error(`${cmd} ${args.slice(0, 4).join(' ')} … exited ${result.code}\n${result.stderr.split('\n').slice(-12).join('\n')}`)
  return result
}

export async function durationOf(file) {
  const { stdout } = await must('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file])
  return Number(stdout.trim())
}
