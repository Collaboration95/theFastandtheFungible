/** Regenerate declarative conformance mutations and Python wire schemas; no network. */
import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { deriveAddress } from 'ripple-keypairs'
import { signManifest } from '../shared/manifest.js'
import { entryHash, canonical, GENESIS_HASH } from '../server/audit.js'
import { ReceiptBundleSchema } from '../shared/contracts/receipts.js'
import { ReportSchema } from '../shared/contracts/report.js'
type Mutation = { path: (string | number)[]; value: unknown }
type Case = { name: string; fixture: string; expected: boolean; mutations: Mutation[] }
const cases: Case[] = []
// A public test scalar, never a production key or seed. Only the signed public fixture is saved.
const secp = JSON.parse(readFileSync('docs/evidence/round2-f/receipt-v1.json','utf8'))
secp.sources=secp.sources.slice(0,1); secp.proofs=secp.proofs.slice(0,1)
secp.candidates=secp.candidates.filter((c: {resourceId:string;version:string})=>c.resourceId===secp.sources[0].resourceId && c.version===secp.sources[0].version)
const pubKey='0279BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'
const manifest=signManifest({...secp.proofs[0].manifest,pubKey,wallet:deriveAddress(pubKey)},'00'+'0'.repeat(63)+'1')
secp.proofs[0].manifest=manifest; secp.sources[0].verification.manifest=manifest
secp.candidates[0].wallet=manifest.wallet
secp.intents=[]; secp.grants=[]; secp.receipts=[]; secp.payments=[]
secp.answers=secp.answers.slice(0,1); secp.answers[0].claims=[]
const entry={seq:1,at:'2026-11-04T00:00:00.000Z',prevHash:GENESIS_HASH,runId:secp.runId,intentId:null,surface:'sdk',principal:'fixture',kind:'fixture',data:{label:'SIMULATED offline secp256k1 fixture'}}
const hash=entryHash(entry.seq,entry.at,entry.prevHash,entry.runId,entry.intentId,entry.surface,entry.principal,entry.kind,canonical(entry.data))
secp.audit={anchor:{seq:0,hash:GENESIS_HASH},entries:[{...entry,hash}],head:hash}
writeFileSync('tests/fixtures/receipt-conformance/secp256k1.json',JSON.stringify(secp,null,2)+'\n')
cases.push({name:'secp256k1/golden',fixture:'tests/fixtures/receipt-conformance/secp256k1.json',expected:true,mutations:[]})
cases.push({name:'secp256k1/signature',fixture:'tests/fixtures/receipt-conformance/secp256k1.json',expected:false,mutations:[{path:['proofs',0,'manifest','sig'],value:'00'.repeat(64)}]})
const fixtures = ['verify-278/receipts.json', 'round2-f/receipt-v1.json', 'round2-f/receipt-v2.json', 'round2-g/useful.receipts.json', 'round2-g/redundant.receipts.json', 'round2-g/refunded.receipts.json', 'rlusd-uc2-receipts.json', 'rlusd-uc3-receipts.json']
for (const fixture of fixtures) {
  const b = JSON.parse(readFileSync(`docs/evidence/${fixture}`, 'utf8'))
  const add = (name: string, path: (string|number)[], value: unknown) => cases.push({ name: `${fixture}/${name}`, fixture: `docs/evidence/${fixture}`, expected: false, mutations: [{ path, value }] })
  cases.push({ name: `${fixture}/golden`, fixture: `docs/evidence/${fixture}`, expected: true, mutations: [] })
  add('version', ['schemaVersion'], 99)
  add('key', ['proofs',0,'manifest','pubKey'], '02'+'00'.repeat(32))
  add('signature', ['proofs',0,'manifest','sig'], '00'.repeat(64))
  add('manifest', ['proofs',0,'manifest','root'], 'f'.repeat(64))
  add('span', ['sources',0,'spans',0,'text'], 'tampered passage')
  if (b.proofs[0].manifest.claims.length) add('claim', ['proofs',0,'manifest','claims',0,'leaf'], 'f'.repeat(64))
  if (b.schemaVersion!==3) add('retention-extension', ['contributions'], {version:'structural-v1',semanticStatus:'not independently verified',purchases:[]})
  add('salt', ['proofs',0,'salts',0], 'tampered salt')
  add('citation', ['answers',0,'claims',0,'citations',0,'spanId'], 'missing-span')
  add('audit-link', ['audit','entries',0,'prevHash'], 'f'.repeat(64))
  add('audit-hash', ['audit','entries',0,'hash'], 'f'.repeat(64))
  add('audit-head', ['audit','head'], 'f'.repeat(64))
  add('amount', ['receipts',0,'amountMinor'], 999)
  if (b.grants.length) add('grant', ['grants',0,'contentDigest'], 'f'.repeat(64))
  add('origin', ['sources',0,'source'], { schemaVersion:1,origin:'https://tampered.invalid',sellerKey:b.proofs[0].manifest.pubKey,profileId:b.sources[0].profileId,resourceId:b.sources[0].resourceId,version:b.sources[0].version })
  add('missing-field', ['answers',0,'provider'], null)
  add('duplicate-proof', ['proofs'], [...b.proofs,b.proofs[0]])
  if (b.schemaVersion===3) {
    const purchaseIndex=b.contributions.purchases.findIndex((p: {links: unknown[]}) => p.links.length>0)
    for (const field of ['claim','answerVersion','retained','citation','grantIntentId','passage','spanId','manifestRoot','claimId']) {
      const link=b.contributions.purchases[purchaseIndex].links[0]
      add(field==='claim'?'claim':field==='retained'?'retention':`contribution-${field}`, ['contributions','purchases',purchaseIndex,'links',0,field], typeof link[field]==='boolean'?!link[field]:typeof link[field]==='number'?999:'tampered')
    }
    add('downgrade', ['schemaVersion'], 2)
  }
}
for (const fixture of ['verify-278/tampered.json','verify-278/before.json']) cases.push({name:fixture,fixture:`docs/evidence/${fixture}`,expected:false,mutations:[]})
cases.push({name:'verify-278/report-golden',fixture:'docs/evidence/verify-278/report.json',expected:true,mutations:[]})
cases.push({name:'verify-278/report-source',fixture:'docs/evidence/verify-278/report.json',expected:false,mutations:[{path:['report','sources',0,'body'],value:'tampered report body'}]})
cases.push({name:'verify-278/report-citation',fixture:'docs/evidence/verify-278/report.json',expected:false,mutations:[{path:['report','findings',0,'citations',0,'spanId'],value:'missing-span'}]})
writeFileSync('tests/fixtures/receipt-conformance/manifest.json', JSON.stringify({version:1,cases},null,2)+'\n')
for (const [name,schema] of Object.entries({bundle:ReceiptBundleSchema,report:ReportSchema})) writeFileSync(`packages/sdk-python/src/researchagent/${name}-schema.json`,JSON.stringify(z.toJSONSchema(schema,{io:'input'}),null,2)+'\n')
