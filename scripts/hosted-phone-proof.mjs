#!/usr/bin/env node
// Local HOSTED=1 fixture/simulated phone proof. Run under the shared heavy lock after building --root.
// --root <checkout-or-archive> --out <json> --label <arm>. Never contacts the deployed demo or ledger.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
const { ResourceScope, waitForOutput } = await import('../shared/resource-scope.ts')
const args = process.argv.slice(2), arg = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1] }
const root = resolve(arg('root', '.')), out = resolve(arg('out', 'scratch/phone.json')), label = arg('label', 'current')
const scope = new ResourceScope(), dir = scope.tempDir('ra-hosted-phone-')
const port = () => new Promise(resolve => { const server = createServer().listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)) }) })
const [web, vm, apiPort, pubPort] = await Promise.all([port(), port(), port(), port()])
if ([web, vm, apiPort, pubPort].some(p => [5100, 8788, 8790].includes(p))) throw Error('Reserved port allocated')
const origin = `https://localhost:${web}`, url = file => pathToFileURL(join(root, file)).href
const env = { ...process.env }
for (const key of Object.keys(env)) if (/(?:API_KEY|TOKEN|SEED|SECRET)$/.test(key)) delete env[key]
Object.assign(env, { HOSTED: '1', HOSTED_SSE_GZIP: '1', HOSTED_ORIGIN: origin, HOSTED_TRUSTED_PROXY: '127.0.0.1', HOSTED_IP_HMAC_KEY: 'phone-proof-fixture-only-'.padEnd(40, 'x'), HOSTED_CONTROL_PATH: join(dir, 'control.json'), SETTLEMENT_RAIL: 'simulated', ANCHOR_RAIL: 'off', LLM_PROVIDER: 'fixture', DECISION_PROVIDER: 'fixture', SEARCH_EMBEDDINGS: 'off', LANGFUSE_ENABLED: '0', DOTENV_CONFIG_PATH: join(dir, 'no-env'), APP_DB: join(dir, 'app.db'), PUBLISHER_DB: join(dir, 'publisher.db'), REPORT_DIR: join(dir, 'reports'), PUBLISHER_FAULTS: '0', K_SERVICE: '', HOSTED_PUBLISHER_UPSTREAM: '', RA_DATA_DIR: dir })
writeFileSync(env.HOSTED_CONTROL_PATH, JSON.stringify({ admissionsPaused: false, spendingPaused: false, reasonCode: 'local_phone_fixture', expiresAt: '2026-11-19T16:00:00Z' }))
let proofPage
const metricsFile = join(dir, 'server-metrics.json')
// Test-only 1.5 s delay at the publisher-client transport boundary, same in both arms, to expose progress frames.
// This changes no tracked source and no model/payment decision. Readiness alone is overridden: no funded payer here.
writeFileSync(join(dir, 'stack.mjs'), `
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer, request } from 'node:http';
import { extname, resolve, join } from 'node:path';
const { PublisherClient } = await import(${JSON.stringify(url('server/publisher-client.ts'))});
const original = PublisherClient.prototype.fetchPath;
PublisherClient.prototype.fetchPath = async function(...args) { await new Promise(r => setTimeout(r, 1500)); return original.apply(this, args) };
const { createPublisherApp } = await import(${JSON.stringify(url('publisher/routes.ts'))});
const publisher = createPublisherApp({ journal: process.env.PUBLISHER_DB, rail: 'simulated' }); await publisher.locals.ready;
const pub = publisher.listen(${pubPort}, '127.0.0.1'); await new Promise(r => pub.once('listening', r));
const { createApiApp } = await import(${JSON.stringify(url('server/routes.ts'))});
const api = await createApiApp({ dbPath: process.env.APP_DB, publisherUrl: 'http://127.0.0.1:${pubPort}', hostedReadiness: async () => true, reconcileIntervalMs: 0 });
const raw = api.app.listen(${apiPort}, '127.0.0.1');
const metrics = { sseBytes: 0, sseConnections: 0, doneAt: null, runId: null };
const save = () => writeFileSync(${JSON.stringify(metricsFile)}, JSON.stringify(metrics)); save();
const append = api.store.appendEvent.bind(api.store);
api.store.appendEvent = (id, input) => { const event = append(id, input); if (input.type === 'DONE') { metrics.doneAt = Date.parse(event.at); metrics.runId = id; save() } return event };
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/x-icon' };
const dist = ${JSON.stringify(join(root, 'dist'))};
const front = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (/^\\/(api|runs|w|proof|livez|startupz|readyz)(\\/|$)/.test(path)) {
    const sse = /\\/events$/.test(path); if (sse) { metrics.sseConnections++; save() }
    const upstream = request({ host: '127.0.0.1', port: ${apiPort}, path: req.url, method: req.method, headers: req.headers }, reply => {
      res.writeHead(reply.statusCode, reply.headers);
      if (sse) reply.on('data', chunk => { metrics.sseBytes += chunk.length; save() });
      reply.pipe(res); res.on('close', () => upstream.destroy());
    }); upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() }); req.pipe(upstream); return;
  }
  const file = resolve(dist, '.' + decodeURIComponent(path));
  const target = file.startsWith(dist + '/') && extname(file) && existsSync(file) ? file : join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store' }); res.end(readFileSync(target));
}).listen(${vm}, '127.0.0.1', () => console.log('H7_PHONE_READY'));
const stop = async () => { front.closeAllConnections(); front.close(); raw.closeAllConnections(); raw.close(); await api.close(); pub.closeAllConnections(); pub.close(); publisher.locals.journal.close(); process.exit() };
process.on('SIGTERM', () => void stop()); process.on('SIGINT', () => void stop());
`)
try {
  const child = scope.spawn(process.execPath, ['--import', 'tsx', join(dir, 'stack.mjs')], { cwd: root, env }); child.stderr.pipe(process.stderr)
  await waitForOutput(child, /H7_PHONE_READY/, 60000); child.stdout.resume()
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' })
  const rendered = execFileSync('envsubst', ['${VM_UPSTREAM} ${HOSTED_VIDEO_URL}'], { input: readFileSync(join(root, 'docker/hosted/front/default.conf.template')), encoding: 'utf8', env: { ...env, VM_UPSTREAM: `127.0.0.1:${vm}`, HOSTED_VIDEO_URL: '' } })
    .replace('listen 8080;', `listen 127.0.0.1:${web} ssl; ssl_certificate ${dir}/cert.pem; ssl_certificate_key ${dir}/key.pem;`)
    .replace('proxy_set_header Host $host;', 'proxy_set_header Host $http_host;') // preserve the ephemeral local TLS port
    .replaceAll('/usr/share/nginx/html', join(root, 'docker/hosted')).replace('error_log /dev/stderr crit;', `error_log ${dir}/front.log crit;`)
  mkdirSync(join(dir, 'tmp')); writeFileSync(join(dir, 'front.conf'), rendered)
  writeFileSync(join(dir, 'nginx.conf'), `pid ${dir}/nginx.pid; error_log ${dir}/nginx.log; events {} http { access_log off; client_body_temp_path ${dir}/tmp/c; proxy_temp_path ${dir}/tmp/p; fastcgi_temp_path ${dir}/tmp/f; uwsgi_temp_path ${dir}/tmp/u; scgi_temp_path ${dir}/tmp/s; include ${dir}/front.conf; }`)
  execFileSync('nginx', ['-t', '-c', join(dir, 'nginx.conf')], { stdio: 'pipe' })
  const nginx = scope.spawn('nginx', ['-c', join(dir, 'nginx.conf'), '-g', 'daemon off;']); nginx.stdout.resume(); nginx.stderr.pipe(process.stderr)
  const browser = await chromium.launch(); scope.defer(() => browser.close())
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await context.newPage(); proofPage = page
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 93750, connectionType: 'cellular4g' }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    window.__h7 = { snapshots: [], traces: [], doneVisibleAt: null }
    const Native = window.EventSource
    window.EventSource = class extends Native { constructor(...args) { super(...args); for (const type of ['snapshot', 'trace']) this.addEventListener(type, event => { const data = JSON.parse(event.data); window.__h7[type === 'snapshot' ? 'snapshots' : 'traces'].push({ at: Date.now(), serverAt: data.at, phase: data.phase, type: data.type }) }) } }
    new MutationObserver(() => { if (window.__h7.doneVisibleAt === null && document.querySelector('.ra-run-status [role="status"]')?.textContent?.startsWith('Done in')) requestAnimationFrame(() => { if (window.__h7.doneVisibleAt === null) window.__h7.doneVisibleAt = Date.now() }) }).observe(document, { subtree: true, childList: true, characterData: true })
  })
  const visits = []
  for (let i = 0; i < 2; i++) {
    await page.goto(origin, { waitUntil: 'domcontentloaded' }); await page.getByRole('textbox', { name: 'Your question' }).waitFor()
    visits.push(await page.evaluate(() => { const nav = performance.getEntriesByType('navigation')[0]; const resources = performance.getEntriesByType('resource'); return { composerMs: Math.round(performance.now()), staticTransferBytes: nav.transferSize + resources.filter(r => new URL(r.name).pathname.startsWith('/assets/')).reduce((n,r) => n + r.transferSize,0), allTransferBytes: nav.transferSize + resources.reduce((n,r) => n + r.transferSize,0), app: resources.filter(r => /\/assets\/app-.*\.js/.test(r.name)).map(r => ({ encoded: r.encodedBodySize, transfer: r.transferSize })) } }))
  }
  await page.getByRole('group', { name: 'Demo questions' }).getByRole('button', { name: /^Kestrel–TSMC/ }).click(); await page.getByRole('button', { name: /^Ask/ }).click()
  const chip = page.getByRole('button', { name: 'pricing & margins' }), start = page.getByRole('button', { name: 'Start now' })
  await chip.or(start).first().waitFor({ timeout: 30000 }); if (await chip.isVisible()) await chip.click(); await start.waitFor({ timeout: 30000 })
  const planCount = await page.evaluate(async () => (await (await fetch('/api/demo/status')).json()).remaining.questions)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  const cancelCount = await page.evaluate(async () => (await (await fetch('/api/demo/status')).json()).remaining.questions)
  await page.getByRole('button', { name: /^Ask/ }).click(); await chip.or(start).first().waitFor({ timeout: 30000 }); if (await chip.isVisible()) await chip.click(); await start.waitFor({ timeout: 30000 }); await start.click()
  await page.waitForFunction(() => window.__h7.doneVisibleAt !== null, undefined, { timeout: 90000 })
  const client = await page.evaluate(() => window.__h7)
  const server = JSON.parse(readFileSync(metricsFile, 'utf8'))
  const runId = new URL(page.url()).searchParams.get('run')
  mkdirSync(resolve(out, '..'), { recursive: true })
  await page.screenshot({ path: out.replace(/\.json$/, '.png') })
  const final = await page.evaluate(async () => { const id = new URL(location.href).searchParams.get('run'); return await (await fetch(`/runs/${id}`)).json() })
  const startCount = await page.evaluate(async () => (await (await fetch('/api/demo/status')).json()).remaining.questions)
  const hashes = Object.fromEntries(['index.html', 'vite.config.ts', 'package.json', 'package-lock.json', 'server/routes.ts', 'server/api/runs.ts', 'server/api/sse.ts', 'server/hosted/limits.ts', 'docker/hosted/front/default.conf.template', 'docker/hosted/proxy-headers.conf'].filter(f => existsSync(join(root, f))).map(f => [f, createHash('sha256').update(readFileSync(join(root, f))).digest('hex')]))
  const hashTrees = folders => Object.fromEntries(folders.flatMap(folder => readdirSync(join(root, folder), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name))).sort().map(file => [file.slice(root.length + 1), createHash('sha256').update(readFileSync(file)).digest('hex')]))
  const uiFiles = hashTrees(['src', 'shared', 'public']), engineFiles = hashTrees(['server', 'publisher', 'data/corpus/v2', 'data/writers'])
  const result = { engineFiles, harnessSha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'), uiFiles, label, at: new Date().toISOString(), evidence: 'local HOSTED=1; fixture models, fictional Kestrel–TSMC corpus, simulated SGD; readiness override; test-only 1500 ms publisher transport delay; nginx front template with local TLS/port adaptations', throttle: { width: 390, height: 844, downloadMbps: 1.6, latencyMs: 150, cpuRate: 4 }, hashes, visits, questions: { afterPlan: planCount, afterCancel: cancelCount, afterStart: startCount }, server, client, doneLagMs: client.doneVisibleAt - server.doneAt, maxTraceArrivalLagMs: Math.max(0, ...client.traces.map(frame => frame.at - Date.parse(frame.serverAt))), snapshotFrames: client.snapshots.length, run: { id: runId, phase: final.phase, labels: final.labels, elapsedMs: server.doneAt - Date.parse(final.events[0].at), rawBytes: Buffer.byteLength(JSON.stringify(final)), spentMinor: final.spentMinor, intents: final.intents.length, receipts: final.receipts.length, verifiedGrants: final.grants.length } }
  mkdirSync(resolve(out, '..'), { recursive: true }); writeFileSync(out, JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result, null, 2))
  if (final.phase !== 'DONE' || !final.receipts.length) throw Error('Paid fixture run did not complete')
} catch (error) {
  mkdirSync('scratch', { recursive: true })
  const failure = resolve('scratch', `h7-phone-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-failure.png`)
  try { await proofPage?.screenshot({ path: failure }); console.error(`Phone proof failure screenshot: ${failure}`) } catch { /* preserve the original failure */ }
  for (const file of ['nginx.log', 'front.log']) if (existsSync(join(dir, file))) console.error(readFileSync(join(dir, file), 'utf8').slice(-4000))
  throw error
} finally { await scope.close() }
