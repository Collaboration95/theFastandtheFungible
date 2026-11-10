// Renders site/progress/data.json into the static /progress/ page and the home card.
//   node scripts/render-progress.mjs          write site/progress/index.html + site/index.html card
//   node scripts/render-progress.mjs --check  exit 1 if either is out of date (offline; used by hygiene)
// Everything numeric comes from data.json (scripts/build-progress-data.mjs). No network.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Dates shown on the page are Singapore dates (UTC+8), like the counted days.
const sgtDate = iso => new Date(Date.parse(iso) + 8 * 3600e3).toISOString().slice(0, 10)

const root = join(import.meta.dirname, '..')
const REPO = 'https://github.com/Collaboration95/theFastandtheFungible'
const esc = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const n = v => Number(v).toLocaleString('en-US')
const short = sha => sha.slice(0, 7)
const ext = (url, label, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(url)}">${esc(label)}<span class="ext" aria-hidden="true">↗</span></a>`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const day = d => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`
const longDay = d => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const pct = (v, max) => `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(2)}%`
const slug = id => `stop-${id.replaceAll('.', '-')}`
// Inline code in generated bullets: `x` → <code>x</code>, everything else escaped.
const prose = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>')
const blob = (d, path) => `${REPO}/blob/${d.source_sha}/${path}`
const section = (id, index, kicker, title, lede, body) => `<section class="sec" id="${id}" aria-labelledby="${id}-h">
<div class="sec-head"><p class="kick"><span class="idx">${index}</span>${esc(kicker)}</p><h2 id="${id}-h">${title}</h2>${lede ? `<p class="lede">${lede}</p>` : ''}</div>
${body}
</section>`
// Every chart has a table view for screen readers and anyone who wants the numbers.
const table = (caption, head, rows) => `<details class="tbl"><summary>Show the numbers</summary><table><caption class="sr">${esc(caption)}</caption><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`).join('')}</tr>`).join('')}</tbody></table></details>`

