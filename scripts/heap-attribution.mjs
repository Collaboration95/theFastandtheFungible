/** Offline strong-edge dominators for V8 snapshots. Snapshots stay in ignored scratch. */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
export function attribute(snapshot) {
  const { nodes:n, edges:e, strings:s, snapshot:{meta:m} }=snapshot
  const nf=m.node_fields.length, ef=m.edge_fields.length, count=n.length/nf
  const ni=Object.fromEntries(m.node_fields.map((k,i)=>[k,i])), ei=Object.fromEntries(m.edge_fields.map((k,i)=>[k,i]))
  const weak=m.edge_types[ei.type].indexOf('weak'), offsets=new Uint32Array(count+1), incoming=new Uint32Array(count+1)
  for(let u=0;u<count;u++){offsets[u+1]=offsets[u]+n[u*nf+ni.edge_count]*ef;for(let j=offsets[u];j<offsets[u+1];j+=ef)if(e[j+ei.type]!==weak)incoming[e[j+ei.to_node]/nf+1]++}
  for(let i=1;i<=count;i++)incoming[i]+=incoming[i-1]
  const pred=new Uint32Array(incoming[count]), cursor=incoming.slice()
  for(let u=0;u<count;u++)for(let j=offsets[u];j<offsets[u+1];j+=ef)if(e[j+ei.type]!==weak){const v=e[j+ei.to_node]/nf;pred[cursor[v]++]=u}
  const seen=new Uint8Array(count), stack=[0], positions=[offsets[0]], post=[];seen[0]=1
  while(stack.length){const k=stack.length-1,u=stack[k];let j=positions[k];if(j===offsets[u+1]){post.push(u);stack.pop();positions.pop();continue}positions[k]+=ef;if(e[j+ei.type]===weak)continue;const v=e[j+ei.to_node]/nf;if(!seen[v]){seen[v]=1;stack.push(v);positions.push(offsets[v])}}
  const rpo=post.reverse(), rank=new Int32Array(count).fill(-1), idom=new Int32Array(count).fill(-1);rpo.forEach((u,i)=>{rank[u]=i});idom[0]=0
  const intersect=(a,b)=>{while(a!==b){while(rank[a]>rank[b])a=idom[a];while(rank[b]>rank[a])b=idom[b]}return a}
  let changed=true
  while(changed){changed=false;for(let i=1;i<rpo.length;i++){const u=rpo[i];let d=-1;for(let j=incoming[u];j<incoming[u+1];j++){const p=pred[j];if(idom[p]!==-1)d=d===-1?p:intersect(d,p)}if(idom[u]!==d){idom[u]=d;changed=true}}}
  const retained=new Float64Array(count);for(let u=0;u<count;u++)retained[u]=n[u*nf+ni.self_size]
  for(let i=rpo.length-1;i>0;i--){const u=rpo[i];retained[idom[u]]+=retained[u]}
  const describe=u=>({id:n[u*nf+ni.id],type:m.node_types[ni.type][n[u*nf+ni.type]],name:s[n[u*nf+ni.name]].slice(0,160),selfMiB:n[u*nf+ni.self_size]/1048576,retainedMiB:retained[u]/1048576})
  const top=Array.from({length:count},(_,i)=>i).filter(u=>seen[u]&&u!==0).sort((a,b)=>retained[b]-retained[a]).slice(0,35).map(describe)
  const byType={};for(let u=0;u<count;u++){const t=m.node_types[ni.type][n[u*nf+ni.type]];byType[t]=(byType[t]||0)+n[u*nf+ni.self_size]/1048576}
  return {method:'Immediate dominators of reachable graph excluding weak edges; retained sizes overlap for ancestor/descendant entries. V8 internal/ephemeron edges are used as represented, not a native allocation census.',nodes:count,reachable:rpo.length,totalSelfMiB:retained[0]/1048576,byTypeMiB:byType,topDominators:top}
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url)writeFileSync(process.argv[3],JSON.stringify(attribute(JSON.parse(readFileSync(process.argv[2],'utf8'))),null,2)+'\n')
