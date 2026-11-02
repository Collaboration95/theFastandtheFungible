"""stdlib-only caller. The backend operator configures caps; fixtures are simulated."""
import json
import os
import time
import urllib.request

base = os.environ.get('RA_BACKEND_URL', 'http://127.0.0.1:9388')
headers = {'Content-Type': 'application/json'}
if os.environ.get('RA_API_TOKEN'):
    headers['Authorization'] = 'Bearer ' + os.environ['RA_API_TOKEN']


def request(path, body=None):
    data = None if body is None else json.dumps(body).encode()
    with urllib.request.urlopen(urllib.request.Request(base + path, data, headers), timeout=15) as response:
        return json.load(response)


run = request('/api/mcp/runs', {
    'question': 'How does Kestrel benefit from the TSMC deal (pricing & margins)?',
    'budget_sgd': 1, 'idempotency_key': 'python-quickstart-1', 'clarify': 'never',
})
while run['phase'] not in ('DONE', 'STOPPED', 'FAILED'):
    time.sleep(0.25)
    run = request('/api/mcp/runs/' + run['runId'])
print(run['answers'][-1] if run['answers'] else None)
print([r['xrpl']['txHash'] for r in run['receipts'] if r.get('xrpl')])
print(run['labels'], 'SYNTHETIC · fictional writers and articles')
