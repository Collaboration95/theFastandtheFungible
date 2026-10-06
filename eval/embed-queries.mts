import fs from 'fs'; import 'dotenv/config'
import { embedTexts } from '../publisher/search.ts'
const q = JSON.parse(fs.readFileSync('eval/queries.json', 'utf8'))
const texts = [...new Set(Object.values(q).flatMap((x: any) => [x.keyword, x.question]))]
const out: Record<string, number[]> = {}
for (let i = 0; i < texts.length; i += 100) { const v = await embedTexts(texts.slice(i, i + 100)); texts.slice(i, i + 100).forEach((t, j) => out[t] = v[j]) }
fs.writeFileSync('eval/query-vectors.json', JSON.stringify(out)); console.log(Object.keys(out).length)
