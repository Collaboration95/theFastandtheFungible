// Creates (or recreates) the "ResearchAgent · live health" dashboard in Langfuse from code.
// Run: make langfuse-dashboard. Uses the unstable dashboards API; widgets read live-environment data.
import 'dotenv/config'
if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY) { console.error('Set LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY in .env'); process.exit(1) }

const NAME = 'ResearchAgent · live health'
const PREFIX = 'RA · ' // widgets are matched by this prefix so reruns never touch anyone else's widgets
const base = (process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com').replace(/\/$/, '')
const auth = 'Basic ' + Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString('base64')
async function api(method, path, body) {
  for (;;) {
    const res = await fetch(`${base}/api/public/unstable${path}`, { method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
    const text = await res.text()
    if (res.status === 429) { // The unstable API allows 30 calls a minute.
      let wait = 30
      try { wait = JSON.parse(text).details?.retryAfterSeconds ?? 30 } catch { /* non-JSON 429 */ }
      console.log(`rate limited; waiting ${wait}s`)
      await new Promise(resolve => setTimeout(resolve, (wait + 1) * 1000)); continue
    }
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`)
    return text ? JSON.parse(text) : {}
  }
}
const names = (column, value) => ({ column, operator: 'any of', type: 'stringOptions', value })
const score = name => [names('name', [name])]

// [title, description, view, chartType, metrics, dimensions, filters, width]
const widgets = [
  ['Runs', 'Live research runs per hour', 'observations', 'BAR_TIME_SERIES', [{ measure: 'count', agg: 'count' }], [], [names('name', ['research-run'])], 6],
  ['Fully-live rate', 'Share of runs where every answer and decision came from the live model (1 = no fixture fallback)', 'scores-boolean', 'NUMBER', [{ measure: 'value', agg: 'avg' }], [], score('fully-live'), 3],
  ['Time to first answer (s)', 'Ask → validated cited answer v1, average', 'scores-numeric', 'NUMBER', [{ measure: 'value', agg: 'avg' }], [], score('time-to-first-answer-s'), 3],
  ['Step latency p95 (ms)', 'Where a run spends its time', 'observations', 'HORIZONTAL_BAR', [{ measure: 'latency', agg: 'p95' }], [{ field: 'name' }], [names('name', ['research-run', 'retrieve-sources', 'write-answer', 'generate-answer', 'decide-purchase', 'judge-candidate', 'buy-source', 'research-report'])], 6],
  ['Time to first token p50 (ms)', 'Streaming responsiveness of each LLM call', 'observations', 'HORIZONTAL_BAR', [{ measure: 'timeToFirstToken', agg: 'p50' }], [{ field: 'name' }], [names('name', ['generate-answer', 'draft-report'])], 6],
  ['Fallback rates', 'Share of steps that fell back to a labelled fixture', 'scores-boolean', 'HORIZONTAL_BAR', [{ measure: 'value', agg: 'avg' }], [{ field: 'name' }], [names('name', ['answer-fallback', 'decision-unavailable', 'report-fallback'])], 6],
  ['Errors and warnings by step', 'Observations logged at ERROR or WARNING level', 'observations', 'HORIZONTAL_BAR', [{ measure: 'count', agg: 'count' }], [{ field: 'name' }], [names('level', ['ERROR', 'WARNING'])], 6],
  ['Citation validity', 'Share of model claims that survive the exact-passage check', 'scores-numeric', 'NUMBER', [{ measure: 'value', agg: 'avg' }], [], score('citation-validity'), 3],
  ['XRPL confirm (s)', 'Sign → ledger validation → publisher receipt, average', 'scores-numeric', 'NUMBER', [{ measure: 'value', agg: 'avg' }], [], score('ledger-confirm-seconds'), 3],
  ['Purchase outcomes', 'VERIFIED vs failed or pending purchases', 'scores-categorical', 'PIE', [{ measure: 'count', agg: 'count' }], [{ field: 'stringValue' }], score('purchase-outcome'), 3],
  ['Impact of purchases', 'How bought evidence changed the answer', 'scores-categorical', 'PIE', [{ measure: 'count', agg: 'count' }], [{ field: 'stringValue' }], score('impact'), 3],
  ['LLM cost by model (USD)', 'Priced via the custom deepseek-flash model (peak/off-peak tiers)', 'observations', 'HORIZONTAL_BAR', [{ measure: 'totalCost', agg: 'sum' }], [{ field: 'providedModelName' }], [names('type', ['GENERATION'])], 6],
  ['Spend per run (S$, simulated/Testnet)', 'Average budget spent per run', 'scores-numeric', 'NUMBER', [{ measure: 'value', agg: 'avg' }], [], score('spent-sgd'), 3],
  ['Clef gap materiality', 'Average probability that the open gap could change the answer', 'scores-numeric', 'NUMBER', [{ measure: 'value', agg: 'avg' }], [], score('gap-material'), 3],
]

const existing = (await api('GET', '/dashboards?limit=100')).data?.filter(d => d.name === NAME) ?? []
for (const dashboard of existing) await api('DELETE', `/dashboards/${dashboard.id}`)
// Widgets are standalone; drop the ones this script created before so reruns don't pile up copies.
for (const widget of (await api('GET', '/dashboard-widgets?limit=100')).data ?? []) if (widget.name.startsWith(PREFIX)) await api('DELETE', `/dashboard-widgets/${widget.id}`)
const dashboard = await api('POST', '/dashboards', {
  name: NAME, description: 'Latency, failure (fallback) rates, quality and cost of live runs. Created by scripts/langfuse-dashboard.mjs.',
  filters: [names('environment', ['live'])],
})
let x = 0, y = 0
for (const [name, description, view, chartType, metrics, dimensions, filters, width] of widgets) {
  const widget = await api('POST', '/dashboard-widgets', { name: PREFIX + name, description, view, chartType, metrics, dimensions, filters })
  if (x + width > 12) { x = 0; y += 5 }
  await api('POST', `/dashboards/${dashboard.id}/placements`, { type: 'widget', widgetId: widget.id, x, y, width, height: 5 })
  x += width
}
const project = (await (await fetch(`${base}/api/public/projects`, { headers: { Authorization: auth } })).json()).data?.[0]?.id
console.log(`${existing.length ? 'Recreated' : 'Created'} "${NAME}" with ${widgets.length} widgets: ${base}/project/${project}/dashboards/${dashboard.id}`)
