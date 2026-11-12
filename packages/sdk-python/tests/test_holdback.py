"""Real retained Testnet receipts offline; online adversaries use a labelled fake ledger."""
from copy import deepcopy
import json
from pathlib import Path
import pytest
from researchagent.verify import verify

EVIDENCE = Path(__file__).resolve().parents[3] / 'docs/evidence/money'


@pytest.mark.parametrize('number', range(1, 18))
def test_retained_holdback_receipts(number):
    result = verify(EVIDENCE / f'holdback-{number:02}.receipt.json')
    assert result['ok'], [c for c in result['checks'] if c['status'] == 'FAIL']
    assert any(c['check'].startswith('holdback ') and c['status'] == 'PASS' for c in result['checks'])
    assert any(c['check'] == 'holdback transaction authentication' and c['status'] == 'SKIP' for c in result['checks'])


@pytest.mark.parametrize('mutation', ['amount', 'batch', 'terminal', 'coverage'])
def test_holdback_tampering(mutation):
    b = json.loads((EVIDENCE / 'holdback-16.receipt.json').read_text())
    if mutation == 'amount':
        b['intents'][0]['escrow']['holdback']['amountMinor'] += 1
    elif mutation == 'batch':
        b['holdbacks'][0]['batch']['RawTransactions'][1]['RawTransaction']['Destination'] = 'invalid'
    elif mutation == 'terminal':
        b['holdbacks'][0]['terminal']['OfferSequence'] += 1
    else:
        del b['intents'][0]['escrow']['holdback']
    assert not verify(b)['ok']


def test_contributions_report_partial_refund_and_net_spend():
    from researchagent.verify import contributions
    b = json.loads((EVIDENCE / 'holdback-17.receipt.json').read_text())
    b['contributions'] = contributions(b)
    purchase = b['contributions']['purchases'][0]
    assert purchase['refundMinor'] == b['intents'][0]['escrow']['holdback']['amountMinor']
    assert purchase['netMinor'] == purchase['grossMinor'] - purchase['refundMinor']
    assert purchase['refundStatus'] == 'recorded verified holdback refund'
    assert verify(b)['ok']


@pytest.mark.parametrize('fault', [None, 'rollback', 'parent', 'object'])
def test_fake_ledger_requires_both_validated_inners_and_objects(fault):
    b = json.loads((EVIDENCE / 'holdback-16.receipt.json').read_text())
    row, proof = b['payments'][0], b['holdbacks'][0]
    terms, h = row['escrowTerms'], row['holdback']
    created = next(e['data']['ledgerIndex'] for e in b['audit']['entries'] if e.get('kind') == 'ESCROW_CREATE')
    responses = {}

    def record(identity, tx, ledger, meta=None):
        responses[identity] = dict(validated=True, tx_json=deepcopy(tx), ledger_index=ledger, meta=dict(TransactionResult='tesSUCCESS', **(meta or {})))

    record(h['batchHash'], proof['batch'], created)
    for n, identity in enumerate((row['escrowCreateHash'], h['createHash'])):
        raw = proof['batch']['RawTransactions'][n]['RawTransaction']
        fields = {k: raw[k] for k in ('Account', 'Destination', 'Amount', 'Condition', 'CancelAfter')}
        record(identity, raw, created, dict(ParentBatchID=h['batchHash'], AffectedNodes=[dict(CreatedNode=dict(LedgerEntryType='Escrow', NewFields=fields))]))
    key = b['proofs'][0]['keyReveal']['key']
    record(row['txHash'], dict(TransactionType='EscrowFinish', Owner=terms['payer'], OfferSequence=row['escrowCreateSequence'], Condition=terms['condition'], Fulfillment='A0228020' + key), row['ledgerIndex'])
    record(h['finishHash'], proof['terminal'], h['ledgerIndex'])
    if fault == 'rollback':
        responses[h['createHash']]['meta']['TransactionResult'] = 'tecUNFUNDED'
    elif fault == 'parent':
        responses[h['createHash']]['meta']['ParentBatchID'] = '0' * 64
    elif fault == 'object':
        responses[h['createHash']]['meta']['AffectedNodes'][0]['CreatedNode']['NewFields']['Amount'] = '1'
    result = verify(b, testnet=True, ledger_lookup=lambda identity: responses[identity])
    assert result['ok'] == (fault is None), [c for c in result['checks'] if c['status'] == 'FAIL']
