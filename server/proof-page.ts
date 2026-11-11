// The public proof-of-refusal page and its downloadable card. Server-rendered and dependency-free so a link preview,
// a screen reader and a phone all get the whole proof without running our app. The one script (page mode) loads the
// same lazy verifier chunk the app uses and re-checks the receipts in the visitor's browser; nothing else is dynamic.
import { clip, explorerTx, sgd, type ProofSnapshot } from '../shared/refusal-proof.js'

const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Singapore time ("11 Nov 2026, 14:35 SGT"): this is a Singapore event's page, and the machine-readable <time datetime> stays in UTC. */
const sgt = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 8 * 3_600_000), pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} SGT`
}
const short = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-8)}`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const MARK = '<svg class="mark" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 4H4v16h5M15 4h5v16h-5M9 15l6-6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>'
/** Held coin: a ring with a bar through it, on the 24-unit grid with the 1.5 stroke. */
const HELD = '<svg class="held" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7.5 12h9" stroke="#D9A28F" stroke-width="2.5" stroke-linecap="square"/></svg>'

export const LEDGER_HOSTS = ['wss://s.altnet.rippletest.net:51233', 'wss://clio.altnet.rippletest.net:51233']
export const VERIFY_MODULE = '/verify/proof-verify.js'
/** The environment chip on a phone: every proof is an XRPL Testnet record with test funds, whichever surface shared it. */
const ENV_SHORT = 'Testnet demo · no real value'
/**
 * The environment chip in full (H9-14). A refusal writes no answer from paid text, so the label names only what judged the
 * purchase, in the app's own words ("rule-based buying"), never "fixture models" beside an app chip that says "live answers".
 * Rendered from the snapshot's fields, so a proof shared before this wording reads the same way.
 */
export const proofEnvironmentLabel = (env: Pick<ProofSnapshot['environment'], 'surface' | 'models'>) =>
  `${env.surface === 'hosted' ? 'Shared ' : ''}XRPL Testnet demo · ${env.models === 'fixture' ? 'rule-based buying' : 'model-judged buying'} · no real value`

