"""Identical declarative cases, with network/process access denied during verification."""

import copy
import json
import socket
import subprocess
from pathlib import Path
import pytest
from researchagent.verify import verify, canonical, signed

ROOT = Path(__file__).resolve().parents[3]
CASES = json.loads(
    (ROOT / "tests/fixtures/receipt-conformance/manifest.json").read_text()
)["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_conformance(case, monkeypatch):
    b = json.loads((ROOT / case["fixture"]).read_text())
    for m in case["mutations"]:
        target = b
        for p in m["path"][:-1]:
            target = target[p]
        target[m["path"][-1]] = copy.deepcopy(m["value"])

    def forbidden(*args, **kwargs):
        raise AssertionError("Network/process access during verification")

    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)
    monkeypatch.setattr(socket, "getaddrinfo", forbidden)
    monkeypatch.setattr(subprocess, "Popen", forbidden)
    if "ledgerTransactions" in case:
        responses = json.loads((ROOT / case["ledgerTransactions"]).read_text())
        for m in case["ledgerMutations"]:
            target = responses
            for p in m["path"][:-1]:
                target = target[p]
            target[m["path"][-1]] = m["value"]
        assert verify(b, ledger=True, testnet=True, ledger_lookup=lambda h: responses[h])["ok"] is case["expected"]
        return
    assert verify(b, ledger="ledgerResponse" in case, ledger_lookup=lambda _: case["ledgerResponse"])["ok"] is case["expected"]


def test_canonical():
    from researchagent.verify import schema

    for invalid in ("http:", "http://", "https://bad host/"):
        with pytest.raises(ValueError):
            schema(invalid, {"type": "string", "format": "uri"})
    for invalid in (" leading", "two--words", "trailing "):
        with pytest.raises(ValueError):
            schema(invalid, {"type": "string", "pattern": r"^[\p{L}]+(?:[ -][\p{L}]+){0,5}$"})
    with pytest.raises(ValueError):
        schema("𐐀" * 25, {"type": "string", "maxLength": 48})
    assert canonical(1000000000000000100) == "1000000000000000100"
    assert canonical("\ud800") == '"\\ud800"'
    assert canonical(10**21) == "1e+21"
    assert canonical(9007199254740993) == "9007199254740992"
    assert (
        canonical({"z": 1.0, "a": ["é", 1e-7, 1e-6, 1e21]})
        == '{"a":["é",1e-7,0.000001,1e+21],"z":1}'
    )


def test_expect_head():
    b = json.loads((ROOT / "docs/evidence/round2-f/receipt-v1.json").read_text())
    assert verify(b, expect_head=b["audit"]["head"])["ok"]
    assert not verify(b, expect_head="f" * 64)["ok"]


def test_secp_signature():
    # Independently exercise vendored DER verification with a fixed local key, never a wallet seed.
    from researchagent._vendor.ecdsa import SigningKey, SECP256k1
    from researchagent._vendor.ecdsa.util import sigencode_der_canonize
    import hashlib

    m = json.loads((ROOT / "docs/evidence/round2-f/receipt-v1.json").read_text())[
        "proofs"
    ][0]["manifest"]
    sk = SigningKey.from_secret_exponent(1, curve=SECP256k1)
    m["pubKey"] = sk.verifying_key.to_string("compressed").hex().upper()
    # Known XRPL account for secp256k1 public key G.
    m["wallet"] = "rBgGZ9tc4him9KBzD8fKFiQz3fSZpaSwMH"
    message = (
        (
            "researchagent-manifest-v2:"
            if m.get("schemaVersion") == 2
            else "researchagent-manifest-v1:"
        )
        + canonical({k: v for k, v in m.items() if k != "sig"})
    ).encode()
    m["sig"] = sk.sign_digest_deterministic(
        hashlib.sha512(message).digest()[:32],
        hashfunc=hashlib.sha256,
        sigencode=sigencode_der_canonize,
    ).hex()
    assert signed(m)
    m["wordCount"] += 1
    assert not signed(m)


def test_rfc8032_vector():
    from researchagent._vendor.ecdsa import VerifyingKey, Ed25519, BadSignatureError

    vk = VerifyingKey.from_string(
        bytes.fromhex(
            "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a"
        ),
        curve=Ed25519,
    )
    sig = bytes.fromhex(
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"
    )
    assert vk.verify(sig, b"")
    with pytest.raises(BadSignatureError):
        vk.verify(sig, b"tampered")


@pytest.mark.parametrize(
    "arguments,code",
    [
        ([], 2),
        (["verify"], 2),
        (["verify", "missing-file"], 2),
        (["verify", "docs/evidence/verify-278/receipts.json", "--json"], 0),
        (["verify", "docs/evidence/verify-278/tampered.json", "--json"], 1),
    ],
)
def test_cli(arguments, code):
    import os
    import sys

    result = subprocess.run(
        [sys.executable, "-m", "researchagent", *arguments],
        cwd=ROOT,
        env={**os.environ, "PYTHONPATH": str(ROOT / "packages/sdk-python/src")},
        capture_output=True,
        text=True,
    )
    assert result.returncode == code
    if code != 2:
        assert json.loads(result.stdout)["ok"] is (code == 0)


def test_ledger_skips_simulated_export_but_testnet_does_not():
    b = json.loads((ROOT / "docs/evidence/round2-g/redundant.receipts.json").read_text())

    def unreachable(_):
        raise AssertionError("A simulated export must not touch the ledger")

    result = verify(b, ledger=True, ledger_lookup=unreachable)
    assert result["ok"]
    assert {c["check"]: c["status"] for c in result["checks"]}["audit anchor"] == "SKIP"
    assert not verify(b, testnet=True, ledger_lookup=unreachable)["ok"]


def test_cli_ledger_prints_testnet_line_and_skips_simulated():
    import os
    import sys

    result = subprocess.run(
        [sys.executable, "-m", "researchagent", "verify", "docs/evidence/round2-g/redundant.receipts.json", "--ledger"],
        cwd=ROOT,
        env={**os.environ, "PYTHONPATH": str(ROOT / "packages/sdk-python/src")},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert "Skipped audit anchor: simulated run (no ledger)" in result.stdout
    assert "\nSKIP " not in result.stdout


def test_cli_compact_and_verbose():
    import os
    import sys
    import researchagent

    assert researchagent.__version__
    command = [sys.executable, "-m", "researchagent", "verify", "docs/evidence/round2-g/redundant.receipts.json", "--ledger"]
    env = {**os.environ, "PYTHONPATH": str(ROOT / "packages/sdk-python/src")}
    compact = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True)
    verbose = subprocess.run([*command, "--verbose"], cwd=ROOT, env=env, capture_output=True, text=True)
    assert compact.returncode == verbose.returncode == 0
    assert len(compact.stdout.splitlines()) <= 12
    assert compact.stdout.rstrip().endswith("RESULT PASS")
    assert verbose.stdout.rstrip().endswith("RESULT PASS")
    assert len(verbose.stdout.splitlines()) > len(compact.stdout.splitlines())
