#!/usr/bin/env node
// Source of truth: shared 160×160 vector parts. No image API or network required.
// node design/cast/build-cast.mjs [--raster] (Chromium through Playwright, 2× PNGs)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const palette = { paper: '#FBF8F2', ink: '#24211E', salmon: '#D9A28F', deep: '#91503F', green: '#2F6B4F', ochre: '#9A6B20', red: '#9B3E35' }
const P = palette
const path = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`
const rect = (x, y, w, h, fill = P.paper, rx = 5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`
const circle = (x, y, r, fill = P.paper) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
const text = (value, x, y, size = 10, fill = P.ink) => `<text x="${x}" y="${y}" text-anchor="middle" stroke="none" fill="${fill}" font-family="ui-monospace,monospace" font-size="${size}" font-weight="700">${value}</text>`
const coin = (x = 122, y = 94) => `<g class="coin">${circle(x,y,12,P.salmon)}${path(`M${x-4} ${y}h8m-4-6v12`)}</g>`
const check = (x = 118, y = 101) => `<g>${circle(x,y,15,P.green)}${path(`M${x-7} ${y}l5 5 9-10`, 'none', `stroke="${P.paper}"`)}</g>`
const badge = (label, color = P.ink) => `<g>${rect(8,134,144,22,P.paper,2)}${text(label,80,149,11,color)}</g>`
const paper = () => `${rect(105,75,35,48)}${path('M112 86h21m-21 9h21m-21 9h14')}`
const face = (caught = false) => `${circle(65,65,3,P.ink)}${circle(88,65,3,P.ink)}${path(caught ? 'M66 84q11-13 22 0' : 'M69 80q8 6 16 0')}`
const spark = () => path('M126 26v10m-5-5h10M30 48l-7-5M131 52l7-5', 'none', `stroke="${P.deep}"`)

