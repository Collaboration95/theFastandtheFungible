import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app, dialog, shell } from 'electron'
const exec = promisify(execFile)
// Notify only, including signed builds. No archive download or installation code.
export async function checkUpdates({ quiet = false } = {}) {
  try {
    const { stdout } = await exec('gh', ['release', 'view', '--repo', 'Collaboration95/theFastandtheFungible', '--json', 'tagName,url,isPrerelease,isDraft'], { timeout: 15_000, maxBuffer: 16384 })
    const release = JSON.parse(stdout)
    const version = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(release.tagName)?.slice(1).map(Number)
    const current = app.getVersion().split('.').map(Number)
    const newer = version && version.some((v, i) => v > current[i] && version.slice(0, i).every((n, j) => n === current[j]))
    if (release.isDraft || release.isPrerelease || !newer) { if (!quiet) await dialog.showMessageBox({ message: 'ResearchAgent is up to date.' }); return }
    if (!/^https:\/\/github.com\/Collaboration95\/theFastandtheFungible\/releases\/tag\/[a-zA-Z0-9._-]+$/.test(release.url)) throw new Error('Invalid release URL')
    const choice = await dialog.showMessageBox({ message: `ResearchAgent ${release.tagName} is available`, detail: 'Open the release to download manually. Unsigned updates are never installed automatically.', buttons: ['Later', 'Open release'], defaultId: 0, cancelId: 0 })
    if (choice.response === 1) await shell.openExternal(release.url)
  } catch { if (!quiet) await dialog.showMessageBox({ message: 'Update check unavailable', detail: 'Install and authenticate the GitHub CLI (gh), then try again.' }) }
}
