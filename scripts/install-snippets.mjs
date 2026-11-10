import { readFileSync, writeFileSync } from 'node:fs'
import { pythonVersion } from './release-version.mjs'
// Generate exact release-asset commands; npm prereleases map to PEP 440 wheel versions.
const tag = process.argv[process.argv.indexOf('--tag') + 1]
if (!/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(tag || '')) throw Error('Usage: node scripts/install-snippets.mjs --tag v1.0.0')
const v = tag.slice(1)
const base = `https://github.com/Collaboration95/theFastandtheFungible/releases/download/${tag}`
const mcp = `claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- ${process.argv.includes('--powershell') ? 'cmd /c npx' : 'npx'} -y ${base}/researchagent-mcp-${v}.tgz`
const app = `npx -y ${base}/researchagent-mcp-${v}.tgz app --testnet`
const portable = `npx -y ${base}/researchagent-mcp-${v}.tgz`
const engine = `${portable} app --port 6400`
const writer = `${portable} init my-notes\n${portable} publish ./my-notes --testnet`
const fence = (lang, code) => '```' + lang + '\n' + code + '\n```'
const engineGuide = `Start in an empty folder. Requires Node ≥22.13 (including for the Python engine); Python ≥3.10 for the Python client. Terminal 1, macOS/Linux:\n\n${fence('sh', 'export MCP_MAX_BUDGET_MINOR=200 MCP_DAILY_CAP_MINOR=500')}\n\nTerminal 1, Windows PowerShell:\n\n${fence('powershell', '$env:MCP_MAX_BUDGET_MINOR="200"; $env:MCP_DAILY_CAP_MINOR="500"')}\n\nThen, in the same terminal on any platform:\n\n${fence('sh', engine)}\n\nKeep it running. This uses fixture models, fictional writers and SIMULATED payments (no real value). Caps authorize up to S$2 per ask and S$5 gross per UTC day. For XRPL Testnet append \`--testnet\`; for TEST-SGD (stand-in for RLUSD, no real value) also append \`--iou\`. Cold IOU setup can take about two minutes. Use another port if 6400 is busy.\n\nThe UI port (6400 here) is **not** the engine port. Copy the printed engine baseUrl and token-file path for Terminal 2. The token is read from its private file; never paste it into source or a URL.`
const js = `import { readFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@researchagent/sdk'
const [baseUrl, tokenFile] = process.argv.slice(2)
if (!baseUrl || !tokenFile) throw Error('Usage: node ask.mjs ENGINE_URL TOKEN_FILE (copy both from app output)')
const client = createClient({ baseUrl, token: readFileSync(tokenFile, 'utf8').trim() })
const run = await client.ask("What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC (pricing & margins)?", { budget: 2, idempotencyKey: 'quickstart-1' })
console.log(run.answer, run.labels, run.citations)
const receipts = await client.receipts(run.run_id)
writeFileSync('receipts.json', JSON.stringify(receipts, null, 2))
const verified = await client.verify(receipts)
console.log(verified)
if (!verified.ok) process.exitCode = 1`
const py = `import json
import sys
from pathlib import Path
from researchagent import Client
if len(sys.argv) != 3:
    raise SystemExit('Usage: python ask.py ENGINE_URL TOKEN_FILE (copy both from app output)')
client = Client(sys.argv[1], token=Path(sys.argv[2]).read_text().strip())
run = client.ask("What's the analyst outlook on Kestrel Semiconductor's latest deal with TSMC (pricing & margins)?", budget=2, idempotency_key='quickstart-python-1').result()
print(run['answer'], run['labels'], run['citations'])
receipts = client.receipts(run['run_id'])
Path('receipts.json').write_text(json.dumps(receipts, indent=2))
verified = client.verify(receipts)
print(verified)
if not verified['ok']:
    raise SystemExit(1)`
const sdkGuide = language => engineGuide + (language === 'js'
  ? `\n\nTerminal 2, all platforms:\n\n${fence('sh', `npm init -y\nnpm i ${base}/researchagent-sdk-${v}.tgz`)}\n\nSave this as \`ask.mjs\` (plain JavaScript using the typed TypeScript SDK):\n\n${fence('js', js)}\n\nRun \`node ask.mjs "ENGINE_URL" "TOKEN_FILE"\`, replacing both quoted values with the app output.`
  : `\n\nTerminal 2, create an isolated environment:\n\n${fence('sh', 'python3 -m venv .venv\n.venv/bin/python -m pip install ' + base + '/researchagent-' + pythonVersion(v) + '-py3-none-any.whl')}\n\nWindows PowerShell equivalent:\n\n${fence('powershell', 'py -3 -m venv .venv\n.venv/Scripts/python.exe -m pip install ' + base + '/researchagent-' + pythonVersion(v) + '-py3-none-any.whl')}\n\nSave this as \`ask.py\`:\n\n${fence('python', py)}\n\nRun \`.venv/bin/python ask.py "ENGINE_URL" "TOKEN_FILE"\` (PowerShell: \`.venv/Scripts/python.exe ask.py "ENGINE_URL" "TOKEN_FILE"\`), replacing both quoted values with the app output.`) + `\n\nSuccess means an answer with mode labels/citations, a local \`receipts.json\`, and verification \`ok: true\` (Python: \`True\`). Verification above is offline. For read-only Testnet settlement **and anchor** checks use TS \`{ onlineLedger: true }\` or Python \`python -m researchagent verify receipts.json --ledger\` with the installed interpreter. Simulated evidence has no ledger proof; SKIP preserves that boundary. Reuse the same idempotency key after an uncertain response; read the retained run rather than buying again.`
if (process.argv.includes('--write') || process.argv.includes('--check')) {
  const entries = [['docs/sdk.md', 'sdk-quickstart', sdkGuide('js')], ['docs/sdk-python.md', 'sdk-quickstart', sdkGuide('py')], ['docs/install.md', 'writer-install', fence('sh', writer)], ['docs/publishing.md', 'writer-install', fence('sh', writer)], ['docs/mcp.md', 'windows-mcp', fence('powershell', mcp.replace('-- npx ', '-- cmd /c npx ') + ' --testnet')]]
  for (const [file, marker, content] of entries) {
    const before = readFileSync(file, 'utf8')
    const start = `<!-- BEGIN generated:${marker} -->`, end = `<!-- END generated:${marker} -->`
    const a = before.indexOf(start), b = before.indexOf(end)
    if (a < 0 || b < a) throw Error(`Missing ${marker} markers in ${file}`)
    const after = before.slice(0, a) + start + '\n' + content + '\n' + before.slice(b)
    if (process.argv.includes('--check') && before !== after) throw Error(`Stale generated install: ${file}`)
    if (process.argv.includes('--write')) writeFileSync(file, after)
  }
  if (process.argv.includes('--write')) writeFileSync('packages/sdk-python/README.md', readFileSync('docs/sdk-python.md', 'utf8'))
} else if (process.argv.includes('--writer')) console.log(writer)
else if (process.argv.includes('--sdk-engine')) console.log(engine)
else if (process.argv.includes('--try')) console.log(`npx -y ${base}/researchagent-mcp-${v}.tgz try --testnet`)
else if (process.argv.includes('--app')) console.log(app + (process.argv.includes('--iou') ? ' --iou' : ''))
else if (process.argv.includes('--testnet')) console.log(mcp + ' --testnet' + (process.argv.includes('--iou') ? ' --iou' : ''))
else console.log(`npm i ${base}/researchagent-sdk-${v}.tgz\npip install ${base}/researchagent-${pythonVersion(v)}-py3-none-any.whl\n${mcp}`)
