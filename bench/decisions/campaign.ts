import { main } from './run.js'
import { qa } from './qa.js'
const phase=process.argv[process.argv.indexOf('--phase')+1]
await Promise.all([main(),...(phase==='baseline'?[qa()]:[])])
