"""Same synthetic issued-currency ledger fixture as the TypeScript verifier."""
import json
from pathlib import Path
from researchagent._ledger import verify_transactions


def test_failed_test_sgd_proof_with_valid_full_refund():
    fixture = json.loads((Path(__file__).resolve().parents[3] / 'tests/fixtures/receipt-conformance/test-sgd-refund-ledger.json').read_text())
    checks = []
    verify_transactions(fixture, fixture['entries'], fixture['transactions'].__getitem__, lambda name, ok, detail: checks.append((name, ok, detail)))
    assert checks
    assert all(ok for _, ok, _ in checks), checks
    assert any(name.startswith('testnet key-reveal-proof ') for name, _, _ in checks)
