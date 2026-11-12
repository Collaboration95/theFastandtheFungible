import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { reportTopic } from '../../../shared/ledger-report.js'
import { validateWriterCorpus, type Article, type WriterCorpus } from '../../../shared/contracts/writers.js'
const reportRoot=()=>resolve(process.env.LEDGER_REPORT_DIR || 'data/ledger-reports')
export function ledgerCorpus():WriterCorpus {
  const root=reportRoot(), articles=existsSync(root)?readdirSync(root).filter(n=>/^ledger-[a-z0-9-]+\.json$/.test(n)).sort().map(n=>JSON.parse(readFileSync(join(root,n),'utf8')) as Article).filter(a=>reportTopic(a)) : []
  return validateWriterCorpus({publishers:[{slug:'ledger-analytics',name:'ResearchAgent ledger analytics (team-authored)',kind:'independent',domain:'researchagent.local',prices:{standard:40},licence:'Project-authored public-ledger computations; cite the validated ledger.',accent:'#5c5c66',heroQuote:'Team-authored · public ledger computations',bio:'Project team reports computed from public ledger reads. Not an independent writer.',synthetic:false,verification:{status:'unverified'}}],writers:[{slug:'ledger-analytics',publisherSlug:'ledger-analytics',name:'ResearchAgent project team',bio:'Public-ledger analytics; project team',voice:'Computed measurements with explicit scope and signed freshness bounds'}],articles})
}
