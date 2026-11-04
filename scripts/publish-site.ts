#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { publishSite } from '../publisher/publishing/publish.js'

export async function main(args = process.argv.slice(2)) {
  try {
    const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
      testnet: { type: 'boolean' }, slug: { type: 'string' }, name: { type: 'string' }, port: { type: 'string' }, rail: { type: 'string' }, help: { type: 'boolean' },
    } })
    if (values.help) {
      console.log('Usage: npm run publish:site -- ./my-notes [--slug my-notes] [--name "My Notes"] [--port 9590] [--rail simulated]\nDefault: XRPL Testnet wallet + faucet. Never pass seeds as arguments. Ctrl-C stops the site; rerun to update it.')
      return
    }
    if (positionals.length !== 1) throw new Error('Give one Markdown folder. Try: npm run publish:site -- examples/writer-starter')
    const rail = values.testnet || values.rail === 'testnet' ? 'xrpl-testnet' : values.rail ?? 'xrpl-testnet'
    if (rail !== 'simulated' && rail !== 'xrpl-testnet') throw new Error('--rail must be xrpl-testnet or simulated; Mainnet is disabled')
    const port = Number(values.port ?? 8790 + Number(process.env.OFFSET || 0))
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port must be an integer from 0 to 65535')
    const folder = resolve(positionals[0])
    const running: { site?: Awaited<ReturnType<typeof publishSite>>; stopping: boolean } = { stopping: false }
    const shutdown = () => { running.stopping = true; running.site?.server.close(); running.site?.server.closeAllConnections() }
    // Install before readiness output: a terminal/host may stop us immediately on ready.
    process.once('SIGINT', shutdown)
    process.once('SIGTERM', shutdown)
    running.site = await publishSite({ folder, slug: values.slug ?? basename(folder), name: values.name, port, rail })
    if (running.stopping) shutdown()
  } catch (error) {
    // Library failures can include submitted credentials. Only our actionable messages leave this boundary.
    const message = error instanceof Error ? error.message : ''
    const secrets = Object.entries(process.env).filter(([k, v]) => /KEY|TOKEN|SECRET|SEED/.test(k) && v).map(([, v]) => v!)
    const safe = secrets.reduce((text, value) => text.replaceAll(value, '[REDACTED]'), message)
      .replace(/\bs(?:Ed[1-9A-HJ-NP-Za-km-z]{20,}|[1-9A-HJ-NP-Za-km-z]{27,})\b/g, '[REDACTED]')
    console.error(`Publish failed: ${safe}`)
    process.exitCode = 1
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main()
