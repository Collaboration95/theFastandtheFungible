import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
export function render(r) {
  const samples=r.samples, maxT=Math.max(...samples.map(s=>s.elapsedMs))/1000||1
  const points=(value,y,max)=>samples.map((s,i)=>`${i===0||s.gapMs>2500?'M':'L'}${(80+s.elapsedMs/1000/maxT*960).toFixed(1)},${(y+170-value(s)/max*170).toFixed(1)}`).join(' ')
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="680" viewBox="0 0 1120 680"><rect width="1120" height="680" fill="#fafbfc"/><g font-family="sans-serif" fill="#243348"><text x="50" y="32" font-size="20">Same-engine soak — ${r.options.burst?'REHEARSAL':'BASELINE'} / shared host</text><text x="50" y="57" font-size="13">Fixture models · SIMULATED rail · embeddings / telemetry off · no finals claim</text>`
  for(const [y,title,max,value,color] of [[100,'Process RSS (MiB)',1600,s=>s.rss/1048576,'#2463a5'],[350,'Worker interval p99 loop delay (ms)',Math.max(60,...samples.map(s=>s.worker?.loopP99Ms??0)),s=>s.worker?.loopP99Ms??0,'#aa5822']]) {
    svg+=`<text x="80" y="${y-15}">${title}</text>`
    for(let i=0;i<=4;i++){const yy=y+170-i/4*170;svg+=`<path d="M80 ${yy}H1040" stroke="#dce3eb"/><text x="20" y="${yy+4}" font-size="12">${(max*i/4).toFixed(0)}</text>`}
    svg+=`<path d="${points(value,y,max)}" fill="none" stroke="${color}" stroke-width="1.5"/>`
    for(let i=0;i<=4;i++)svg+=`<text x="${80+i*240}" y="${y+190}" font-size="12">${(maxT*i/4).toFixed(0)}</text>`
    for(const s of samples.filter(s=>s.gapMs>2500))svg+=`<path d="M${80+s.elapsedMs/1000/maxT*960} ${y}v170" stroke="#b42318" stroke-dasharray="4 4"/>`
  }
  const transitions=samples.filter((s,i)=>i===0||s.stage!==samples[i-1].stage)
  svg+=`<text x="450" y="555">Elapsed wall time (seconds, includes startup and restarts)</text><text x="50" y="585" font-size="12">${esc(transitions.map(s=>`${s.stage}: ${(s.elapsedMs/1000).toFixed(0)} s`).join(' · '))}</text><text x="50" y="610" font-size="12">Red dashed marks / broken lines: sample gaps &gt;2.5 s. Host sleep and gaps retained in JSON.</text><text x="50" y="635" font-size="12">${esc(r.options.runs)} measured asks + ${esc(r.options.warmup)} warmups; ${r.restarts.length} separate restart cycles; ${esc(r.source.slice(0,12))}</text><text x="50" y="660" font-size="12">Result: ${r.summary.pass?'PASS':r.summary.valid?'MISS (performance gates)':'INVALID EVIDENCE'} · RSS is sampled host-process usage, not worker-only or lifetime peak.</text></g></svg>`
  return svg
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))writeFileSync(process.argv[3],render(JSON.parse(readFileSync(process.argv[2],'utf8'))))