function hero(d) {
  const h = d.headline, s = d.event.snapshot, t = d.today
  const stat = (value, to, label, note, opts = {}) => `<div class="stat"><dt>${label}</dt><dd><span class="num" data-count="${to}"${opts.decimals ? ` data-decimals="${opts.decimals}"` : ''}${opts.suffix ? ` data-suffix="${esc(opts.suffix)}"` : ''}${opts.prefix ? ` data-prefix="${esc(opts.prefix)}"` : ''}>${value}</span><span class="note">${note}</span></dd></div>`
  const first = d.rail.find(r => r.id === 'singhacks'), latest = d.rail.find(r => r.tag === t.release)
  const shot = (img, cls) => `<img class="${cls}" src="${esc(img.src)}" alt="${esc(img.alt)}" width="${img.width}" height="${img.height}" decoding="async">`
  const after = d.rail.find(r => r.tag === 'v1.0.0-rc.1')?.image ?? latest.image
  return `<header class="hero">
<p class="kick"><span class="pill">Since SingHacks</span><span>${esc(d.since.label)} → ${esc(day(d.as_of))} ${d.as_of.slice(0, 4)}</span></p>
<h1>From prototype to proof in ${h.days} days.</h1>
<p class="lede">At SingHacks, ResearchAgent was one web page where a language model proposed each purchase and a person approved every quote. Since then it has become released software: a web app, a Mac app, an MCP server and two SDKs. Policy code buys evidence from writers within your budget, and every payment leaves a receipt on the XRPL Testnet.</p>
<p class="facts">Facts at ${ext(`${REPO}/commit/${d.source_sha}`, short(d.source_sha), 'mono')} · generated ${esc(longDay(sgtDate(d.generated_at)))} · <a href="#method">how we count</a> · <a href="data.json" download>data.json</a></p>
<div class="compare">
  <figure class="side then">
    <figcaption><span class="when">SingHacks · ${esc(d.event.label.replace(' 2026', ''))}</span><span class="what">The prototype</span></figcaption>
    <div class="frame">${shot(first.image, 'shot')}</div>
    <ul class="traits">
      <li>One web page, synthetic sources</li>
      <li>A language model proposed; a person approved every quote</li>
      <li><span class="mono">${n(s.codeLines)}</span> lines of code · <span class="mono">${n(s.tests)}</span> tests on 20 Sep</li>
    </ul>
  </figure>
  <div class="arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></div>
  <figure class="side now">
    <figcaption><span class="when">Today · ${esc(t.release)} · ${esc(day(t.releaseDay))}</span><span class="what">Released software</span></figcaption>
    <div class="frame">${shot(after, 'shot')}</div>
    <ul class="traits">
      <li>Web app, Mac app, MCP server, TypeScript and Python SDKs</li>
      <li>Policy code pays; the writer is paid by publishing the key</li>
      <li><span class="mono">${n(t.codeLines)}</span> lines of code · <span class="mono">${n(t.tests)}</span> tests</li>
    </ul>
  </figure>
</div>
<dl class="stats">
${stat(n(h.prs), h.prs, 'Pull requests merged', `since ${esc(d.since.label.replace(' 2026', ''))}`)}
${stat(n(h.releases), h.releases, 'Releases', `${esc(d.rail.find(r => r.kind === 'release').tag)} to ${esc(t.release)}`)}
${stat(n(h.transactions), h.transactions, 'Testnet transactions', '<a href="../ledger/">re-checked live in your browser</a>')}
${stat(`${h.heldout.n}/${h.heldout.N}`, h.heldout.n, 'Blind questions bought and cited', `${h.heldout.offTopic.n}/${h.heldout.offTopic.N} off-topic purchases`, { suffix: `/${h.heldout.N}` })}
${stat(`${h.try.seconds.toFixed(1)} s`, h.try.seconds.toFixed(1), 'One command to a verified purchase', `cold run, ${h.try.limit} s target`, { decimals: 1, suffix: ' s' })}
${stat(n(h.tests), h.tests, 'Tests in the repo', `${n(s.tests)} on 20 Sep`)}
</dl>
</header>`
}

