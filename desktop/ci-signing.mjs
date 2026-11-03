// CI-only, secret values never reach logs. A partial configuration fails closed.
import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
const names = ['APPLE_CERTIFICATE_BASE64', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_ID', 'APPLE_TEAM_ID', 'APPLE_APP_SPECIFIC_PASSWORD']
const enabled = names.some(name => process.env[name])
if (!enabled) { console.log('No Developer ID secrets; unsigned build.'); process.exit(0) }
if (names.some(name => !process.env[name])) throw new Error('Incomplete Developer ID secrets')
const dir = process.env.RUNNER_TEMP
const file = join(dir, 'researchagent-signing.p12')
const keychain = join(dir, 'researchagent-signing.keychain-db')
const password = randomBytes(32).toString('hex')
const run = (command, args) => execFileSync(command, args, { stdio: 'ignore' })
try {
  writeFileSync(file, Buffer.from(process.env.APPLE_CERTIFICATE_BASE64, 'base64'), { mode: 0o600 })
  run('security', ['create-keychain', '-p', password, keychain])
  run('security', ['set-keychain-settings', '-lut', '21600', keychain])
  run('security', ['unlock-keychain', '-p', password, keychain])
  run('security', ['import', file, '-k', keychain, '-P', process.env.APPLE_CERTIFICATE_PASSWORD, '-T', '/usr/bin/codesign'])
  run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain])
  run('security', ['list-keychains', '-d', 'user', '-s', keychain, 'login.keychain-db'])
  run('security', ['default-keychain', '-s', keychain])
  run('xcrun', ['notarytool', 'store-credentials', 'ra-notary', '--apple-id', process.env.APPLE_ID, '--team-id', process.env.APPLE_TEAM_ID, '--password', process.env.APPLE_APP_SPECIFIC_PASSWORD, '--keychain', keychain])
  appendFileSync(process.env.GITHUB_ENV, 'RA_REQUIRE_SIGNING=1\n')
  console.log('Developer ID imported; build will sign, notarise and staple.')
} catch { throw new Error('Developer ID provisioning failed; refusing unsigned fallback') }
finally { unlinkSync(file) }
