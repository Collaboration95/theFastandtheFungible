import type { RunSnapshot } from '../../shared/contracts/index.js'

// Never dump event.data: it can contain a delivery token, headers, or paid body.
function safeFields(data: Record<string, unknown>, prefix = '', depth = 0): [string, string][] {
  const result: [string, string][] = []
  for (const [key, value] of Object.entries(data)) {
    const name = prefix ? `${prefix}.${key}` : key
    if (depth < 2 && ['request', 'response', 'http', 'quote', 'receipt', 'verification'].includes(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...safeFields(value as Record<string, unknown>, name, depth + 1))
    } else if (['status', 'statusCode', 'amountMinor', 'priceMinor', 'durationMs', 'bytes'].includes(key) && typeof value === 'number' && Number.isFinite(value)) {
      result.push([name, String(value)])
    } else if (key === 'method' && typeof value === 'string' && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(value)) {
      result.push([name, value])
    } else if (['url', 'path'].includes(key) && typeof value === 'string') {
      try {
        const url = new URL(value, 'http://local.invalid')
        // Keep only known protocol route segments; redact arbitrary identifiers.
        const path = url.pathname.split('/').map(segment => /^(api|runs|profiles|resources|search|read|quote|settle|settlement|deliver|delivery|health|events|stop|retry-delivery|report|content|v1|v2)$/.test(segment) ? segment : segment ? '[id]' : '').join('/')
        result.push([name, path])
      } catch { /* Malformed or opaque URL is omitted. */ }
    } else if (['contentDigest', 'sha256', 'digest', 'quoteHash'].includes(key) && typeof value === 'string' && /^(sha256:)?[a-f0-9]{64}$/i.test(value)) {
      result.push([name, value])
    } else if (['verified', 'digestMatches'].includes(key) && typeof value === 'boolean') {
      result.push([name, value ? 'sha-256 ✓' : 'sha-256 not verified'])
    } else if (key === 'currency' && value === 'SGD') {
      result.push([name, 'SGD'])
    } else if (key === 'status' && typeof value === 'string' && /^(NOT_FOUND|SETTLED|DELIVERY_PENDING|DELIVERY_FAILED|VERIFIED)$/.test(value)) {
      result.push([name, value])
    }
  }
  return result
}

export default function Wire({ run }: { run: RunSnapshot }) {
  const exchanges = run.events.flatMap(event => {
    const fields = safeFields(event.data ?? {})
    return fields.length ? [{ event, fields }] : []
  })
  return <section className="ra-panel ra-wire" aria-label="HTTP exchange">
    <h2>Wire · HTTP exchange</h2>
    <p>Safe raw protocol fields only. Tokens, headers, query strings, bodies and arbitrary identifiers are omitted.</p>
    <p>Settlement: SIMULATED SGD · no real funds</p>
    {exchanges.length === 0 ? <p>No HTTP exchange recorded yet.</p> : <ol>
      {exchanges.map(({ event, fields }) => <li key={`${event.runId}:${event.id}`}>
        <time dateTime={event.at}>{event.at}</time>
        <dl>{fields.map(([key, value]) => <div key={key}><dt>{key}</dt><dd><code>{value}</code></dd></div>)}</dl>
      </li>)}
    </ol>}
  </section>
}
