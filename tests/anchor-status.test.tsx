// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import AnchorStatus from '../src/components/AnchorStatus'
import ReportButton from '../src/components/ReportButton'
import { Store } from '../server/store.js'
vi.mock('../src/api', () => ({ getRun: vi.fn() }))
afterEach(cleanup)
function abstention() {
 const store = new Store(':memory:')
 const run = store.createRun('orchids',200,{research:'fixture',decision:'fixture',publisher:'local',settlement:'XRPL TESTNET · no real value'})
 store.updateRun(run.runId,{phase:'DONE'})
 const result = store.getRun(run.runId); store.close(); return result
}
it('exports a DONE abstention even without a validated purchased answer', () => {
 render(<ReportButton run={abstention()} onReport={vi.fn()} />)
 expect(screen.getByText('Export ⋯')).toBeTruthy()
 expect(screen.getByText('Download receipts.json')).toBeTruthy()
 expect(screen.getByText('Download report (PDF)').hasAttribute('disabled')).toBe(true)
})
it('labels no purchase, fee and ledger together', () => {
 const run = abstention()
 run.ledgerAnchor = {version:'anchor-v1',network:'xrpl:1',head:'a'.repeat(64),runIdHash:'b'.repeat(64),account:'rAccount',txHash:'c'.repeat(64),ledgerIndex:123,feeDrops:'12'}
 render(<AnchorStatus run={run} />)
 expect(screen.getByText('Anchored on XRPL · no purchase · anchor fee 12 drops (Testnet) · ledger 123')).toBeTruthy()
})
it('keeps a DONE run visibly unavailable after submission failure', () => {
 const run = abstention()
 run.events.push({id:1,runId:run.runId,at:new Date().toISOString(),type:'SNAPSHOT',label:'Anchor unavailable (submission or validation failed)'})
 render(<AnchorStatus run={run} />)
 expect(screen.getByText('Anchor unavailable (submission or validation failed)')).toBeTruthy()
 expect(run.phase).toBe('DONE')
})