function activity(d) {
  const days = d.activity, max = Math.max(...days.map(x => x.prs))
  const at = dayStr => days.findIndex(x => x.day === dayStr)
  const markers = d.rail.filter(r => r.kind === 'milestone' || ['v0.1.0', 'v1.0.0'].includes(r.tag))
  const mark = (r, i) => {
    const idx = at(r.day)
    if (idx < 0) return ''
    const name = r.kind === 'milestone' ? { singhacks: 'SingHacks', 'first-testnet': 'Testnet payment', policy: 'Policy buys', ait: 'AI Tinkerers' }[r.id] : r.tag === 'v0.1.0' ? 'v0.1.0–v0.8.0' : r.tag
    return `<a class="mk mk-${'abc'[i % 3]}" aria-label="${esc(`${i + 1}. ${r.title}, ${r.label}`)}" href="#${slug(r.id)}" style="left:${pct(idx + 0.5, days.length)}" data-open="${slug(r.id)}"><span class="mk-n" aria-hidden="true">${i + 1}</span><span class="mk-l">${esc(name)}</span></a>`
  }
  const ticks = days.map((x, i) => ({ x, i })).filter(({ x }) => ['2026-09-19', '2026-10-01', '2026-10-15', '2026-11-01'].includes(x.day) || x.day === d.as_of)
  const bars = days.map(x => `<span class="bar${x.prs ? '' : ' zero'}" style="--h:${x.prs ? Math.max(4, (x.prs / max) * 100).toFixed(1) : 0}%" data-tip="${esc(`${day(x.day)} · ${x.prs} PR${x.prs === 1 ? '' : 's'} merged · ${x.commits} commit${x.commits === 1 ? '' : 's'}`)}"></span>`).join('')
  const busiest = days.reduce((a, b) => b.prs > a.prs ? b : a)
  const phase = (from, to, label, shortLabel) => { const a = at(from), b = to ? at(to) : days.length - 1; return `<span class="phase" style="left:${pct(a, days.length)};width:${pct(b - a + 1, days.length)}"><span class="lg">${esc(label)}</span><span class="sh" aria-hidden="true">${esc(shortLabel)}</span></span>` }
  return section('ribbon', '01', 'Every day since SingHacks', 'One merge at a time.', `${n(d.headline.prs)} pull requests and ${n(d.headline.commits)} commits since ${esc(d.since.label)}. The busiest day was ${esc(day(busiest.day))}, with ${busiest.prs} merges. Numbered marks open the stop on the rail below.`,
    `<div class="card ribbon-card">
<div class="ribbon">
  <div class="marks">${markers.map(mark).join('')}</div>
  <div class="bars" role="img" aria-label="${esc(`Pull requests merged per day from ${day(days[0].day)} to ${day(d.as_of)}; at most ${max} in one day.`)}" style="--n:${days.length}">${bars}<img class="agent" src="../brand/agent-still.png" alt="" width="40" height="27"></div>
  <div class="axis">${ticks.map(({ x, i }) => `<span style="left:${pct(i + 0.5, days.length)}">${x.day === d.as_of ? 'Today' : esc(day(x.day))}</span>`).join('')}</div>
  <div class="phases">${phase('2026-09-19', '2026-09-30', 'After SingHacks', 'Sep')}${phase('2026-10-01', '2026-10-31', 'October · AI Tinkerers', 'October')}${phase('2026-11-01', null, 'November · finals', 'Nov')}</div>
</div>
<ol class="mk-key">${markers.map((r, i) => `<li><a href="#${slug(r.id)}" data-open="${slug(r.id)}"><span class="mk-n">${i + 1}</span>${esc(r.title)}</a></li>`).join('')}</ol>
<p class="foot">Pull requests merged into main per day, Singapore time. Hover or tap a day for commits. The October build has its own archive: ${'<a href="../evolution/">October build log</a>'}.</p>
${table('Pull requests and commits per day', ['Day', 'PRs merged', 'Commits'], days.filter(x => x.prs || x.commits).map(x => [esc(day(x.day)), x.prs, x.commits]))}
</div>`)
}

function rail(d) {
  const groups = [['2026-09', 'September · SingHacks'], ['2026-10', 'October · AI Tinkerers build'], ['2026-11', 'November · the finals push']]
  const figure = r => r.image
    ? `<figure class="stop-fig"><div class="frame"><img src="${esc(r.image.src)}" alt="${esc(r.image.alt)}" width="${r.image.width}" height="${r.image.height}" loading="lazy" decoding="async"></div><figcaption>${esc(r.image.caption)}</figcaption></figure>`
    : r.snippet ? `<figure class="stop-fig term"><pre tabindex="0" aria-label="${esc(r.snippet.caption)}"><code>${r.snippet.lines.map(esc).join('\n')}</code></pre><figcaption>${esc(r.snippet.caption)}</figcaption></figure>` : ''
  const stop = r => `<li class="stop${r.kind === 'milestone' ? ' milestone' : ''}" id="${slug(r.id)}">
<details${r.tag === d.today.release ? ' open' : ''}>
<summary><span class="dot" aria-hidden="true"></span><span class="when">${esc(r.label)}</span><span class="tagchip${r.prerelease ? ' pre' : ''}">${r.kind === 'release' ? esc(r.tag) : 'Milestone'}</span><span class="title">${esc(r.title)}</span><span class="chev" aria-hidden="true"></span></summary>
<div class="stop-body">
  <div class="stop-text">${r.summary ? `<p>${esc(r.summary)}</p>` : ''}<p class="sub">What shipped</p><ul>${r.bullets.map(b => `<li>${prose(b)}</li>`).join('')}</ul>
  <p class="proofs">${r.proofs.map(p => ext(p.url, p.label, 'chip')).join('')}</p></div>
  ${figure(r)}
</div>
</details>
</li>`
  const body = groups.map(([month, label]) => {
    const stops = d.rail.filter(r => r.day.startsWith(month))
    return stops.length ? `<li class="group"><h3>${esc(label)}</h3><ol class="stops">${stops.map(stop).join('')}</ol></li>` : ''
  }).join('')
  const counts = `${d.rail.filter(r => r.kind === 'milestone').length} milestones and ${d.rail.filter(r => r.kind === 'release').length} releases`
  return section('rail', '02', 'The release rail', 'Every stop has a receipt.', `${counts}. Open a stop for what shipped, a screenshot or terminal output, and the proof: the pull request, the release notes or a Testnet transaction.`,
    `<div class="rail-tools"><button type="button" class="btn" data-expand="rail" aria-pressed="false">Open all</button></div>
<ol class="rail">${body}</ol>`)
}