function scout(pose) {
 const alarm = pose === 'caught-a-lie'
 let prop = ''
 if (pose === 'clarifying') prop = `${circle(125,39,18)}${text('?',125,46,22)}`
 if (pose === 'searching') prop = `<g class="sweep">${path('M124 70l-12 53h28z',P.salmon)}${rect(115,85,22,27)}${path('M120 85v-9h12v9')}</g>`
 if (pose === 'weighing') prop = `${path('M123 72v48m-19-34h38M109 86l-9 18h18zM137 86l-9 18h18z')}`
 if (pose === 'paying') prop = `${path('M99 106l15-10')}${coin()}`
 if (pose === 'verifying') prop = `${circle(119,93,17)}${path('M131 106l13 15M110 93l6 6 12-13','none',`stroke="${P.green}"`)}`
 if (alarm) prop = `${path('M126 68l21 39h-42z',P.paper)}${text('!',126,99,23,P.red)}${spark()}`
 if (pose === 'done') prop = `${paper()}${check(120,109)}`
 if (pose === 'stopped') prop = `${path('M112 77h20l14 14v20l-14 14h-20l-14-14V91z',P.paper)}${rect(114,91,5,20,P.red,0)}${rect(125,91,5,20,P.red,0)}`
 return `${path('M53 119l-5 10h20m21-10 5 10H75',P.ink)}${rect(44,88,61,36,P.salmon,10)}${path('M44 100l-12 15m73-17 9 11')}${rect(40,37,73,57,P.paper,19)}${path('M37 44l19-23h35l27 23z',P.salmon)}${path('M64 26h16')}${face(alarm)}${prop}`
}
function purse(pose) {
 let prop = pose === 'full' ? `${coin(56,48)}${coin(84,42)}${coin(107,49)}` : ''
 if (pose === 'spending') prop = `${coin(126,42)}${path('M106 36h33m-8-7 8 7-8 7')}`
 if (pose === 'refunded') prop = `${coin(126,42)}${path('M134 60h-30m8-7-8 7 8 7')}`
 if (pose === 'locked') prop = `${rect(67,73,29,29,P.paper)}${path('M72 72v-9a10 10 0 0 1 20 0v9')}`
 return `${prop}${path('M49 49h62l-9 24q29 21 22 47H36q-7-26 22-47z',P.salmon)}${path('M54 66h52')}${pose === 'empty' ? path('M65 99h30M72 109h16') : `${circle(65,94,3,P.ink)}${circle(94,94,3,P.ink)}`}${badge(pose === 'simulated' ? 'SIMULATED' : pose.toUpperCase(),pose === 'simulated' ? P.ochre : P.ink)}`
}
const props = {
 'the-fab-floor': () => `${circle(122,104,20)}${path('M106 95h31m-34 10h38m-33 10h28M115 87v33m11-34v35')}`,
 'kopi-contrarian': () => `${rect(105,87,28,34,P.paper,3)}${path('M134 93h8v18h-8M112 79q-5-7 0-13m10 13q-5-7 0-13')}`,
 'basis-points': () => `${rect(102,82,41,41)}${path('M108 113l10-15 8 7 10-16')}`,
 'notfinancialtimes': () => `${rect(102,80,43,46,P.salmon,1)}${text('NfT',123,96,11)}${path('M109 104h29m-29 8h29')}`,
 'load-factor': () => `${path('M124 79l-18 25h16l-5 22 25-30h-18l6-17z',P.salmon)}`,
 'marketpulse-digest': () => `${rect(104,88,36,36,P.salmon)}${rect(98,80,36,36)}${path('M105 91h22m-22 10h22')}`,
 'open-records': () => `${path('M102 91h40l-20-15z',P.paper)}${path('M106 96v23m15-23v23m15-23v23m-35 5h42')}`,
 alphaleak: () => `${path('M106 99l17-18 20 16-21 18z',P.salmon)}${path('M115 99l5-2m9-4 5-2')}`,
}
function writer(who, pose, index) {
 const bad = who === 'alphaleak' && ['sneaky','caught','refunding'].includes(pose)
 return `${path('M38 126v-15q0-20 38-20t38 20v15z', index % 2 ? P.salmon : P.paper)}${circle(76,64,29)}${path(`M47 60q-3-34 31-31 31 0 27 29l-12-${index % 3 + 8}q-12 14-30 0z`,P.ink)}${face(pose === 'caught')}${props[who]()}${bad ? path(pose === 'caught' ? 'M57 83l34 11-7 17-31-9z' : 'M55 58q22-13 43 0l-3 17H58z', P.salmon) : ''}${pose === 'paid' || pose === 'refunding' ? coin(30,80) : ''}${pose === 'refunding' ? path('M43 78H12m8-7-8 7 8 7') : ''}${pose === 'verified' ? check(31,102) : ''}${pose === 'caught' ? spark() : ''}`
}
function receipt(pose) {
 const label = pose.toUpperCase()
 const color = pose === 'verified' ? P.green : pose === 'simulated' ? P.ochre : P.ink
 return `${pose === 'printing' ? rect(27,26,106,30,P.salmon) : ''}<g class="paper">${path('M41 30h78v96l-10-6-10 6-10-6-10 6-10-6-10 6-18-6z',P.paper)}${path('M53 48h54m-54 12h54m-54 12h32')}${rect(47,84,66,24,P.paper,1)}${text(pose === 'printing' ? '…' : label,80,100,10,color)}</g>${badge(label,color)}`
}
function ledger(pose) {
 return `<g class="ledger-page">${rect(28,64,104,63,P.salmon)}${rect(24,53,104,63)}${rect(29,41,104,63)}${path('M41 54h78m-78 12h78')}${text('tx: hash',80,85,12)}${text('TESTNET',80,99,9,P.deep)}</g>${pose === 'closing' ? path('M139 43v41m-7-8 7 8 7-8') : check(127,111)}${badge(pose === 'closing' ? '~4 s · ILLUSTRATION' : 'CLOSED · TESTNET')}`
}
export async function build({ raster = false } = {}) {
 const out = resolve(root,'src/assets/cast'); mkdirSync(out,{recursive:true})
 const writers = readdirSync(resolve(root,'data/writers')).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(readFileSync(resolve(root,'data/writers',f),'utf8')).publisher)
 const specs = [ ['scout','Scout',['idle','clarifying','searching','weighing','paying','verifying','caught-a-lie','done','stopped']], ['purse','Purse',['full','spending','refunded','locked','empty','simulated']], ...writers.map(w=>[w.slug,w.name,['listening','paid','verified',...(w.slug==='alphaleak'?['sneaky','caught','refunding']:[])]]), ['receipt','Receipt',['printing','verified','refunded','simulated']], ['ledger','Ledger',['closing','closed']] ]
 const assets = []
 for (const [who,name,poses] of specs) for (const pose of poses) {
  const body = who === 'scout' ? scout(pose) : who === 'purse' ? purse(pose) : who === 'receipt' ? receipt(pose) : who === 'ledger' ? ledger(pose) : writer(who,pose,writers.findIndex(w=>w.slug===who))
  const label = `${name} · ${pose.replaceAll('-',' ')}${writers.some(w=>w.slug===who) ? ' · fictional writer' : ''}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-labelledby="title"><title id="title">${label}</title><g stroke="${P.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>\n`
  if (Buffer.byteLength(svg) >= 8192) throw new Error(`${who}-${pose} exceeds 8 KiB`)
  writeFileSync(resolve(out,`${who}-${pose}.svg`),svg)
  assets.push({who,pose,name,label,file:`${who}-${pose}.svg`})
 }
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify(assets,null,2)+'\n')
 const cards = assets.map(a=>`<figure><img width="160" height="160" alt="${a.label}" src="../../src/assets/cast/${a.file}"><figcaption>${a.name}<br><code>${a.pose}</code></figcaption></figure>`).join('')
 writeFileSync(resolve(root,'design/cast/sheet.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ResearchAgent · Cast QA</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;padding:32px;background:${P.paper};color:${P.ink};font:16px/1.5 system-ui}h1{font-size:40px;margin:0}p{max-width:70ch}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:16px}figure{margin:0;border-top:1px solid ${P.salmon};padding:16px 0;text-align:center}img{max-width:100%}code{font-size:13px;color:${P.deep}}@media(prefers-reduced-motion:no-preference){figure:hover img{transform:translateY(-4px);transition:transform .2s}}</style><main><h1>Meet the cast.</h1><p>Scout searches. Purse holds the authority. Eight fictional writers make their promises. Receipt and Ledger show what happened. ${assets.length} poses · shared vector parts · light theme.</p><p>QA artwork only. Coins, locks, verification stamps and ledger ticks here are illustrations of states, not live payment or escrow evidence. Ledger hash text is a placeholder.</p><div class="grid">${cards}</div></main></html>\n`)
 if (raster) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch()
  try {
   const page = await browser.newPage({viewport:{width:160,height:160},deviceScaleFactor:2,reducedMotion:'reduce'})
   const dir = resolve(root,'design/cast/png');mkdirSync(dir,{recursive:true})
   for (const a of assets) { await page.goto(pathToFileURL(resolve(out,a.file)).href); await page.screenshot({path:resolve(dir,`${a.who}-${a.pose}.png`),omitBackground:true}) }
   await page.setViewportSize({width:1440,height:1000}); await page.goto(pathToFileURL(resolve(root,'design/cast/sheet.html')).href)
   await page.screenshot({path:resolve(root,'design/cast/cast-sheet.png'),fullPage:true})
  } finally { await browser.close() }
 }
 console.log(`Built ${assets.length} SVG poses (< 8 KiB each)${raster ? ', 2× PNGs and QA screenshot' : ''}.`)
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build({raster:process.argv.includes('--raster')})
