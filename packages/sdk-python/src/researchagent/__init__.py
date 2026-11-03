"""ResearchAgent: server policy alone authorizes research spending."""
from __future__ import annotations

import json
import math
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, Iterator, TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class ResearchAgentError(Exception):
    def __init__(self, code: str, status: int | None = None):
        self.code, self.status = code, status
        super().__init__(f"ResearchAgent: {code}")


class UnauthorizedError(ResearchAgentError):
    pass


class InvalidRequestError(ResearchAgentError):
    pass


class BackendError(ResearchAgentError):
    pass


class VerificationError(ResearchAgentError):
    pass


class AskResult(TypedDict):
    run_id: str
    phase: str
    answer: dict[str, Any] | None
    citations: list[dict[str, Any]]
    receipts: list[dict[str, Any]]
    labels: dict[str, Any]
    budgetMinor: int
    spentMinor: int
    requestedBudgetMinor: int
    clamped: bool


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _present(run: dict[str, Any]) -> AskResult:
    answer = run['answers'][-1] if run['answers'] else None
    citations = []
    for claim in (answer or {}).get('claims', []):
        for citation in claim['citations']:
            content = next((c for c in run['contents'] if c['resourceId'] == citation['resourceId']
                            and c['version'] == citation['version']
                            and any(s['id'] == citation['spanId'] for s in c['spans'])), None)
            if content is None:
                raise BackendError('backend_unavailable')
            candidate = next((c for c in run['candidates'] if c['resourceId'] == content['resourceId']
                              and c['version'] == content['version'] and c['profileId'] == content['profileId']), None)
            grant = next((g for g in run['grants'] if g['resourceId'] == content['resourceId']
                          and g['version'] == content['version'] and any(i['intentId'] == g['intentId']
                          and i['status'] == 'VERIFIED' for i in run['intents'])), None)
            if candidate is None or (candidate['tier'] != 'FREE' and grant is None):
                raise BackendError('backend_unavailable')
            citations.append({**citation, 'claimId': claim['id'], 'untrusted': True,
                              'writer': content['publisher'], 'grantIntentId': grant['intentId'] if grant else None,
                              'passage': next(s['text'] for s in content['spans'] if s['id'] == citation['spanId'])})
    return AskResult(run_id=run['runId'], phase=run['phase'], answer=answer, citations=citations,
                     receipts=run['receipts'], labels=run['labels'], budgetMinor=run['budgetMinor'],
                     spentMinor=run['spentMinor'], requestedBudgetMinor=run['budgetMinor'], clamped=False)


class AskTask:
    """Lazy synchronous task. Iterate events, then call result(); admission occurs once."""
    def __init__(self, client: Client, run: dict[str, Any], requested: int):
        self._client, self._run, self._requested = client, run, requested
        self._events: list[dict[str, Any]] = []
        self._seen: set[int] = set()

    @property
    def events(self) -> Iterator[dict[str, Any]]:
        cursor = 0
        while True:
            for event in self._run['events']:
                if event['id'] not in self._seen:
                    self._seen.add(event['id'])
                    self._events.append(event)
            while cursor < len(self._events):
                event = self._events[cursor]
                cursor += 1
                yield event
            if self._run['phase'] in ('DONE', 'STOPPED', 'FAILED'):
                return
            time.sleep(0.25)
            self._run = self._client._request('/api/mcp/runs/' + quote(self._run['runId'], safe=''))

    def result(self) -> AskResult:
        for _ in self.events:
            pass
        result = _present(self._run)
        result['requestedBudgetMinor'] = self._requested
        result['clamped'] = result['budgetMinor'] < self._requested
        return result


class Client:
    def __init__(self, base_url: str, token: str | None = None, *, timeout: float = 15):
        url = urlsplit(base_url)
        if url.scheme not in ('http', 'https') or not url.hostname or url.username or url.password or url.query or url.fragment:
            raise InvalidRequestError('invalid')
        self.base_url, self.token, self.timeout = base_url.rstrip('/'), token, timeout
        self._opener = build_opener(_NoRedirect())

    def _request(self, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        try:
            request = Request(self.base_url + path, None if body is None else json.dumps(body, allow_nan=False).encode(), headers)
            with self._opener.open(request, timeout=self.timeout) as response:
                value = json.load(response)
                if not isinstance(value, dict):
                    raise ValueError()
                return value
        except HTTPError as error:
            status = error.code
            error.close()
            cls = UnauthorizedError if status in (401, 403) else InvalidRequestError if 400 <= status < 500 else BackendError
            code = 'unauthorized' if status in (401, 403) else 'not_found' if status == 404 else 'invalid' if status < 500 else 'backend_unavailable'
            raise cls(code, status) from None
        except (URLError, OSError, ValueError):
            raise BackendError('backend_unavailable') from None

    def ask(self, question: str, *, budget: float, idempotency_key: str | None = None) -> AskTask:
        if not isinstance(budget, (int, float)) or not math.isfinite(budget) or budget < 0 or budget > (2**53 - 1) / 100:
            raise InvalidRequestError('invalid')
        run = self._request('/api/mcp/runs', {'question': question, 'budget_sgd': budget,
                            'idempotency_key': idempotency_key, 'clarify': 'never'})
        return AskTask(self, run, math.floor(budget * 100 + 1e-7))

    def get_run(self, run_id: str) -> AskResult:
        return _present(self._request('/api/mcp/runs/' + quote(run_id, safe='')))

    def wallet_status(self) -> dict[str, Any]:
        status = self._request('/api/mcp/status')
        return {**status, 'remainingMinor': max(0, status['dailyMinor'] - status['spentMinor'] - status['reservedMinor'])}

    def verify(self, export: dict[str, Any] | str | Path, *, repo_dir: str | Path) -> dict[str, Any]:
        """Run the repository's offline verifier; requires Node and npm dependencies."""
        try:
            with tempfile.TemporaryDirectory(prefix='researchagent-verify-') as directory:
                path = Path(export).resolve() if isinstance(export, (str, Path)) else Path(directory) / 'export.json'
                if isinstance(export, dict):
                    path.write_text(json.dumps(export), encoding='utf-8')
                process = subprocess.run(['npm', 'run', '--silent', 'verify:answer', '--', str(path), '--json'],
                                         cwd=repo_dir, capture_output=True, text=True, timeout=60, check=False)
                if process.returncode not in (0, 1):
                    raise VerificationError('verification_failed')
                return json.loads(process.stdout)
        except (OSError, ValueError, subprocess.TimeoutExpired):
            raise VerificationError('verification_failed') from None
