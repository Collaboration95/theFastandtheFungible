// Generated figures: the architecture overview (docs/contracts/ARCHITECTURE.md; numbers match its steps) and the README key-reveal sequence. --check fails if either SVG is stale.
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

// README "How it works": the key-reveal sequence, three lifelines and five numbered steps.
const INK = '#24211E', MUTED = '#655D55', RULE = '#C9BFB2', PAPER = '#FBF8F2'
const lanes = [['Policy code (buyer)', 150], ['XRP Ledger', 440], ['Writer', 730]]
const X = Object.fromEntries(lanes.map(([name, x]) => [name.split(' ')[0], x]))
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const steps = [
  { from: 'Policy', to: 'XRP', text: 'EscrowCreate · locked to sha256(key)' },
  { from: 'Writer', to: 'XRP', text: 'EscrowFinish publishes key · writer paid' },
  { note: 'Policy', text: 'Decrypt · check every signed promise' },
  { from: 'Writer', to: 'Policy', text: 'Refund if a promise broke · writer-signed', dashed: true },
  { from: 'Policy', to: 'XRP', text: 'Anchor the answer · memo = audit head' },
]
const top = 84, gap = 52, bottom = top + gap * steps.length + 8
const label = (x, y, text, size = 13) => { const w = text.length * size * 0.56 + 12; return `<rect x="${(x - w / 2).toFixed(1)}" y="${y - size - 2}" width="${w.toFixed(1)}" height="${size + 8}" fill="${PAPER}"/><text x="${x}" y="${y}" font-size="${size}" text-anchor="middle">${esc(text)}</text>` }
const seq = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="${bottom + 40}" viewBox="0 0 840 ${bottom + 40}" role="img" aria-label="Key-reveal escrow in five steps: policy code locks payment to the hash of the article key; the writer publishes the key on the ledger and is paid; the buyer decrypts and checks every promise; a broken promise is refunded by the writer; the answer is anchored on the ledger">
<rect width="840" height="${bottom + 40}" fill="${PAPER}"/>
<defs><marker id="head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="${INK}"/></marker></defs>
<g font-family="system-ui,sans-serif" fill="${INK}">
${lanes.map(([name, x]) => `<rect x="${x - 95}" y="20" width="190" height="40" rx="4" fill="#fff" stroke="${RULE}"/><text x="${x}" y="45" font-size="15" text-anchor="middle">${name}</text><path d="M${x} 60V${bottom}" stroke="${RULE}" stroke-dasharray="3 4"/>`).join('\n')}
${steps.map((s, i) => {
  const y = top + gap * i + 24
  const n = `<circle cx="40" cy="${y}" r="11" fill="${INK}"/><text x="40" y="${y + 4}" font-size="12" fill="#fff" text-anchor="middle">${i + 1}</text>`
  // The note sits on the buyer's lifeline, nudged right to clear the step number.
  if (s.note) { const x = X[s.note] + 55; return `${n}<rect x="${x - 140}" y="${y - 16}" width="280" height="32" rx="4" fill="#fff" stroke="${INK}"/><text x="${x}" y="${y + 5}" font-size="13" text-anchor="middle">${esc(s.text)}</text>` }
  const a = X[s.from], b = X[s.to], dir = Math.sign(b - a)
  return `${n}<path d="M${a} ${y}L${b - dir * 2} ${y}" stroke="${INK}"${s.dashed ? ' stroke-dasharray="5 4"' : ''} marker-end="url(#head)"/>${label((a + b) / 2, y - 9, s.text)}`
}).join('\n')}
<text x="32" y="${bottom + 26}" font-size="12" fill="${MUTED}">XRPL Testnet · no real value · key reveal makes delivery atomic; a refund after the key is out needs the writer's signature</text></g></svg>\n`

const outputs = [['docs/media/architecture.svg', svg], ['docs/media/key-reveal.svg', seq]]
for (const [file, content] of outputs) {
  if (process.argv.includes('--check')) {
    if (readFileSync(file, 'utf8') !== content) throw new Error(`${file} is stale; run node scripts/readme-architecture.mjs`)
  } else writeFileSync(file, content)
}
