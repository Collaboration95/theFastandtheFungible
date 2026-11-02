#!/usr/bin/env node
// Source of truth: 24-unit geometry, 1.5-unit strokes. No image API/network.
// node design/cast/build-cast.mjs [--raster] (Chromium, 2× PNGs and QA sheet)
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const palette = { paper: '#FBF8F2', ink: '#24211E', salmon: '#D9A28F', deep: '#91503F', green: '#2F6B4F', ochre: '#9A6B20', red: '#9B3E35' }
const P = palette
const path = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`
const rect = (x,y,w,h,fill=P.paper,rx=1) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`
const circle = (x,y,r,fill=P.paper) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
const coin = (x=18,y=8) => `${circle(x,y,3.5,P.salmon)}${path(`M${x} ${y-1.5}v3`)}`
const check = () => path('M15 17l2 2 5-5','none',`stroke="${P.green}"`)
const page = () => `${path('M5 3h10l4 4v14H5z',P.paper)}${path('M15 3v4h4M8 10h5m-5 4h3')}`
const badge = (label,color=P.ink) => `<text x="80" y="151" text-anchor="middle" stroke="none" fill="${color}" font-family="system-ui,sans-serif" font-size="10" font-weight="600" letter-spacing=".6">${label}</text>`
function scout(pose) {
 if(pose==='idle') return `${path('M12 2l8 18-8-4-8 4z',P.paper)}${path('M12 8v8')}`
 if(pose==='clarifying') return `${path('M3 4h18v13H10l-5 4v-4H3z',P.paper)}${path('M10 8a2 2 0 0 1 4 0c0 2-2 2-2 4M12 14v.1')}`
 if(pose==='searching') return `${circle(10,10,6)}${path('M14.5 14.5L21 21M7 10h6m-3-3v6')}`
 if(pose==='weighing') return `${path('M12 3v18M4 7h16M7 7l-4 8h8zM17 7l-4 8h8zM8 21h8')}`
 if(pose==='paying') return `${coin(8,12)}${path('M14 12h8m-3-3 3 3-3 3')}`
 if(pose==='verifying') return `${circle(10,10,6)}${path('M15 15l6 6M7 10l2 2 4-4','none',`stroke="${P.green}"`)}`
 if(pose==='caught-a-lie') return `${path('M12 3l10 18H2z',P.paper)}${path('M12 9v5m0 3v.1','none',`stroke="${P.red}"`)}`
 if(pose==='done') return `${page()}${check()}`
 return `${rect(4,4,16,16)}${path('M9 8v8m6-8v8')}`
}
function purse(pose) {
 const wallet = `${rect(3,7,18,14)}${path('M3 9V5h15v2')}${rect(16,12,5,5,P.salmon)}`
 if(pose==='full') return `${wallet}${path('M6 12h6m-6 4h4')}`
 if(pose==='spending') return `${wallet}${path('M5 3h10m-3-2 3 2-3 2')}`
 if(pose==='refunded') return `${wallet}${path('M15 3H5m3-2L5 3l3 2')}`
 if(pose==='locked') return `${wallet}${rect(6,12,7,7)}${path('M7 12v-2a2.5 2.5 0 0 1 5 0v2')}`
 if(pose==='empty') return `${wallet}${path('M6 14h6')}`
 return `${wallet}${path('M7 12l5 5m0-5-5 5','none',`stroke="${P.ochre}"`)}`
}
const props = {
 'the-fab-floor': () => `${circle(17,17,5,P.paper)}${path('M13 15h8m-9 4h10m-7-7v10m4-10v10')}`,
 'kopi-contrarian': () => `${rect(13,12,7,9)}${path('M20 14h3v4h-3M15 9V7m3 2V7')}`,
 'basis-points': () => `${rect(12,12,11,10)}${path('M14 19l3-4 2 2 2-3')}`,
 'notfinancialtimes': () => `${rect(12,11,11,11,P.salmon)}${path('M14 14h7m-7 3h7m-7 3h4')}`,
 'load-factor': () => path('M18 10l-6 8h5l-1 5 7-9h-5l1-4z',P.paper),
 'marketpulse-digest': () => `${rect(14,13,9,9,P.salmon)}${rect(11,10,9,9)}${path('M13 13h5m-5 3h5')}`,
 'open-records': () => `${path('M12 14l5-4 6 4z',P.paper)}${path('M13 16v5m4-5v5m4-5v5m-10 2h12')}`,
 alphaleak: () => `${path('M12 11h11v11H12z',P.paper)}${path('M18 11l-3 5h5l-3 6')}`,
}
function writer(who,pose) {
 const avatar=`${circle(8,6,3)}${path('M2 20v-3a6 6 0 0 1 10-4')}`
 const prop = props[who]()
 if(pose==='paid') return `${avatar}${prop}${coin(4,12)}`
 if(pose==='verified') return `${avatar}${prop}${path('M2 13l2 2 5-5','none',`stroke="${P.green}"`)}`
 if(pose==='sneaky') return `${avatar}${prop}${path('M2 6h12')}`
 if(pose==='caught') return `${avatar}${prop}${path('M3 10l7-7','none',`stroke="${P.red}"`)}`
 if(pose==='refunding') return `${avatar}${prop}${path('M11 10H2m3-3-3 3 3 3')}`
 return `${avatar}${prop}`
}
function receipt(pose) {
 const base=`${path('M5 2h14v20l-3-2-4 2-4-2-3 2z',P.paper)}${path('M8 6h8m-8 4h8')}`
 if(pose==='verified') return `${base}${check()}`
 if(pose==='refunded') return `${base}${path('M16 15H8m3-3-3 3 3 3')}`
 if(pose==='simulated') return `${base}${path('M9 14l6 4m0-4-6 4','none',`stroke="${P.ochre}"`)}`
 return `${base}${path('M2 5v9h3m14 0h3V5')}`
}
function ledger(pose) {
 return `${path('M3 10v11h15M6 6v12h15')}${rect(9,2,13,12)}${path('M12 5h7m-7 3h5')}${pose==='closing'?path('M2 2v5m-2-2 2 2 2-2'):path('M11 18l3 3 7-6','none',`stroke="${P.green}"`)}`
}
export async function build({raster=false}={}) {
 const out=resolve(root,'src/assets/cast');mkdirSync(out,{recursive:true})
 const writers=readdirSync(resolve(root,'data/writers')).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(readFileSync(resolve(root,'data/writers',f),'utf8')).publisher)
 const specs=[['scout','Scout',['idle','clarifying','searching','weighing','paying','verifying','caught-a-lie','done','stopped']],['purse','Purse',['full','spending','refunded','locked','empty','simulated']],...writers.map(w=>[w.slug,w.name,['listening','paid','verified',...(w.slug==='alphaleak'?['sneaky','caught','refunding']:[])]]),['receipt','Receipt',['printing','verified','refunded','simulated']],['ledger','Ledger',['closing','closed']]]
 const assets=[]
 for(const [who,name,poses] of specs) for(const pose of poses){
  const body=who==='scout'?scout(pose):who==='purse'?purse(pose):who==='receipt'?receipt(pose):who==='ledger'?ledger(pose):writer(who,pose)
  const label=`${name} · ${pose.replaceAll('-',' ')}${writers.some(w=>w.slug===who)?' · fictional writer':''}`
  const group=`<g stroke="${P.ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g>`
  const iconFile=`${who}-${pose}-small.svg`, file=`${who}-${pose}.svg`
  const icon=`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="-1 -1 26 26" role="img" aria-label="${label}">${group}</svg>\n`
  const status=who==='ledger'?(pose==='closing'?'TESTNET · CLOSING':'TESTNET · CLOSED'):pose.toUpperCase()
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160" role="img" aria-label="${label}"><g transform="translate(24 16) scale(4.6)">${group}</g>${badge(status,pose==='simulated'?P.ochre:P.ink)}</svg>\n`
  for(const [f,s] of [[file,svg],[iconFile,icon]]){if(Buffer.byteLength(s)>=8192)throw new Error(`${f} exceeds 8 KiB`);writeFileSync(resolve(out,f),s)}
  assets.push({who,pose,name,label,file,iconFile})
 }
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify(assets,null,2)+'\n')
 const cards=assets.map(a=>`<figure><img width="160" height="160" alt="${a.label}" src="../../src/assets/cast/${a.file}"><div class="sizes"><img width="24" height="24" alt="${a.label} at 24 px" src="../../src/assets/cast/${a.iconFile}"><img width="16" height="16" alt="${a.label} at 16 px" src="../../src/assets/cast/${a.iconFile}"></div><figcaption>${a.name}<br><code>${a.pose}</code></figcaption></figure>`).join('')
 writeFileSync(resolve(root,'design/cast/sheet.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ResearchAgent · Cast QA</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;padding:32px;background:${P.paper};color:${P.ink};font:14px/1.5 system-ui}h1{font-size:32px;font-weight:600;margin:0;letter-spacing:-1px}p{max-width:80ch;color:#655D55}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:20px}figure{margin:0;border-top:1px solid #C9BFB2;padding:20px 0;text-align:center}img{max-width:100%}.sizes{height:36px;display:flex;gap:16px;justify-content:center;align-items:center}code{font-size:12px;color:${P.deep}}</style><main><h1>The ResearchAgent state system</h1><p>48 states. One 24-unit grid, consistent 1.5-unit strokes. Large illustrations and explicit 24 px / 16 px marks. Scout, Purse, eight fictional writers, Receipt and Ledger.</p><p>QA illustrations only. No live payment evidence. SIMULATED stays labelled; Ledger is Testnet with placeholder state, not a live clock. Locked Purse is future escrow artwork.</p><div class="grid">${cards}</div></main></html>\n`)
 if(raster){
  const {chromium}=await import('playwright');const browser=await chromium.launch()
  try{
   const page=await browser.newPage({viewport:{width:160,height:160},deviceScaleFactor:2,reducedMotion:'reduce'});const dir=resolve(root,'design/cast/png');mkdirSync(dir,{recursive:true})
   for(const a of assets){await page.goto(pathToFileURL(resolve(out,a.file)).href);await page.screenshot({path:resolve(dir,`${a.who}-${a.pose}.png`),omitBackground:true})}
   await page.setViewportSize({width:1440,height:1000});await page.goto(pathToFileURL(resolve(root,'design/cast/sheet.html')).href)
   await page.screenshot({path:resolve(root,'design/cast/cast-sheet.png'),fullPage:true})
   await page.screenshot({path:resolve(root,'design/cast/concept.png')})
  }finally{await browser.close()}
 }
 console.log(`Built ${assets.length} states in large and small SVGs (< 8 KiB each)${raster?', 2× PNGs and QA screenshots':''}.`)
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await build({raster:process.argv.includes('--raster')})
