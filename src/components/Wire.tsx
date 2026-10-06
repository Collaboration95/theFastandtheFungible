import { XRPL_LABEL, type RunSnapshot } from '../../shared/contracts/index.js'

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
        const path = url.pathname.split('/').map(segment => /^(api|runs|profiles|resources|search|read|quote|quotes|settle|settlement|settlements|versions|deliver|delivery|health|events|stop|retry-delivery|report|content|v1|v2|w|articles|challenge)$/.test(segment) ? segment : segment ? '[id]' : '').join('/')
        result.push([name, path])
      } catch { /* Malformed or opaque URL is omitted. */ }
    } else if (['contentDigest', 'sha256', 'digest', 'quoteHash'].includes(key) && typeof value === 'string' && /^(sha256:)?[a-f0-9]{64}$/i.test(value)) {
      result.push([name, value])
    } else if (['verified', 'digestMatches'].includes(key) && typeof value === 'boolean') {
      result.push([name, value ? 'manifest root ✓' : 'manifest root not verified'])
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
    if (event.type === 'GRANT' && event.runId === run.runId) {
      const grant = run.grants.find(item => item.runId === run.runId && item.intentId === event.data?.intentId && item.resourceId === event.data?.resourceId && item.version === event.data?.version)
      if (grant) fields.push(...safeFields({ verification: { verified: true, contentDigest: grant.contentDigest } }))
    }
    return fields.length ? [{ event, fields }] : []
  })
  const quotes = run.intents.filter(intent => intent.runId === run.runId && intent.quote?.runId === run.runId && intent.quote.intentId === intent.intentId && intent.quote.resourceId === intent.resourceId && intent.quote.version === intent.version).map(intent => ({
    intentId: intent.intentId,
    fields: safeFields({ amountMinor: intent.quote!.amountMinor, currency: intent.quote!.currency, quoteHash: intent.quote!.quoteHash, contentDigest: intent.quote!.contentDigest }),
  }))
  return <section className="ra-panel ra-wire" aria-label="HTTP exchange">
    <h2>Wire · HTTP exchange</h2>
    <p className="ra-wire-story">x402 v2: GET → 402 + PAYMENT-REQUIRED → signed payment ({run.labels.settlement === XRPL_LABEL ? 'XRPL Testnet' : 'simulated'}) → same GET + PAYMENT-SIGNATURE → 200 + PAYMENT-RESPONSE → manifest root check</p>
    <p>Settlement: {run.labels.settlement}</p>
    {exchanges.length === 0 ? <p>No HTTP exchange recorded yet.</p> : <ol>
      {exchanges.map(({ event, fields }) => <li key={`${event.runId}:${event.id}`}>
        <strong>{event.type === 'GRANT' ? 'Verified delivery' : 'HTTP'}</strong> <time dateTime={event.at}>{event.at.slice(11, 19)}</time>
        <dl>{fields.map(([key, value]) => <div key={key}><dt>{key}</dt><dd><code>{value}</code></dd></div>)}</dl>
      </li>)}
    </ol>}
    {quotes.length > 0 && <><h3>x402 v2 payment terms · PAYMENT-REQUIRED</h3><p className="ra-muted">Amounts in SGD minor units. quoteHash is the hashed invoiceId sent as the XRPL InvoiceID; contentDigest is the signed manifest root it binds.</p><ol>{quotes.map(quote => <li key={quote.intentId}><dl>{quote.fields.map(([key, value]) => <div key={key}><dt>{key}</dt><dd><code>{value}</code></dd></div>)}</dl></li>)}</ol></>}
  </section>
}