function ladder(d) {
  return section('ladder', '03', 'Then and now', 'What changed, capability by capability.', 'Each row starts at the SingHacks prototype and ends at what ships today, with the pull request that first delivered it.',
    `<div class="card ladder"><table class="ladder-t"><caption class="sr">Capabilities at SingHacks and now</caption><thead><tr><th scope="col">Capability</th><th scope="col">At SingHacks</th><th scope="col">Now</th><th scope="col">First shipped</th></tr></thead><tbody>
${d.capabilities.map((c, i) => `<tr><th scope="row"><span class="rung">${String(i + 1).padStart(2, '0')}</span>${esc(c.name)}</th><td class="then">${esc(c.then)}</td><td class="now"><span class="to" aria-hidden="true">→</span>${esc(c.now)}</td><td class="since"><span>${esc(c.label)}</span>${c.tag && c.tag.startsWith('v') ? `<span class="in">released in ${esc(c.tag)}</span>` : ''}<span class="refs">${c.proofs.map(p => ext(p.url, p.label)).join(' ')}</span></td></tr>`).join('\n')}
</tbody></table></div>`)
}

function charts(d) {
  const m = d.metrics
  const src = (path, label = path) => `<p class="src">Source: ${ext(blob(d, path), label)}</p>`
  // A. First run: before → after, each row on its own scale (units differ).
  const dumb = m.firstRun.map(r => `<div class="dumb"><p class="dl">${esc(r.label)}</p><div class="track" role="img" aria-label="${esc(`${r.label}: ${r.before.toFixed(1)} ${r.unit} before, ${r.after.toFixed(1)} ${r.unit} now`)}"><span class="seg" style="left:${pct(r.after, r.before)};width:${pct(r.before - r.after, r.before)}"></span><span class="pt was" style="left:100%" data-tip="${esc(`Before: ${r.before.toFixed(1)} ${r.unit}`)}"></span><span class="pt is" style="left:${pct(r.after, r.before)}" data-tip="${esc(`Now: ${r.after.toFixed(1)} ${r.unit}`)}"></span></div><p class="dv"><span class="mono">${r.before.toFixed(1)}</span> → <strong class="mono">${r.after.toFixed(1)} ${esc(r.unit)}</strong> <span class="delta">−${Math.round((1 - r.after / r.before) * 100)}%</span></p></div>`).join('')
  const A = `<article class="card chart"><h3>The first run got faster</h3><p class="take">Measured with an empty npm cache. Each row is on its own scale.</p>${dumb}
<p class="legend"><span class="key was"></span>release candidate 2 <span class="key is"></span>today</p>${src('docs/evidence/round4-j2/README.md', 'round4-j2')}
${table('First-run timings', ['Measure', 'Before', 'Now'], m.firstRun.map(r => [esc(r.label), `${r.before.toFixed(1)} ${r.unit}`, `${r.after.toFixed(2)} ${r.unit}`]))}</article>`
  // B. try --testnet cold runs against the unchanged limit.
  // Dots, not bars, so the axis may start above zero; the domain is printed.
  const lim = m.tryLimit, lo = 10 * Math.floor((Math.min(...m.tryRuns.map(r => r.seconds)) - 8) / 10), hi = lim + 5
  const x = v => pct(v - lo, hi - lo)
  const runLabel = r => r.note === 'deadline exceeded' ? `× stopped at ${lim} s` : `${r.pass ? '✓' : '×'} ${r.seconds.toFixed(1)} s`
  const B = `<article class="card chart"><h3>One command, every cold run</h3><p class="take">${m.tryRuns.filter(r => r.pass).length} of ${m.tryRuns.length} cold runs of <code>try --testnet</code> finished inside ${lim} s. The misses stay on the record.</p>
<div class="dots" role="img" aria-label="${esc(m.tryRuns.map((r, i) => `Run ${i + 1}: ${runLabel(r).slice(2)}`).join(', '))}"><span class="limit" style="left:${x(lim)}"><span>${lim} s limit</span></span>${m.tryRuns.map((r, i) => `<span class="run ${r.pass ? 'ok' : 'bad'}" style="left:${x(r.seconds)};top:${24 + i * 22}px" data-tip="${esc(`Run ${i + 1}: ${r.note === 'deadline exceeded' ? `stopped at the ${lim} s deadline (it had printed ${r.printed} s)` : `${r.seconds.toFixed(1)} s, ${r.note}`}`)}"><span class="lbl">${esc(runLabel(r))}</span></span>`).join('')}</div>
<div class="scale">${[lo, lo + (hi - lo) / 2, hi].map(v => `<span>${Math.round(v)} s</span>`).join('')}</div>
${src('docs/evidence/round4-j2/README.md', 'round4-j2')}
${table('Cold try --testnet runs', ['Run', 'Seconds', 'Result', 'Evidence'], m.tryRuns.map((r, i) => [`Run ${i + 1}`, r.seconds.toFixed(2), esc(r.note), ext(blob(d, `docs/evidence/round4-j2/${r.file}`), r.file)]))}</article>`
  // C. Judge banks out of 20; only the blind banks count as held-out.
  const banks = m.banks.map(b => b.status === 'pending' || b.status === 'absent'
    ? `<div class="hbar pending"><p class="hl">${esc(b.label)}</p><div class="htrack"><span class="ghost"></span></div><p class="hv">${b.status === 'pending' ? `frozen ${esc(day(b.frozen))} · not run yet` : 'not frozen'}</p></div>`
    : `<div class="hbar${b.heldout ? ' strong' : ''}"><p class="hl">${esc(b.label)}</p><div class="htrack"><span class="fill" style="width:${pct(b.n, b.N)}" data-tip="${esc(`${b.label}: ${b.n} of ${b.N} bought and cited`)}"></span></div><p class="hv mono">${b.n}/${b.N}</p></div>`).join('')
  const C = `<article class="card chart"><h3>Questions bought and cited</h3><p class="take">Development banks guided the work; the blind bank is the number we report. Off-topic purchases: <strong>${m.offTopic.n}/${m.offTopic.N}</strong>.</p>${banks}
<p class="legend"><span class="key soft"></span>development <span class="key ink"></span>blind held-out <span class="key dash"></span>not run yet</p>${src(d.headline.heldout.source ?? 'docs/evidence/v4-heldout/README.md', (d.headline.heldout.source ?? 'v4-heldout').split('/').slice(-2, -1)[0] ?? 'v4-heldout')}
${table('Judge banks', ['Bank', 'Bought and cited', 'Source'], m.banks.map(b => [esc(b.label), b.n !== undefined ? `${b.n}/${b.N}` : esc(b.status), ext(blob(d, b.source), b.source.split('/').slice(-2).join('/'))]))}</article>`
  // D. Ledger rows over time (step line with HTML dots and labels).
  const L = m.ledgerHistory, lmax = Math.max(...L.map(x => x.rows)) * 1.1
  const xs = L.map((_, i) => (i / (L.length - 1)) * 100), ys = L.map(x => 100 - (x.rows / lmax) * 100)
  const path = L.map((_, i) => `${i ? `H${xs[i]} V${ys[i]}` : `M${xs[i]} ${ys[i]}`}`).join(' ')
  const D = `<article class="card chart"><h3>Public ledger evidence</h3><p class="take">Curated Testnet transactions on the ledger page grew from ${L[0].rows} to ${L.at(-1).rows}, each tied to a committed source file.</p>
<div class="step" role="img" aria-label="${esc(L.map(x => `${x.label}: ${x.rows}`).join(', '))}"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${path} H100" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>${L.map((x, i) => `<span class="sp" style="left:${xs[i]}%;top:${ys[i]}%" data-tip="${esc(`${x.label}: ${x.rows} rows (commit ${x.commit})`)}"><span class="sv">${x.rows}</span></span>`).join('')}</div>
<div class="scale even">${L.map(x => `<span>${esc(x.label)}</span>`).join('')}</div>${src('site/ledger/transactions.json', 'site/ledger/transactions.json history')}
${table('Ledger rows over time', ['Day', 'Rows', 'Commit'], L.map(x => [esc(x.label), x.rows, ext(`${REPO}/commit/${x.commit}`, x.commit)]))}</article>`
  // E. Tests written in the repo at each checkpoint.
  const T = m.tests, tmax = Math.max(...T.map(x => x.total))
  const E = `<article class="card chart"><h3>Tests written in the repo</h3><p class="take">From ${n(T[1].total)} on 20 Sep to ${n(T.at(-1).total)} today, counted the same way at every checkpoint. ${n(m.executedTests.tests)} ran in the fast check on 7 Nov.</p>
<div class="cols" role="img" aria-label="${esc(T.map(x => `${x.label}: ${x.total}`).join(', '))}">${T.map(x => `<div class="col"><span class="cv mono">${n(x.total)}</span><span class="cb" style="height:${Math.max(1.5, (x.total / tmax) * 100).toFixed(1)}%" data-tip="${esc(`${x.label}: ${x.typescript} TypeScript + ${x.python} Python`)}"></span></div>`).join('')}</div>
<div class="scale even">${T.map(x => `<span>${esc(x.label.split(' · ')[0])}</span>`).join('')}</div><p class="src">Static count of test declarations at each tag (<a href="#method">definition</a>) · ${ext(blob(d, m.executedTests.source), 'executed count')}</p>
${table('Tests per checkpoint', ['Checkpoint', 'TypeScript', 'Python', 'Total'], T.map(x => [esc(x.label), x.typescript, x.python, x.total]))}</article>`
  // G. Lines of code at the same checkpoints.
  const C2 = m.code, cmax = Math.max(...C2.map(x => x.lines))
  const G = `<article class="card chart"><h3>Code in the repo</h3><p class="take">${n(C2[1].lines)} lines on 20 Sep, ${n(C2.at(-1).lines)} today. Tests and tooling included; evidence files and generated JSON are not.</p>
<div class="cols" role="img" aria-label="${esc(C2.map(x => `${x.label}: ${x.lines}`).join(', '))}">${C2.map(x => `<div class="col"><span class="cv mono">${x.lines >= 10000 ? `${(x.lines / 1000).toFixed(1)}k` : n(x.lines)}</span><span class="cb" style="height:${Math.max(1.5, (x.lines / cmax) * 100).toFixed(1)}%" data-tip="${esc(`${x.label}: ${n(x.lines)} lines`)}"></span></div>`).join('')}</div>
<div class="scale even">${C2.map(x => `<span>${esc(x.label.split(' · ')[0])}</span>`).join('')}</div><p class="src">Nonblank lines in tracked TypeScript, JavaScript, Python and shell files (<a href="#method">definition</a>)</p>
${table('Lines of code per checkpoint', ['Checkpoint', 'Lines'], C2.map(x => [esc(x.label), n(x.lines)]))}</article>`
  // F. Every ledger transaction, by day and kind. Each square links to the explorer.
  const kinds = ['Payment', 'Refund', 'Escrow locked', 'Key published', 'Escrow returned', 'Writer credential', 'Answer anchor', 'Account setup'].filter(k => m.transactions.some(t => t.kind === k))
  const txDays = [...new Set(m.transactions.map(t => t.day))].sort()
  const F = `<article class="card chart wide"><h3>Every Testnet transaction</h3><p class="take">${m.transactions.length} transactions across ${txDays.length} days. Each square opens the transaction on the public XRPL Testnet explorer.</p>
<div class="wall" style="--days:${txDays.length}"><div class="wall-h"><span></span>${txDays.map(t => `<span>${esc(day(t))}</span>`).join('')}</div>
${kinds.map(k => `<div class="wall-r"><span class="wk">${esc(k)}</span>${txDays.map(t => `<span class="cell">${m.transactions.filter(x => x.kind === k && x.day === t).map(x => `<a class="sq" href="https://testnet.xrpl.org/transactions/${x.hash}" aria-label="${esc(`${k}, ${day(t)}, ${x.hash.slice(0, 8)}`)}" data-tip="${esc(`${k} · ${day(t)} · ${x.hash.slice(0, 10)}…`)}"></a>`).join('')}</span>`).join('')}</div>`).join('')}
</div><p class="src">Source: <a href="../ledger/">the ledger page</a>, which re-checks every hash live · ${ext(blob(d, 'site/ledger/transactions.json'), 'transactions.json')}</p></article>`
  return section('numbers', '04', 'The numbers, honestly', 'Small charts, real denominators.', 'Every chart names its source file. Development and blind measurements are never mixed, and nothing was rerun until it passed.',
    `<div class="charts">${A}${B}${C}${D}${E}${G}${F}</div>`)
}

