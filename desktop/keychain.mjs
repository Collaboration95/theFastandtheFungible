import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
const exec = promisify(execFile)
const service = process.env.RA_DESKTOP_KEYCHAIN_SERVICE || 'ResearchAgent'
if (!/^ResearchAgent(?:-Accept-[a-zA-Z0-9-]+)?$/.test(service)) throw new Error('Invalid Keychain service')
export async function readSecret(account) {
  try {
    const { stdout } = await exec('/usr/bin/security', ['find-generic-password', '-s', service, '-a', account, '-w'])
    const record = JSON.parse(Buffer.from(stdout.trim(), 'base64').toString())
    if (record.network !== 'xrpl:1' || typeof record.value !== 'string') throw new Error('Invalid Keychain record')
    return record.value
  } catch (error) {
    if (error.code === 44) return undefined
    throw new Error('Keychain unavailable; unlock the login Keychain and try again')
  }
}
export async function writeSecret(account, value) {
  // Send the credential on stdin, never in argv or a shell, and never reflect subprocess output.
  const record = Buffer.from(JSON.stringify({ network: 'xrpl:1', value })).toString('base64')
  await new Promise((done, fail) => {
    const child = spawn('/usr/bin/security', ['-i'], { stdio: ['pipe', 'ignore', 'ignore'] })
    child.once('error', () => fail(new Error('Keychain write failed')))
    child.once('exit', code => code === 0 ? done() : fail(new Error('Keychain write failed')))
    child.stdin.end(`add-generic-password -U -s ${service} -a ${account} -w ${record}\n`)
  })
  if (await readSecret(account) !== value) throw new Error('Keychain write could not be verified')
}
