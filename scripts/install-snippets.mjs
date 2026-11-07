import { pythonVersion } from './release-version.mjs'
// Generate exact release-asset commands; npm prereleases map to PEP 440 wheel versions.
const tag = process.argv[process.argv.indexOf('--tag') + 1]
if (!/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(tag || '')) throw Error('Usage: node scripts/install-snippets.mjs --tag v1.0.0')
const v = tag.slice(1)
const base = `https://github.com/Collaboration95/theFastandtheFungible/releases/download/${tag}`
const mcp = `claude mcp add researchagent -e MCP_MAX_BUDGET_MINOR=200 -e MCP_DAILY_CAP_MINOR=500 -- npx -y ${base}/researchagent-mcp-${v}.tgz`
const app = `npx -y ${base}/researchagent-mcp-${v}.tgz app --testnet`
if (process.argv.includes('--app')) console.log(app + (process.argv.includes('--iou') ? ' --iou' : ''))
else if (process.argv.includes('--testnet')) console.log(mcp + ' --testnet' + (process.argv.includes('--iou') ? ' --iou' : ''))
else console.log(`npm i ${base}/researchagent-sdk-${v}.tgz\npip install ${base}/researchagent-${pythonVersion(v)}-py3-none-any.whl\n${mcp}`)