function misses(d) {
  const icon = { Missed: '×', Regressed: '↓', Superseded: '↺', Measured: '◐' }
  return section('misses', '05', 'Misses we kept', 'The failures stay on the page.', 'A progress page that only shows wins is marketing. These are measurements that missed a target, regressed, or replaced a better-looking number of our own. Each links to the evidence.',
    `<ol class="misses card">${d.misses.map(x => `<li><details><summary><span class="mchip ${x.kind.toLowerCase()}"><span aria-hidden="true">${icon[x.kind]}</span>${esc(x.kind)}</span><span class="mt">${esc(x.title)}</span><span class="mm">${esc(x.measure)}</span><span class="chev" aria-hidden="true"></span></summary><div class="mbody"><p><span class="sub">What we did</span> ${esc(x.did)}</p><p>${ext(x.source, 'Evidence')}</p></div></details></li>`).join('')}</ol>`)
}

function feedback(d) {
  const f = d.feedback
  const steps = [[f.submissions, `submissions to XRPL and x402 docs (${f.submittedOn})`], [f.findings, 'findings logged while building'], [f.ranked, 'ranked for Ripple, each with a repro'], [f.drafts, 'upstream issue drafts ready'], [f.filed, 'filed upstream so far']]
  return section('feedback', '06', 'Builder feedback', 'What building on XRPL taught us.', 'Every friction point with XRPL, x402 and the Testnet goes into a dated log with evidence, a workaround and the mainnet impact.',
    `<div class="card funnel"><ol>${steps.map(([v, l], i) => `<li${i === steps.length - 1 && !v ? ' class="zero"' : ''}><span class="fv" data-count="${v}">${v}</span><span class="fl">${esc(l)}</span></li>`).join('')}</ol>
<p class="foot">${ext(`${REPO}/blob/main/docs/BUILDER-FEEDBACK.md`, 'Read the ranked feedback')} · ${ext(`${REPO}/tree/main/docs/feedback/upstream`, 'Upstream drafts')}</p></div>`)
}

