import io
import json
from urllib.error import HTTPError
import pytest
from researchagent import Client, ResearchAgentError, InvalidRequestError, BackendError, AskTask

@pytest.mark.parametrize('code', ['cap_zero', 'paused', 'budget_exhausted', 'per_call_cap', 'overloaded', 'deadline', 'settlement_pending', 'unauthorized', 'backend_unavailable'])
def test_safe_envelope(code):
    class Opener:
        def open(self, *args, **kwargs):
            raise HTTPError('https://fixture.invalid', 503, 'private', {}, io.BytesIO(json.dumps({'code': code, 'status': 503, 'retryable': True, 'message': 'PRIVATE', 'runId': 'retained'}).encode()))
    c = Client('https://fixture.invalid')
    c._opener = Opener()
    with pytest.raises(ResearchAgentError) as caught:
        c.wallet_status()
    assert caught.value.code == code
    assert caught.value.run_id == 'retained'
    assert 'PRIVATE' not in str(caught.value)

@pytest.mark.parametrize('url', ['http://remote.invalid', 'https://user:pass@remote.invalid', 'http://127.0.0.1.evil.invalid'])
def test_unsafe_target(url):
    with pytest.raises(InvalidRequestError):
        Client(url, 'synthetic-token')

def test_total_wait_keeps_run_handle(monkeypatch):
    c = Client('http://127.0.0.1', wait_timeout=0.001)
    task = AskTask(c, {'runId': 'retained', 'phase': 'SEARCH', 'events': []}, 0)
    monkeypatch.setattr('researchagent.time.sleep', lambda _: None)
    c._request = lambda *a, **kw: {'runId': 'retained', 'phase': 'SEARCH', 'events': []}
    with pytest.raises(BackendError) as caught:
        list(task.events)
    assert caught.value.code == 'deadline'
    assert caught.value.run_id == 'retained'
