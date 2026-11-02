/* SFF chapter only. October data and charts remain untouched. No remote fetch. */
(() => {
  const data = window.EVO?.sff;
  if (!data) return;
  const root = document.getElementById('sff-days');
  const base = 'https://github.com/Collaboration95/theFastandtheFungible';
  const node = (tag, text, cls) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; };
  // Small safe Markdown subset: text, links and issue references. Never inject HTML.
  function prose(text) {
    const p = node('span');
    const pattern = /\[([^\]]+)\]\(([^)]+)\)|#(\d+)/g;
    let at = 0;
    for (const m of text.matchAll(pattern)) {
      p.append(document.createTextNode(text.slice(at, m.index)));
      let href = m[3] ? `${base}/issues/${m[3]}` : m[2];
      if (href.startsWith('#')) href = `${base}/blob/main/docs/SFF-PUSH.md${href}`;
      else if (!/^https?:\/\//.test(href)) href = `${base}/blob/main/docs/${href}`;
      try { if (!['https:', 'http:'].includes(new URL(href).protocol)) throw new Error('unsupported URL'); const a = node('a', m[1] || `#${m[3]}`); a.href = href; p.append(a); }
      catch { p.append(document.createTextNode(m[0])); }
      at = m.index + m[0].length;
    }
    p.append(document.createTextNode(text.slice(at))); return p;
  }
  root.replaceChildren();
  const source = document.getElementById('sff-source');
  source.append('Source: main ', Object.assign(node('a', data.source_sha.slice(0, 7)), { href: `${base}/commit/${data.source_sha}` }), ` · updated ${data.generated_at}`);
  for (const day of data.cards) {
    const article = node('article', null, 'sff-day');
    const h = node('h3'); const date = node('time', day.heading); date.dateTime = day.date; h.append(date); article.append(h);
    const list = node('ul');
    for (const ship of day.ships) { const li = node('li'); li.append(prose(ship)); list.append(li); }
    article.append(list);
    article.append(node('p', day.metrics.length ? `Recorded metric move: ${day.metrics.join(' · ')}` : 'No metric move recorded for this day.', 'sff-metric'));
    if (day.image && /^img\/[\w/-]+\.(png|jpe?g|webp)$/.test(day.image)) {
      const img = node('img'); img.src = day.image; img.alt = 'ResearchAgent geometric state system — illustration, not live payment evidence'; img.width = 1200; img.height = 630; img.loading = 'lazy'; article.append(img);
    }
    root.append(article);
  }
  // Content is always visible. Animate on entry only; no opacity-hidden JS gate.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('sff-enter'); observer.unobserve(e.target); }
    }), { threshold: .12 });
    root.querySelectorAll('article').forEach(el => observer.observe(el));
  }
  const note = document.getElementById('sff-score-note');
  if (!data.scorecard?.length) {
    note.textContent = data.scorecard_available ? 'Coming soon — no valid scorecard snapshots yet.' : 'Coming soon — the nightly scorecard has not been published.';
    if (data.skipped_scorecard_rows) note.append(` ${data.skipped_scorecard_rows} malformed history rows skipped.`);
    return;
  }
  note.textContent = 'Committed scorecard snapshots from main. Fixture and live runs are separate; null values remain unmeasured. Timing depends on the machine. Each chart includes its values and source commit.';
  if (data.skipped_scorecard_rows) note.append(` ${data.skipped_scorecard_rows} malformed history rows skipped.`);
  const groups = new Map();
  const conditions = node('details'); conditions.append(node('summary', 'Measurement conditions'));
  const descriptions = new Set();
  for (const row of data.scorecard) {
    if (!row.labels) continue;
    const description = `${row.mode || 'unspecified'} · ${Object.values(row.labels).join(' · ')}${row.timing?.platform ? ` · ${row.timing.platform} / ${row.timing.node}` : ''}`;
    if (!descriptions.has(description)) { conditions.append(node('p', description)); descriptions.add(description); }
  }
  if (descriptions.size) note.after(conditions);
  function scorecardV1(row) {
    return {
      'Wasted spend (%)': row.quality?.wastedSpendPct,
      'Selection F1 · flow': row.quality?.selectionF1Flow,
      'Selection F1 · sweep': row.quality?.selectionF1Sweep,
      'Supported-fact uplift (points)': row.quality?.supportedFactUpliftPts,
      'False-complete rate (0–1)': row.quality?.falseCompleteRate,
      'Time to first answer · p95 (ms)': row.timing?.p95FirstAnswerMs,
      'Time to final answer · p95 (ms)': row.timing?.p95FinalAnswerMs,
      'Cold start (ms)': row.timing?.coldStartMs,
      'Model cost per timed query (US$)': row.cost?.latencyModelUsdPerQuery,
      'Decision cost per flow query (US$)': row.cost?.flowDecisionUsdPerQuery,
      'XRP spent (drops)': row.cost?.xrpDropsSpent,
      'Hard-gate violations': row.audit?.total,
      'DMG cold start (ms)': row.external?.dmgColdStartMs,
    };
  }
  // Accept nested metric records without converting null, booleans or text to zero.
  function flatten(value, prefix = '', out = {}) {
    if (!value || typeof value !== 'object') return out;
    for (const [key, item] of Object.entries(value)) {
      const name = prefix ? `${prefix}.${key}` : key;
      if (typeof item === 'number' && Number.isFinite(item)) out[name] = item;
      else if (item && !Array.isArray(item) && typeof item === 'object') flatten(item, name, out);
    }
    return out;
  }
  for (const row of data.scorecard) {
    const mode = String(row.mode || row.runMode || 'unspecified');
    const date = String(row.at || row.timestamp || row.createdAt || row.date || row.generatedAt || 'undated');
    const sha = String(row.sha || row.commit || row.commitSha || 'unrecorded');
    const values = row.schema === 'tftf.scorecard/v1' ? scorecardV1(row) : flatten(row.metrics || row);
    for (const [metric, value] of Object.entries(values)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      if (row.schema !== 'tftf.scorecard/v1' && !/waste|f1|uplift|false.?complete|ttfa|cold.?start|violation|latency|cost|p95/i.test(metric)) continue;
      const key = `${mode} / ${metric}${row.inputHash ? ` · input ${String(row.inputHash).slice(0, 8)}` : ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ value, date, sha, mode, dirty: row.worktreeDirty === true });
    }
  }
  const mount = document.getElementById('sff-scorecards');
  if (!groups.size) { note.textContent = 'Coming soon — scorecard history exists, but has no measured chart metrics yet.'; return; }
  for (const [label, points] of groups) {
    points.sort((a, b) => a.date.localeCompare(b.date));
    const card = node('div', null, 'sff-series'); card.append(node('h4', label));
    const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 280 64'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${label}: ${points.map(p => p.value).join(' → ')}`);
    const lo = Math.min(...points.map(p => p.value)), hi = Math.max(...points.map(p => p.value));
    const xy = points.map((p, i) => [points.length === 1 ? 140 : 8 + i * 264 / (points.length - 1), hi === lo ? 32 : 56 - (p.value - lo) * 48 / (hi - lo)]);
    const line = document.createElementNS(ns, 'polyline'); line.setAttribute('points', xy.map(p => p.join(',')).join(' ')); line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#2F6B4F'); line.setAttribute('stroke-width', '2'); svg.append(line);
    for (const [x, y] of xy) { const c = document.createElementNS(ns, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '3'); c.setAttribute('fill', '#2F6B4F'); svg.append(c); }
    card.append(svg);
    for (const p of points) { const item = node('p', `${p.date} · ${Number(p.value.toPrecision(6))} · ${p.mode}${p.dirty ? ' · working tree modified' : ''} · `); if (/^[a-f0-9]{7,40}$/i.test(p.sha)) item.append(Object.assign(node('a', p.sha.slice(0, 7)), { href: `${base}/commit/${p.sha}` })); else item.append('commit unrecorded'); card.append(item); }
    mount.append(card);
  }
})();
