#!/usr/bin/env node
// Prose and visible UI names, not npm slugs, URLs, identifiers or verbatim run history.
import { readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const excluded=new Set(['.git','node_modules','dist','coverage','test-results','.playwright','playwright-report'])
const failures=[]
function walk(dir) {
 for(const ent of readdirSync(dir,{withFileTypes:true})) {
  if(excluded.has(ent.name)||ent.isSymbolicLink())continue
  const file=resolve(dir,ent.name),name=relative(root,file)
  if(ent.isDirectory()){walk(file);continue}
  if(!/\.(md|html|tsx)$/.test(ent.name))continue
  let body=readFileSync(file,'utf8')
  // Historical PR titles, prompts, code examples and URL paths must keep provenance.
  body=body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,s=>s.replace(/[^\n]/g,' '))
  body=body.replace(/```[\s\S]*?```|`[^`\n]+`|https?:\/\/[^\s<>"')]+/g,s=>s.replace(/[^\n]/g,' '))
  body.split('\n').forEach((line,i)=>{if(/\bresearch[ -]agents?\b|\bRA(?=\s)/i.test(line))failures.push(`${name}:${i+1}: ${line.trim().slice(0,180)}`)})
 }
}
walk(root)
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'))
if(pkg.productName!=='ResearchAgent')failures.push('package.json: productName must be ResearchAgent')
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}else console.log('Naming audit: 0 inconsistent product names. ResearchAgent is canonical; URLs, npm slugs and verbatim history preserved.')
