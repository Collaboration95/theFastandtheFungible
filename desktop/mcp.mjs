import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from '../mcp/tools.js'
try {
  const { apiUrl } = JSON.parse(await readFile(join(process.argv[2], 'engine.json'), 'utf8'))
  const url = new URL(apiUrl)
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || !url.port) throw new Error('Local engine required')
  const server = createMcpServer(url.origin)
  await server.connect(new StdioServerTransport())
} catch { console.error('Open ResearchAgent before starting its MCP connection.'); process.exitCode = 1 }
