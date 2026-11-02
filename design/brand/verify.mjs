#!/usr/bin/env node
// Artifact contract: reproducibility, complete icon containers and working page metadata.
import assert from 'node:assert/strict'
import { readFileSync, existsSync, mkdtempSync, rmSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const read=f=>readFileSync(resolve(root,f))
function hashes() {
 const manifest=JSON.parse(read('design/brand/manifest.json'))
 return Object.fromEntries([...Object.keys(manifest),'desktop/build/icon.icns','design/brand/manifest.json'].map(f=>[f,createHash('sha256').update(read(f)).digest('hex')]))
}
const original=hashes()
for(let i=0;i<2;i++) {
 execFileSync(process.execPath,['design/brand/build-brand.mjs'],{cwd:root,stdio:'pipe'})
 assert.deepEqual(hashes(),original,`Build ${i+1} changed committed outputs`)
}
const pngSize=b=>{assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a');return [b.readUInt32BE(16),b.readUInt32BE(20)]}
assert.deepEqual(pngSize(read('design/brand/social-preview.png')),[1280,640])
assert.deepEqual(pngSize(read('desktop/build/icon.png')),[1024,1024])
assert.deepEqual(pngSize(read('public/apple-touch-icon.png')),[180,180])
for(const size of [192,512])assert.deepEqual(pngSize(read(`public/brand/icon-maskable-${size}.png`)),[size,size])
const ico=read('public/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3)
for(let i=0;i<3;i++){const n=6+16*i;const len=ico.readUInt32LE(n+8),start=ico.readUInt32LE(n+12);assert.ok(start+len<=ico.length);assert.deepEqual(pngSize(ico.subarray(start,start+len)),[[16,16],[32,32],[48,48]][i])}
const icns=read('desktop/build/icon.icns');assert.equal(icns.toString('ascii',0,4),'icns');assert.equal(icns.readUInt32BE(4),icns.length)
let pos=8;const chunks=[]
while(pos<icns.length){const length=icns.readUInt32BE(pos+4);assert.ok(length>=8&&pos+length<=icns.length);chunks.push(icns.toString('ascii',pos,pos+4));pos+=length}
assert.equal(pos,icns.length);assert.ok(chunks.includes('ic10'),'ICNS must contain 1024 master')
if(process.platform==='darwin') {
 const temp=mkdtempSync(resolve(tmpdir(),'researchagent-icons-'))
 try{execFileSync('/usr/bin/iconutil',['-c','iconset',resolve(root,'desktop/build/icon.icns'),'-o',resolve(temp,'check.iconset')]);assert.ok(readdirSync(resolve(temp,'check.iconset')).includes('icon_512x512@2x.png'))}finally{rmSync(temp,{recursive:true,force:true})}
}
const manifest=JSON.parse(read('design/brand/manifest.json'))
for(const [f,hash]of Object.entries(manifest))assert.equal(createHash('sha256').update(read(f)).digest('hex'),hash,f)
for(const f of Object.keys(manifest).filter(f=>f.startsWith('site/')&&f.endsWith('.html'))) {
 const html=read(f).toString();assert.equal((html.match(/property="og:image"/g)||[]).length,1,f)
 assert.match(html,/<title>[^<]*ResearchAgent[^<]*<\/title>/i,f)
 for(const match of html.matchAll(/<link[^>]*rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g))assert.ok(existsSync(resolve(root,dirname(f),match[1])),`${f}: ${match[1]}`)
 const og=html.match(/property="og:image" content="[^"]*\/brand\/og\/([^"]+)"/)[1]
 assert.deepEqual(pngSize(read(`site/brand/og/${og}`)),[1200,630])
 assert.match(html,/name="twitter:card" content="summary_large_image"/)
}
const browser=await chromium.launch()
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}})
 await page.goto(pathToFileURL(resolve(root,'design/brand/sheet.html')).href)
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())))
 // Independent crop/blank regression check at both ends of the icon size range.
 for(const [file,size]of [['design/brand/ResearchAgent.iconset/icon_16x16.png',16],['desktop/build/icon.png',1024]]) {
  const url=`data:image/png;base64,${read(file).toString('base64')}`
  const bbox=await page.evaluate(async({url,size})=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=size;c.height=size;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,size,size).data;let x0=size,x1=0,y0=size,y1=0;for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(d[(y*size+x)*4+3]>100){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}return [x1-x0+1,y1-y0+1]},{url,size})
  assert.ok(bbox.every(n=>n>size*.6&&n<size*.95),`${file}: blank or cropped tile (${bbox})`)
 }
 for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`)}
}finally{await browser.close()}
console.log('Brand verification passed: two byte-identical rebuilds (including ICNS), icon sizes/containers, all eight OG pages, loaded images and 320–1440 px reflow.')
