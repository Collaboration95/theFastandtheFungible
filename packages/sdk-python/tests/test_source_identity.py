import json
from pathlib import Path
from researchagent import _present


def test_collided_origin_citations_keep_their_own_grants():
    root = Path(__file__).resolve().parents[3]
    bundle = json.loads((root / 'docs/evidence/round2-f/receipt-v2.json').read_text())
    run = dict(bundle, runId=bundle['runId'], phase='DONE', contents=bundle['sources'],
               labels={'settlement': bundle['label']}, budgetMinor=200, spentMinor=100)
    result = _present(run)
    citations = [c for c in result['citations'] if c.get('source', {}).get('profileId') == 'collision']
    assert len(citations) == 2
    assert len({c['source']['origin'] for c in citations}) == 2
    assert len({c['grantIntentId'] for c in citations}) == 2
    for citation in citations:
        intent = next(i for i in run['intents'] if i['intentId'] == citation['grantIntentId'])
        assert intent['source'] == citation['source']