function next(d) {
  const col = status => `<div class="nx"><h3>${status === 'Next' ? 'Next' : 'Not claimed'}</h3><ul>${d.next.filter(x => x.status === status).map(x => `<li><strong>${esc(x.title)}</strong><span>${esc(x.body)}</span></li>`).join('')}</ul></div>`
  return section('next', '07', 'Next, and what we don\'t claim', 'Where the line is today.', null, `<div class="next card">${col('Next')}${col('Not claimed')}</div>`)
}

function method(d) {
  return `<section class="sec method" id="method" aria-labelledby="method-h"><div class="sec-head"><p class="kick"><span class="idx">—</span>Method</p><h2 id="method-h">How we count</h2>
<p class="lede">Counts are dated and query-defined: facts at ${ext(`${REPO}/commit/${d.source_sha}`, short(d.source_sha), 'mono')} (${esc(longDay(d.as_of))}). SingHacks ran ${esc(d.event.label)}; the prototype was frozen earlier as tag <span class="mono">${esc(d.event.baseline.ref)}</span> (commit ${ext(`${REPO}/commit/${d.event.baseline.sha}`, short(d.event.baseline.sha), 'mono')}, ${esc(day(d.event.baseline.date.slice(0, 10)))}), and the closest snapshot to the event's end is ${ext(`${REPO}/commit/${d.event.snapshot.sha}`, short(d.event.snapshot.sha), 'mono')} (${esc(day(d.event.snapshot.date.slice(0, 10)))}). Both are shown rather than picking one.</p></div>
<div class="card"><table class="qt"><caption class="sr">Metric definitions</caption><thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Definition</th></tr></thead><tbody>${d.queries.map(q => `<tr><th scope="row">${esc(q.metric)}</th><td class="mono">${esc(typeof q.value === 'number' ? n(q.value) : q.value)}</td><td>${esc(q.definition)}</td></tr>`).join('')}</tbody></table>
<p class="foot">Rebuilt with <code>npm run site:progress</code> from git, GitHub, CHANGELOG.md, docs/SFF-PUSH.md (latest entry ${esc(d.tracker.latest)}) and the evidence files linked above. Generated ${esc(d.generated_at.replace('T', ' ').slice(0, 16))} UTC. Missing data stops the build instead of showing a stale number.</p></div>
</section>`
}

