import { readSecret } from './keychain.mjs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from '../mcp/tools.js'
try {
  const { apiUrl, remote } = JSON.parse(await readFile(join(process.argv[2], 'engine.json'), 'utf8'))
  const url = new URL(apiUrl)
  if (remote ? url.protocol !== 'https:' : (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || !url.port)) throw new Error('Local engine required')
  const token = await readSecret(remote ? 'api-token' : 'local-api-token')
  if (!token) throw new Error('Enable MCP from Desktop Settings first')
  const server = createMcpServer(url.origin, token)
  await server.connect(new StdioServerTransport())
} catch { console.error('Open ResearchAgent before starting its MCP connection.'); process.exitCode = 1 }
