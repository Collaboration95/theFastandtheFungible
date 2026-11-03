// Called only from the main process. Neither the token nor arbitrary target URLs cross IPC.
export function backendRequest(engine, path, init = {}, transport = fetch) {
  const publisher = path.startsWith('/w/')
  const headers = { 'Content-Type': 'application/json', ...(!publisher ? { Authorization: `Bearer ${engine.apiToken}` } : {}) }
  return transport(new URL(path, publisher ? engine.publisherUrl : engine.apiUrl), {
    ...init, headers, redirect: 'error', signal: init.signal ?? AbortSignal.timeout(15_000),
  })
}

export async function testProvider(engine, preferences, transport = fetch) {
  const unavailable = { ok: false, error: { code: 'engine_unavailable', message: 'Engine unavailable' } }
  if (!engine || preferences.backend !== 'local') return unavailable
  try {
    const response = await backendRequest(engine, '/api/providers/test', { method: 'POST', body: JSON.stringify({ ...(preferences.baseUrl ? { baseUrl: preferences.baseUrl } : {}), ...(preferences.model ? { model: preferences.model } : {}) }) }, transport)
    if (response.status === 404 || response.status === 503) return unavailable
    const result = await response.json()
    const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
    // Only measured, numeric fields cross IPC. Never reflect provider error text.
    return { ok: response.ok && result.ok === true, latencyMs: finite(result.latencyMs), inputTokens: finite(result.inputTokens), outputTokens: finite(result.outputTokens), costUsd: result.costUsd === null ? null : finite(result.costUsd), ...(response.ok && result.ok ? {} : { error: { code: 'test_failed', message: 'Connection test failed' } }) }
  } catch { return unavailable }
}
