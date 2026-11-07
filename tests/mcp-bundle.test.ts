import { it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { Ajv } from 'ajv'
import { parse } from 'smol-toml'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

it('ships a validated extension that lists tools and clamps user-config caps over stdio', async () => {
  execFileSync('npm', ['run', 'build:mcpb'], { stdio: 'pipe' })
  const dir = mkdtempSync(join(tmpdir(), 'mcpb-'))
  execFileSync('unzip', ['-q', resolve('dist/ResearchAgent.mcpb'), '-d', dir])
  // Exercise the shipped dispatch: the slim builder must retain init and both templates.
  const starter = join(dir, 'starter')
  execFileSync(process.execPath, [join(dir, 'mcp/extension.mjs'), 'init', starter], { stdio: 'pipe' })
  expect(readdirSync(starter)).toEqual(['1-capacity.md', '2-allocation.md'])
  for (const file of readdirSync(starter)) expect(readFileSync(join(starter, file), 'utf8')).toBe(readFileSync(join('examples/writer-starter', file), 'utf8'))
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  const schema = JSON.parse(readFileSync('node_modules/@anthropic-ai/mcpb/dist/mcpb-manifest-v0.3.schema.json', 'utf8'))
  const ajv = new Ajv({ strict: false, validateFormats: false })
  expect(ajv.validate(schema, manifest), JSON.stringify(ajv.errors)).toBe(true)
  expect(ajv.validate(JSON.parse(readFileSync('mcp/schemas/server-2025-12-11.schema.json', 'utf8')), JSON.parse(readFileSync('dist/server.json', 'utf8'))), JSON.stringify(ajv.errors)).toBe(true)
  expect(manifest.user_config.payer_seed.sensitive).toBe(true)
  const env = Object.fromEntries(Object.entries(manifest.server.mcp_config.env).map(([k,v]) => [k, String(v).replace(/\$\{user_config\.(\w+)\}/g, (_, key) => String(({ question_cap: 100, daily_cap: 50 } as Record<string, number>)[key] ?? manifest.user_config[key].default ?? '')).replace('${HOME}', dir)]))
  env.RA_DATA_DIR = join(dir, 'ledger')
  const transport = new StdioClientTransport({ command: process.execPath, args: manifest.server.mcp_config.args.map((s: string) => s.replaceAll('${__dirname}', dir)), env: { PATH: process.env.PATH!, ...env }, stderr: 'pipe' })
  let stderr = ''
  transport.stderr?.on('data', chunk => { stderr += chunk.toString() })
  const client = new Client({ name: 'bundle-test', version: '1' })
  try {
    await client.connect(transport).catch(error => { throw new Error(stderr, { cause: error }) })
    const tools = (await client.listTools()).tools.map(t => t.name)
    expect(tools).toEqual(expect.arrayContaining(['ask_expert', 'wallet_status', 'verify_answer', 'hire']))
    const result = await client.callTool({ name: 'ask_expert', arguments: { question: 'Kestrel Semiconductor TSMC pricing and margins?', budget_sgd: 999, idempotency_key: 'bundle-cap' } })
    expect(result.isError).not.toBe(true)
    const run = JSON.parse((result.content as { text: string }[])[0].text)
    expect(run.budgetMinor).toBe(50)
    expect(run.spentMinor).toBeLessThanOrEqual(50)
    expect(run.labels.settlement).toContain('SIMULATED')
    const docs = readFileSync('docs/mcp.md', 'utf8')
    for (const match of docs.matchAll(/```(json|toml)\n([\s\S]*?)```/g)) {
      const config = match[1] === 'json' ? JSON.parse(match[2]) : parse(match[2])
      const servers = config.mcpServers ?? config.servers ?? config.mcp_servers
      expect(servers.researchagent).toBeDefined()
      for (const arg of servers.researchagent.args ?? []) if (arg.startsWith('/absolute/checkout/')) expect(existsSync(arg.replace('/absolute/checkout', process.cwd()))).toBe(true)
    }
    for (const tool of tools) expect(docs).toContain('`' + tool + '`')
  } finally { await client.close(); rmSync(dir, { recursive: true, force: true }) }
}, 120_000)