export function render(d) {
  return [hero(d), activity(d), rail(d), ladder(d), charts(d), misses(d), feedback(d), next(d), method(d)].join('\n')
}

/** The home-page card, generated so its numbers match the progress page. */
export function homeCard(d) {
  const h = d.headline
  return `<a class="card full progress-card" href="progress/" style="--c: var(--ink); --i: 0">
      <div class="tag">Since SingHacks</div>
      <div><h2>From prototype to proof in ${h.days} days</h2><p style="margin-top:10px">${n(h.prs)} pull requests, ${h.releases} releases and ${h.transactions} Testnet transactions since ${esc(d.since.label.replace(' 2026', ''))}, each with a receipt. Misses included.</p></div>
      <div class="go">Open the progress page <span>→</span></div>
    </a>`
}

const START = '<!-- progress:start -->', END = '<!-- progress:end -->'
const HSTART = '<!-- progress-card:start -->', HEND = '<!-- progress-card:end -->'
const splice = (html, start, end, body, file) => {
  if (!html.includes(start) || !html.includes(end)) throw new Error(`${file}: missing ${start} markers`)
  return html.slice(0, html.indexOf(start) + start.length) + '\n' + body + '\n' + html.slice(html.indexOf(end))
}

export function main(check = process.argv.includes('--check')) {
  const data = JSON.parse(readFileSync(join(root, 'site/progress/data.json'), 'utf8'))
  let stale = 0
  for (const [file, start, end, body] of [['site/progress/index.html', START, END, render(data)], ['site/index.html', HSTART, HEND, homeCard(data)]]) {
    const path = join(root, file), html = readFileSync(path, 'utf8'), next = splice(html, start, end, body, file)
    if (next === html) continue
    stale++
    if (check) console.error(`render-progress: ${file} is out of date; run node scripts/render-progress.mjs`)
    else writeFileSync(path, next)
  }
  if (check && stale) process.exit(1)
  console.log(check ? 'render-progress: ok' : `render-progress: updated ${stale} file${stale === 1 ? '' : 's'}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
