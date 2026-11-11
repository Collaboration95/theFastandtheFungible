import { expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import recordingIndex from '../demo/recording-index.json'
it('indexes every committed recording without embedding its body in the entry', () => {
 expect(recordingIndex.map(r=>r.scenario).sort()).toEqual(readdirSync('demo/traces').filter(f=>/^UC.*\.json$/.test(f)).map(f=>f.replace('.json','')).sort())
 for(const entry of recordingIndex){const {run}=JSON.parse(readFileSync(`demo/traces/${entry.scenario}.json`,'utf8'));expect(entry).toEqual({scenario:entry.scenario,runId:run.runId,question:run.question,testnet:run.labels.settlement.includes('TESTNET')})}
 expect(readFileSync('demo/main.ts','utf8')).not.toContain('eager: true')
})
