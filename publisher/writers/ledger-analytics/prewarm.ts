// Read-only startup measurement. Signs reports locally; never submits a transaction.
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { ResourceScope } from '../../../shared/resource-scope.js'
import { LEDGER_REPORT_TOPICS, LEDGER_REPORT_POLICY } from '../../../shared/ledger-report.js'
import { buildRegistry } from '../../registry.js'
import { PublisherJournal } from '../../journal.js'
import { createManifests } from '../../manifest.js'
import { ledgerCorpus } from './catalogue.js'
import { startLedgerAnalytics, type LedgerAnalyticsService } from './background.js'

const scope=new ResourceScope(),oldDirectory=process.env.LEDGER_REPORT_DIR
process.env.LEDGER_REPORT_DIR=scope.tempDir('ledger-prewarm-measurement-')
const journal=new PublisherJournal(':memory:')
let service:LedgerAnalyticsService|undefined
const results:unknown[]=[]
const completed=new Set<string>()
try {
  const entry=(await buildRegistry(ledgerCorpus(),{rail:'xrpl-testnet'})).get('ledger-analytics')!
  const proofs=createManifests(journal)
  service=await startLedgerAnalytics(entry,{onComplete:(topic,report)=>{
    const {article,stamp,computeTimeMs}=report
    results.push({topic,computeTimeMs,stamp,article,manifest:proofs.manifestFor(entry,article,1),salts:proofs.saltsFor(article)})
    completed.add(topic)
    console.log(JSON.stringify({topic,computeTimeMs,ledgerIndex:stamp.ledgerIndex}))
  }})
  await service.prewarmed
  if(completed.size!==LEDGER_REPORT_TOPICS.length) throw Error('Not every enabled topic completed; evidence was not replaced')
  writeFileSync('docs/evidence/content/prewarm-snapshots.json',JSON.stringify({provenance:'Live read-only background prewarm; locally writer-signed; no purchase, model calls or ledger writes.',measuredAt:new Date().toISOString(),policy:LEDGER_REPORT_POLICY,results},null,2)+'\n')
} finally {
  await service?.stop();journal.close();await scope.close()
  if(oldDirectory===undefined) delete process.env.LEDGER_REPORT_DIR
  else process.env.LEDGER_REPORT_DIR=oldDirectory
}
