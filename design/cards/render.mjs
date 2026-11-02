#!/usr/bin/env node
// node design/cards/render.mjs --title 'Meet the cast.' --metric '0 → 48 SVG poses' [--pose scout-paying] [--format portrait|landscape|both] [--out design/cards/first-post]
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright'
const root = resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const { values } = parseArgs({ options: { title:{type:'string',default:'The ResearchAgent state system.'}, metric:{type:'string',default:'0 → 48 SVG poses'}, pose:{type:'string',default:'scout-paying'}, format:{type:'string',default:'both'}, out:{type:'string',default:'design/cards/first-post'} } })
const manifest = JSON.parse(readFileSync(resolve(root,'src/assets/cast/manifest.json'),'utf8'))
const asset = manifest.find(a=>`${a.who}-${a.pose}`===values.pose)
if (!asset) throw new Error('Unknown cast pose: choose one from src/assets/cast/manifest.json')
if (!['portrait','landscape','both'].includes(values.format)) throw new Error('--format must be portrait, landscape or both')
const browser = await chromium.launch()
try {
 for (const format of values.format === 'both' ? ['landscape','portrait'] : [values.format]) {
  const [width,height] = format === 'portrait' ? [1080,1350] : [1200,630]
  const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'})
  await page.goto(pathToFileURL(resolve(root,'design/cards/post-card.html')).href)
  await page.evaluate(({title,metric,pose,format})=>{
   document.querySelector('[data-title]').textContent=title
   document.querySelector('[data-metric]').textContent=metric
   const img = document.querySelector('[data-cast]');img.src=`../../src/assets/cast/${pose.file}`;img.alt=pose.label
   if (pose.who === 'purse' && pose.pose === 'locked') document.querySelector('[data-note]').textContent = 'Future escrow illustration · not implemented'
   document.querySelector('.card').classList.toggle('portrait',format==='portrait')
  },{title:values.title,metric:values.metric,pose:asset,format})
  await page.locator('[data-cast]').evaluate(img=>img.decode())
  await page.evaluate(()=>document.fonts.ready)
  // Fail instead of silently cropping an overlong headline or metric.
  const fits = await page.evaluate(()=>Array.from(document.querySelectorAll('.card,header,section,footer')).every(e=>e.scrollWidth<=e.clientWidth && e.scrollHeight<=e.clientHeight))
  if (!fits) throw new Error('Card text overflows: shorten --title or --metric')
  const out=resolve(root,`${values.out}-${format}.png`);mkdirSync(dirname(out),{recursive:true})
  await page.screenshot({path:out});console.log(out)
  await page.close()
 }
} finally { await browser.close() }