const CSS = `
:root{--paper:#FBF8F2;--surface:#fff;--ink:#24211E;--muted:#655D55;--rule:#E8E2D8;--rule-2:#C9BFB2;--hover:#F3EEE4;--ok:#2F6B4F;--bad:#9B3E35}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:400 15px/1.5 "Geist Variable",Geist,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--ink);text-underline-offset:3px}:focus-visible{outline:2.5px solid var(--ink);outline-offset:2px;border-radius:6px}
.top{display:flex;align-items:center;gap:12px;min-height:48px;padding:6px 16px;background:var(--surface);border-bottom:1px solid var(--rule)}
.brand{display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;letter-spacing:-.015em;text-decoration:none}
.chip{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid var(--rule);border-radius:6px;background:var(--surface);font-size:12px;font-weight:500;line-height:1.2}
.chip i{flex:none;width:6px;height:6px;border-radius:6px;background:var(--ok)}.chip{min-width:0}.chip .short{display:none}
main{max-width:760px;margin:0 auto;padding:40px 16px 48px}
.eyebrow{display:flex;align-items:center;gap:8px;margin:0 0 10px;color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.held{flex:none;color:var(--ink)}
h1{margin:0;font-size:36px;line-height:42px;font-weight:600;letter-spacing:-.025em}
.lede{margin:12px 0 0;max-width:60ch;color:var(--muted);font-size:16px;line-height:24px}
.ask{margin:28px 0 0;padding:18px 20px;border:1px solid var(--rule);border-radius:10px;background:var(--surface)}
.label{margin:0;color:var(--muted);font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
blockquote{margin:6px 0 8px;font-size:20px;line-height:28px;font-weight:500;letter-spacing:-.01em;overflow-wrap:anywhere}
.meta{margin:0;color:var(--muted);font-size:13px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:16px 0 0;padding:0;border:1px solid var(--rule);border-radius:10px;background:var(--surface);overflow:hidden}
.stats div{padding:14px 16px;border-left:1px solid var(--rule)}.stats div:first-child{border-left:0}
.stats dt{margin:0;color:var(--muted);font-size:12px}.stats dd{margin:2px 0 0;font-size:24px;line-height:30px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.stats .zero dd{color:var(--ok)}
h2{margin:36px 0 10px;font-size:16px;line-height:22px;font-weight:600;letter-spacing:-.01em}
p{margin:0 0 10px}
.items{margin:12px 0 0;padding:0;list-style:none;border:1px solid var(--rule);border-radius:10px;background:var(--surface)}
.items li{display:flex;justify-content:space-between;gap:16px;padding:10px 16px;border-top:1px solid var(--rule)}.items li:first-child{border-top:0}
.items b{display:block;font-weight:500;overflow-wrap:anywhere}.items small{color:var(--muted);font-size:13px}
.items .why{flex:none;max-width:42%;color:var(--muted);font-size:13px;text-align:right}
.more{margin:8px 2px 0;color:var(--muted);font-size:13px}
.rest{margin-top:10px}.rest summary{cursor:pointer;color:var(--muted);font-size:13px;padding:2px 2px 8px}.rest .items{margin-top:0}
.facts{margin:0;border:1px solid var(--rule);border-radius:10px;background:var(--surface)}
.facts div{display:grid;grid-template-columns:150px 1fr;gap:12px;padding:10px 16px;border-top:1px solid var(--rule)}.facts div:first-child{border-top:0}
.facts dt{color:var(--muted);font-size:13px}.facts dd{margin:0;overflow-wrap:anywhere}.mono{font:500 13px/1.45 "Geist Mono Variable","Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
.ok{color:var(--ok);font-weight:600}
.verify{margin:14px 0 0;padding:16px 20px;border:1px solid var(--rule);border-radius:10px;background:var(--surface)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:0 14px;border-radius:6px;border:1px solid var(--ink);background:var(--ink);color:#fff;font:600 13px/1 inherit;cursor:pointer;text-decoration:none}
.btn:disabled{opacity:.5;cursor:default}.btn.alt{background:var(--surface);color:var(--ink);border-color:var(--rule-2)}
.row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}
.vhead{margin:14px 0 8px;font-weight:600}.vhead.ok{color:var(--ok)}.vhead.bad{color:var(--bad)}
.vgroups{margin:0;padding:0;list-style:none}.vgroups>li{border-top:1px solid var(--rule)}
.vgroups summary{display:flex;gap:10px;align-items:baseline;padding:8px 0;cursor:pointer}.vgroups summary i{flex:none;width:14px;font-style:normal;font-weight:700}.vgroups summary small{margin-left:auto;color:var(--muted)}
.vgroups li.pass i{color:var(--ok)}.vgroups li.fail i{color:var(--bad)}.vgroups ul{margin:0 0 8px 24px;padding:0;list-style:none;color:var(--muted);font-size:13px}.vgroups ul li{display:flex;gap:8px;padding:2px 0}
.note{color:var(--muted);font-size:13px}
.two{display:grid;grid-template-columns:1fr 1fr;gap:16px}.two section{padding:16px 20px;border:1px solid var(--rule);border-radius:10px;background:var(--surface)}.two h3{margin:0 0 6px;font-size:14px}.two ul{margin:0;padding-left:18px;color:var(--muted);font-size:14px}.two li{margin:4px 0}
footer{max-width:760px;margin:0 auto;padding:0 16px 40px;color:var(--muted);font-size:13px}
@media (max-width:620px){h1{font-size:30px;line-height:36px}.stats{grid-template-columns:1fr 1fr}.stats div:nth-child(3){border-left:0}.stats div:nth-child(n+3){border-top:1px solid var(--rule)}.facts div{grid-template-columns:1fr;gap:2px}.two{grid-template-columns:1fr}.items li{flex-direction:column;gap:2px}.items .why{max-width:none;text-align:left}.chip .full{display:none}.chip .short{display:inline}main{padding-top:28px}}
@media print{.verify .btn,.row{display:none}}
`

