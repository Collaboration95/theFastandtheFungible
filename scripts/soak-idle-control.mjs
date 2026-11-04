/** Independent idle process; absolute boundaries shared with engine histograms. */
import { monitorEventLoopDelay } from 'node:perf_hooks'
const histogram=monitorEventLoopDelay({resolution:10});histogram.enable()
process.send({ready:true})
process.on('message',message=>{
  if(message.stop) process.exit(0)
  if(!message.epoch)return
  let start=Date.now(),nextBoundary=message.epoch+(Math.floor((Date.now()-message.epoch)/1000)+1)*1000
  const tick=()=>{
    if(Date.now()<nextBoundary){setTimeout(tick,nextBoundary-Date.now());return}
    const end=Date.now(),interval=Math.floor((end-message.epoch)/1000)
    process.send({control:true,interval,start,end,loopP99Ms:histogram.percentile(99)/1e6})
    histogram.reset();start=end;nextBoundary=message.epoch+(interval+1)*1000;setTimeout(tick,Math.max(1,message.epoch+(interval+1)*1000-Date.now()))
  }
  setTimeout(tick,Math.max(1,nextBoundary-Date.now()))
})
process.on('disconnect',()=>process.exit(0))
