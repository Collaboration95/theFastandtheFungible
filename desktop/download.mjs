// GitHub access goes exclusively through authenticated gh, including Electron binaries.
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
const { devDependencies: { electron: version } } = JSON.parse(readFileSync('package.json'))
const target = 'node_modules/electron/dist'
const requestedArch = process.env.DESKTOP_ARCH || 'arm64'
if (!['arm64', 'x64'].includes(requestedArch)) throw new Error('Invalid desktop architecture')
if (existsSync(join(target, 'Electron.app/Contents/MacOS/Electron'))) {
  const actual = execFileSync('lipo', ['-archs', join(target, 'Electron.app/Contents/MacOS/Electron')], { encoding: 'utf8' }).trim()
  if (actual !== (requestedArch === 'x64' ? 'x86_64' : requestedArch)) rmSync(target, { recursive: true, force: true })
}
const executable = 'Electron.app/Contents/MacOS/Electron'
if (!existsSync(join(target, executable))) {
  if (process.platform !== 'darwin') throw new Error('Desktop packaging requires macOS')
  const temp = mkdtempSync(join(tmpdir(), 'researchagent-electron-'))
  try {
    const asset = `electron-v${version}-darwin-${requestedArch}.zip`
    execFileSync('gh', ['release', 'download', `v${version}`, '--repo', 'electron/electron', '--pattern', asset, '--dir', temp], { stdio: 'inherit' })
    execFileSync('gh', ['release', 'download', `v${version}`, '--repo', 'electron/electron', '--pattern', 'SHASUMS256.txt', '--dir', temp], { stdio: 'inherit' })
    const expected = readFileSync(join(temp, 'SHASUMS256.txt'), 'utf8').split('\n').find(line => line.trim().split(/\s+/)[1]?.replace(/^\*/, '') === asset)?.split(/\s+/)[0]
    if (!expected || createHash('sha256').update(readFileSync(join(temp, asset))).digest('hex') !== expected) throw new Error('Electron checksum mismatch')
    mkdirSync(target, { recursive: true })
    execFileSync('unzip', ['-q', join(temp, asset), '-d', target])
  } finally { rmSync(temp, { recursive: true, force: true }) }
}
writeFileSync('node_modules/electron/path.txt', executable)
const vendor = 'node_modules/.cache/researchagent-dmg'
if (!existsSync(join(vendor, 'dmgbuild'))) {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64'
  const asset = `dmgbuild-bundle-${arch}-75c8a6c.tar.gz`
  const temp = mkdtempSync(join(tmpdir(), 'researchagent-dmg-'))
  try {
    execFileSync('gh', ['release', 'download', 'dmg-builder@1.2.5', '--repo', 'electron-userland/electron-builder-binaries', '--pattern', asset, '--dir', temp], { stdio: 'inherit' })
    const expected = arch === 'arm64' ? '793404d0c96687e27d5ee40a668d498c92e36a64d6c2906df511031adb33cbeb' : '1664972f9cc2d6e8fce3b63e42cd30078aff602669c5856939c4519921200433'
    if (createHash('sha256').update(readFileSync(join(temp, asset))).digest('hex') !== expected) throw new Error('DMG tool checksum mismatch')
    mkdirSync(vendor, { recursive: true })
    execFileSync('tar', ['-xzf', join(temp, asset), '-C', vendor])
  } finally { rmSync(temp, { recursive: true, force: true }) }
}