/** What the in-browser check does when the visitor presses the button. Vanilla DOM, textContent only. */
const verifyScript = (id: string) => `
const btn = document.getElementById('verify'), out = document.getElementById('vout')
const mark = { PASS: '✓', FAIL: '✕', SKIP: '–' }
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e }
const draw = result => {
  const passed = result.checks.filter(c => c.status === 'PASS').length, failed = result.checks.filter(c => c.status === 'FAIL').length
  const total = result.checks.length, skipped = result.checks.filter(c => c.status === 'SKIP').map(c => c.check)
  const groups = el('ul', 'vgroups')
  for (const g of result.groups) {
    const li = el('li', g.status.toLowerCase()), d = el('details'), s = el('summary'), ul = el('ul')
    if (g.status === 'FAIL') d.open = true
    s.append(el('i', '', mark[g.status]), el('span', '', g.title), el('small', '', g.status === 'SKIP' ? 'not checked' : g.passed + '/' + g.total))
    for (const c of g.checks) { const row = el('li'); row.append(el('span', '', mark[c.status]), el('span', '', c.check + ' — ' + c.detail)); ul.append(row) }
    d.append(s, ul); li.append(d); groups.append(li)
  }
  const headline = !result.ok ? failed + ' of ' + total + ' checks failed' : passed === total ? 'All ' + total + ' checks passed' : passed + ' passed · ' + skipped.length + ' not checked'
  const skippedNote = skipped.length ? ' Skipped here: ' + skipped.join(' and ') + '. ' + (skipped.length === 1 ? 'It' : 'They') + ' can’t be checked from the receipts alone.' : ''
  out.replaceChildren(el('p', 'vhead ' + (result.ok ? 'ok' : 'bad'), headline), groups,
    el('p', 'note', 'Ran in this browser' + (result.endpoint ? ', reading ' + result.endpoint + ' (read-only)' : '') + '.' + skippedNote + ' Same checks as the open-source verifier; the result doesn’t rely on our server.'))
}
btn.addEventListener('click', async () => {
  btn.disabled = true; out.textContent = 'Downloading the receipts…'
  try {
    const response = await fetch('/proof/${id}/receipts.json')
    if (!response.ok) throw new Error('receipts')
    const bundle = await response.json()
    out.textContent = 'Checking signatures and reading XRPL Testnet…'
    const { verifyInBrowser } = await import('${VERIFY_MODULE}')
    draw(await verifyInBrowser(bundle))
  } catch (error) { console.error('proof check failed', error); out.textContent = 'The checks could not finish in this browser. Nothing was changed.' }
  btn.disabled = false; btn.textContent = 'Run the checks again'
})
`

