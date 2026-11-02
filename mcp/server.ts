import dotenv from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { startEngine } from '../server/engine.js'
import { createMcpServer } from './tools.js'

// A client can launch this entry from any directory; corpus paths stay repository-relative.
const root = fileURLToPath(new URL('..', import.meta.url))
process.chdir(root)
dotenv.config({ path: resolve(root, '.env'), quiet: true })
const dataDir = resolve(process.env.RA_DATA_DIR ?? resolve(root, 'data/mcp'))
let engine: Awaited<ReturnType<typeof startEngine>> | undefined
try {
  const apiUrl = process.env.RA_BACKEND_URL || (engine = await startEngine({ dataDir, live: process.env.RA_LIVE === '1' })).apiUrl
  const server = createMcpServer(apiUrl)
  let closing = false
  const close = async () => {
    if (closing) return
    closing = true
    await server.close()
    await engine?.close()
  }
  server.server.onclose = () => { void close() }
  process.once('SIGINT', () => { void close() })
  process.once('SIGTERM', () => { void close() })
  await server.connect(new StdioServerTransport())
} catch {
  console.error('ResearchAgent MCP startup failed; check operator configuration. No credentials are logged.')
  await engine?.close()
  process.exitCode = 1
}
