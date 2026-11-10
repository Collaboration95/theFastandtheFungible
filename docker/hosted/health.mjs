const publisher = process.env.ROLE === 'publisher'
const port = publisher ? process.env.PUBLISHER_PORT || 8790 : process.env.PORT || 8788
try { const r = await fetch(`http://127.0.0.1:${port}/${publisher ? 'health' : 'livez'}`, { signal: AbortSignal.timeout(2000) }); process.exit(r.ok ? 0 : 1) } catch { process.exit(1) }