export type ProofPageOptions = { mode: 'page' | 'card'; origin?: string; nonce?: string }
export function renderProofPage(snapshot: ProofSnapshot, { mode, origin = '', nonce = '' }: ProofPageOptions): string {
  const { id, question, environment: env, found, anchor, verification } = snapshot
  const envLabel = proofEnvironmentLabel(env)
  const link = origin ? `${origin}/proof/${id}` : `/proof/${id}`
  const image = `${origin}/og/refusal-proof.png`
  const detail = found.paid ? `${plural(found.paid, 'paid article')} found, none bought. ${sgd(0)} spent.` : `No paid article matched. ${sgd(0)} spent.`
  const description = `“${clip(question, 150)}” ${detail}`
  const title = 'Refused to spend · verified on XRPL'
  const asked = new Date(snapshot.askedAt).toISOString()
  const bundleJson = JSON.stringify(snapshot.bundle)
  const row = (item: ProofSnapshot['found']['items'][number]) => `<li><div><b>${esc(item.title)}</b><small>${esc(item.writer)} · ${sgd(item.priceMinor)}</small></div><span class="why">${esc(item.verdict)}</span></li>`
  const shown = 6, items = found.items.slice(0, shown).map(row).join(''), rest = found.items.slice(shown).map(row).join('')
  const meta = mode === 'page' ? `
<meta name="robots" content="noindex">
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(link)}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="website"><meta property="og:site_name" content="ResearchAgent">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(link)}"><meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Refused to spend · verified on XRPL. S$0.00 spent.">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}">` : ''
  const verify = mode === 'page'
    ? `<div class="verify"><p class="label">Check it yourself</p>
<p>Re-run the receipt checks in your browser: the audit log’s hash chain, then the anchor transaction on a public XRPL Testnet node. The result doesn’t rely on our server.</p>
<div class="row"><button class="btn" type="button" id="verify">Verify on XRPL in your browser</button><a class="btn alt" href="/proof/${id}/receipts.json" download="refusal-proof-${id.slice(0, 8)}.receipts.json">Download receipts.json</a><a class="btn alt" href="/proof/${id}/card.html">Download proof card</a></div>
<div id="vout" role="status" aria-live="polite"></div></div>`
    : `<div class="verify"><p class="label">Check it yourself</p>
<p>This card carries the receipts. Save them and run the open-source verifier: <span class="mono">npm run verify:answer -- receipts.json --ledger --testnet</span>. Or open the anchor transaction above on the explorer.</p>
<div class="row"><a class="btn" download="refusal-proof-${id.slice(0, 8)}.receipts.json" href="data:application/json;base64,${Buffer.from(bundleJson).toString('base64')}">Save receipts.json</a>${origin ? `<a class="btn alt" href="${esc(link)}">Open the live page</a>` : ''}</div></div>`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ResearchAgent</title>${meta}
<style${nonce ? ` nonce="${nonce}"` : ''}>${CSS}</style></head>
<body>
<header class="top"><a class="brand" href="/">${MARK}<span>ResearchAgent</span></a><span class="chip"><i></i><span class="full">${esc(envLabel)}</span><span class="short">${ENV_SHORT}</span></span></header>
<main>
<p class="eyebrow">${HELD}<span>Proof of refusal</span></p>
<h1>Refused to spend.</h1>
<p class="lede">An AI agent was given a budget and a question. It read the paid options, judged none worth buying, and spent nothing. The record below is on XRPL Testnet.</p>
<figure class="ask"><p class="label">The question</p><blockquote>${esc(question)}</blockquote><p class="meta">Asked <time datetime="${esc(asked)}">${sgt(asked)}</time> · shared <time datetime="${esc(snapshot.createdAt)}">${sgt(snapshot.createdAt)}</time></p></figure>
<dl class="stats"><div><dt>Paid articles found</dt><dd>${found.paid}</dd></div><div><dt>Writers</dt><dd>${found.writers}</dd></div><div><dt>Articles bought</dt><dd>0</dd></div><div class="zero"><dt>Money spent</dt><dd>${sgd(0)}</dd></div></dl>
<h2>Why nothing was bought</h2>
<p>${esc(snapshot.outcome.summary)}</p>
${items ? `<ul class="items" aria-label="Paid articles considered">${items}</ul>` : ''}${rest ? `<details class="rest"><summary>Show the other ${found.items.length - shown}${found.more ? ` of ${found.items.length - shown + found.more}` : ''}</summary><ul class="items" aria-label="More paid articles considered">${rest}</ul></details>` : ''}${found.more ? `<p class="more">and ${found.more} more not listed</p>` : ''}
<h2>The ledger record</h2>
<dl class="facts">
<div><dt>Anchored on</dt><dd><a href="${esc(explorerTx(anchor.txHash))}" target="_blank" rel="noopener noreferrer">XRPL Testnet transaction ${esc(short(anchor.txHash))}</a> <span class="note">· ledger ${anchor.ledgerIndex}</span></dd></div>
<div><dt>Anchor account</dt><dd class="mono">${esc(anchor.account)}</dd></div>
<div><dt>Audit log head</dt><dd class="mono">${esc(anchor.head)}</dd></div>
<div><dt>Checks</dt><dd>${verification.skipped ? `<span class="ok">${verification.passed} passed</span> <span class="note">· ${verification.skipped} not checked yet: they need the ledger or a writer lookup${mode === 'page' ? '. The browser check below runs the ledger ones' : ''}</span>` : `<span class="ok">All ${verification.total} checks passed</span> <span class="note">when shared</span>`}</dd></div>
<div><dt>Where</dt><dd>${esc(envLabel)}</dd></div>
</dl>
${verify}
<h2>What this does and doesn’t show</h2>
<div class="two"><section><h3>Shows</h3><ul><li>The agent’s signed audit log has no payment for this question.</li><li>That log’s fingerprint was written to XRPL Testnet, so it can’t be changed afterwards.</li><li>Anyone can recompute the checks from the receipts.</li></ul></section>
<section><h3>Doesn’t show</h3><ul><li>That declining was the right call.</li><li>Anything about paid article text: none was delivered, and none is included.</li><li>Real money: this is a Testnet demo with test funds.</li></ul></section></div>
</main>
<footer>Proof <span class="mono">${esc(short(id))}</span>. Shared on purpose by the person who asked. The page is a frozen snapshot and can’t be edited.</footer>
${mode === 'page' ? `<script type="module"${nonce ? ` nonce="${nonce}"` : ''}>${verifyScript(id)}</script>` : ''}
</body></html>
`
}

/** The page's Content-Security-Policy: this document, the verifier chunk from the same origin and the two public Testnet nodes. */
export const proofCsp = (nonce: string) => [
  "default-src 'none'", `script-src 'self' 'nonce-${nonce}'`, `style-src 'nonce-${nonce}'`, "img-src 'self' data:", "font-src 'self'",
  `connect-src 'self' ${LEDGER_HOSTS.join(' ')}`, "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ')

export function renderProofMissing(nonce = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Proof not found · ResearchAgent</title><style${nonce ? ` nonce="${nonce}"` : ''}>${CSS}</style></head><body><header class="top"><a class="brand" href="/">${MARK}<span>ResearchAgent</span></a></header><main><p class="eyebrow">${HELD}<span>Proof of refusal</span></p><h1>This proof isn’t here.</h1><p class="lede">The link may be mistyped, or the page has passed its retention date. A shared proof never changes, so a link that worked once will not now show something else.</p></main></body></html>`
}
