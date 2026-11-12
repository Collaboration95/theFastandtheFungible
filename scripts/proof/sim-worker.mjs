import { parentPort, workerData } from 'node:worker_threads'
const { schedules } = await import('./simulation.ts')
try { parentPort.postMessage({result:await schedules(workerData.runs,workerData.seed,n => parentPort.postMessage({progress:n}))}) }
catch(error) { parentPort.postMessage({error:String(error)}); process.exitCode=1 }
