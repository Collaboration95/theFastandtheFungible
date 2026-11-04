/** CPU samples are statistical self time; a long sample gap is not proof of CPU execution. */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
export function summarize(profile) {
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),self=new Map(),gaps=[]
  for(let i=0;i<profile.samples.length;i++) {
    const frame=nodes.get(profile.samples[i]).callFrame
    const label=JSON.stringify(frame),ms=profile.timeDeltas[i]/1000
    self.set(label,(self.get(label)??0)+ms);gaps.push({frame,ms})
  }
  return {method:'Statistical sampled self time, not CPU counters; native SQLite work is charged to its JS caller. Long sample gaps may include descheduling.',selfTime:[...self].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([frame,ms])=>({frame:JSON.parse(frame),ms})),longestSampleGaps:gaps.sort((a,b)=>b.ms-a.ms).slice(0,20)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)writeFileSync(process.argv[3],JSON.stringify(summarize(JSON.parse(readFileSync(process.argv[2]))),null,2)+'\n')
