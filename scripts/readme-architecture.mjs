// Generated overview of docs/contracts/ARCHITECTURE.md. Numbers match README steps.
import { readFileSync, writeFileSync } from 'node:fs'
const labels = ['1 Ask', '2 Confirm plan', '3 Search writers', '4 Judge value', '5 Policy pays', '6 Verify / challenge', '7 Cited answer']
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="390" viewBox="0 0 840 390" role="img" aria-label="Seven steps: ask, confirm plan, search writers, judge value, policy pays, verify and answer">
<rect width="840" height="390" fill="#FBF8F2"/>
<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="#24211E"/></marker></defs>
<g font-family="system-ui,sans-serif" fill="#24211E"><text x="32" y="36" font-size="18">ResearchAgent · evidence before spending</text>
${labels.map((label, i) => {
  const x = 32 + (i % 4) * 200, y = i < 4 ? 70 : 205
  return `<rect x="${x}" y="${y}" width="176" height="64" rx="4" fill="#fff" stroke="#C9BFB2"/><text x="${x + 12}" y="${y + 37}" font-size="15">${label}</text>`
}).join('\n')}
${[[208,102,232,102],[408,102,432,102],[608,102,632,102],[208,237,232,237],[408,237,432,237]].map(([x,y,a,b])=>`<path d="M${x} ${y}L${a} ${b}" stroke="#24211E" marker-end="url(#arrow)"/>`).join('')}
<path d="M720 134V166H120V205" fill="none" stroke="#24211E" marker-end="url(#arrow)"/>
<text x="32" y="314" font-size="14">Policy alone buys over x402 · XRPL Testnet · no real value</text>
<text x="32" y="342" font-size="14">Writer returns signed promises → verified grant → delivered citation</text>
<text x="32" y="370" font-size="12" fill="#655D55">Architecture contract: browser → API policy → writer / facilitator → ledger</text></g></svg>\n`
const file = 'docs/media/architecture.svg'
if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8') !== svg) throw new Error('Architecture SVG is stale')
} else writeFileSync(file, svg)
