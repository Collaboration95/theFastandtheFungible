// Called only from the main process. Neither the token nor arbitrary target URLs cross IPC.
export function backendRequest(engine, path, init = {}, transport = fetch) {
  const publisher = path.startsWith('/w/')
  const headers = { 'Content-Type': 'application/json', ...(!publisher ? { Authorization: `Bearer ${engine.apiToken}` } : {}) }
  return transport(new URL(path, publisher ? engine.publisherUrl : engine.apiUrl), {
    ...init, headers, redirect: 'error', signal: init.signal ?? AbortSignal.timeout(15_000),
  })
}
