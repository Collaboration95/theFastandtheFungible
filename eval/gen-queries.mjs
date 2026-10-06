// One DeepSeek call per publisher: 2 eval queries per article (a terse search query and a natural question),
// written WITHOUT copying the title, so they test retrieval rather than title matching.
import fs from 'fs'; import path from 'path'; import 'dotenv/config'
const root = 'data/corpus/v2/articles', out = {}
for (const pub of fs.readdirSync(root)) {
  const arts = fs.readdirSync(path.join(root, pub)).map(f => JSON.parse(fs.readFileSync(path.join(root, pub, f))))
  const list = arts.map(a => ({ id: a.articleId, title: a.title, abstract: a.abstract, tags: a.tags, opening: a.body.slice(0, 600) }))
  const res = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({ model: 'deepseek-flash', thinking: { type: 'disabled' }, temperature: 0.3, max_tokens: 4000, response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: 'You write evaluation queries for a search engine. For each article, write {"id","keyword":"a 3-7 word query a researcher would type","question":"a natural one-sentence question this article answers"}. Do NOT copy the title phrase; paraphrase with synonyms where natural. Return JSON {"queries":[...]} covering every id.' },
      { role: 'user', content: JSON.stringify(list) }] }) })
  const j = await res.json(); if (!j.choices) { console.log(JSON.stringify(j).slice(0,300)); process.exit(1) }; const qs = JSON.parse(j.choices[0].message.content).queries
  for (const q of qs) out[q.id] = { publisher: pub, keyword: q.keyword, question: q.question }
  console.log(pub, qs.length)
}
fs.writeFileSync('eval/queries.json', JSON.stringify(out, null, 1))
