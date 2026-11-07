// Conservative source scan: every runtime string literal and JSX text is a potential
// public label. JSON contributes public metadata/label fields, never paid bodies.
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { ABSTRACT_LEAK_WORDS, type Article } from '../shared/contracts/writers.js'
export type PublicLabel = { file: string; line: number; text: string }
const tokens = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) ?? []
const grams = (text: string) => { const words=tokens(text); return words.slice(0,Math.max(0,words.length-ABSTRACT_LEAK_WORDS+1)).map((_,i)=>words.slice(i,i+ABSTRACT_LEAK_WORDS).join(' ')) }
export function publicLabelStrings(root = process.cwd()): PublicLabel[] {
 const labels: PublicLabel[]=[]
 const walk = (dir: string) => {
  for(const entry of readdirSync(join(root,dir),{withFileTypes:true})) {
   const file=join(dir,entry.name)
   if(entry.isDirectory()) { if(!['traces','assets','character'].includes(entry.name)) walk(file); continue }
   if(/\.(?:ts|tsx|js|mjs)$/.test(file)) {
    const source=ts.createSourceFile(file,readFileSync(join(root,file),'utf8'),ts.ScriptTarget.Latest,true)
    const visit=(node: ts.Node) => {
     if(ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      const text=node.text
      if(tokens(text).length>=ABSTRACT_LEAK_WORDS) labels.push({file:relative(root,join(root,file)),line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,text})
     }
     ts.forEachChild(node,visit)
    }
    visit(source)
   } else if(file.endsWith('.html')) {
    const html=readFileSync(join(root,file),'utf8').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
    for(const match of html.matchAll(/>([^<>]+)</g)) if(tokens(match[1]).length>=ABSTRACT_LEAK_WORDS) labels.push({file,line:html.slice(0,match.index).split('\n').length,text:match[1]})
   } else if(file.endsWith('.json')) {
    const visit=(value: unknown, key='') => {
     if(typeof value==='string' && /^(?:label|labels|startupLabels|corpusLabel|credentialNotice|amountLabel|priceMapping|hint|instructions|description|error|bio|heroQuote|voice|title|abstract|preview|licence|disclosure|notice|reason|settlement|research|decision)$/.test(key) && tokens(value).length>=ABSTRACT_LEAK_WORDS) labels.push({file,line:1,text:value})
     else if(Array.isArray(value)) value.forEach(v=>visit(v,key))
     else if(value && typeof value==='object') for(const [k,v] of Object.entries(value)) visit(v,k)
    }
    visit(JSON.parse(readFileSync(join(root,file),'utf8')))
   }
  }
 }
 for(const dir of ['shared','src','server','publisher','mcp','sdk','demo','scripts','site','data/writers']) walk(dir)
 return labels
}
export function paidLabelOverlaps(articles: Article[], labels: PublicLabel[]) {
 const index=new Map<string,PublicLabel>()
 for(const label of labels) for(const gram of grams(label.text)) if(!index.has(gram)) index.set(gram,label)
 return articles.filter(a=>['team-builder-notes','team-xrpl-explainers'].includes(a.publisherSlug) && a.tier==='PAID').flatMap(article=>[...new Set(grams(article.body))].flatMap(gram=>index.has(gram) ? [{articleId:article.articleId,words:gram,...index.get(gram)!}] : []))
}
