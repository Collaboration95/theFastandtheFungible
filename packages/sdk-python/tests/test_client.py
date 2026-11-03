import json
import os
from pathlib import Path
import subprocess

import pytest
from researchagent import Client, UnauthorizedError

ROOT = Path(__file__).resolve().parents[3]
QUESTION = 'How does Kestrel benefit from the TSMC deal (pricing & margins)?'


@pytest.fixture(scope='module')
def client(tmp_path_factory):
    process = subprocess.Popen(['node', '--import', 'tsx', 'packages/sdk-python/tests/engine.ts',
                                str(tmp_path_factory.mktemp('engine'))], cwd=ROOT,
                               env={**os.environ, 'MCP_MAX_BUDGET_MINOR': '200', 'MCP_DAILY_CAP_MINOR': '1000'},
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    try:
        connection = json.loads(process.stdout.readline())
        yield Client(connection['url'], connection['token'])
    finally:
        process.communicate('close\n', timeout=20)


def test_ask(client):
    task = client.ask(QUESTION, budget=2, idempotency_key='python-test')
    events = list(task.events)
    assert any(e['type'] == 'FREE_DRAFT' for e in events)
    assert any(e['type'] == 'ANSWER_READY' for e in events)
    result = task.result()
    assert result['phase'] == 'DONE'
    assert result['answer'] and result['citations'] and result['receipts']
    assert client.get_run(result['run_id'])['answer'] == result['answer']


def test_idempotency(client):
    first = client.ask(QUESTION, budget=2, idempotency_key='python-test').result()
    again = client.ask(QUESTION, budget=2, idempotency_key='python-test').result()
    assert first['run_id'] == again['run_id']
    assert first['receipts'] == again['receipts']
    assert len(first['receipts']) == 1


def test_clamp(client):
    result = client.ask(QUESTION, budget=99, idempotency_key='clamp').result()
    assert result['clamped'] and result['budgetMinor'] == 200
    assert result['requestedBudgetMinor'] == 9900
    assert client.wallet_status()['remainingMinor'] >= 0


def test_bad_token(client):
    with pytest.raises(UnauthorizedError) as error:
        Client(client.base_url, 'bad-token').ask(QUESTION, budget=1)
    assert error.value.status == 401


def test_verify(client):
    result = client.ask(QUESTION, budget=2, idempotency_key='python-test').result()
    export = client._request('/runs/' + result['run_id'] + '/receipts.json')
    assert client.verify(export, repo_dir=ROOT)['ok']
    export['sources'][0]['spans'][0]['text'] += 'TAMPER'
    assert not client.verify(export, repo_dir=ROOT)['ok']


def test_z_pause_blocks_purchase(client):
    assert client.pause(reason='Python kill switch') == {'paused': True, 'scope': 'wallet'}
    assert client.pause()['paused']
    result = client.ask(QUESTION, budget=2, idempotency_key='after-pause').result()
    assert result['budgetMinor'] == 0
    assert result['receipts'] == []
    assert result['clampReason'] == 'paused'
