"""Receipt verification CLI: offline by default; --ledger adds read-only Testnet checks."""

import argparse
import json
import sys
from pathlib import Path
from .verify import verify


def main():
    parser = argparse.ArgumentParser(prog="python -m researchagent")
    commands = parser.add_subparsers(dest="command", required=True)
    command = commands.add_parser("verify")
    command.add_argument("receipts", type=Path)
    command.add_argument("--json", action="store_true")
    command.add_argument("--ledger", action="store_true")
    command.add_argument("--testnet", action="store_true")
    command.add_argument("--verbose", action="store_true", help="Print every verification row")
    args = parser.parse_args()
    try:
        bundle = json.loads(args.receipts.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        parser.error("Cannot read receipt JSON")
    result = verify(bundle, ledger=args.ledger, testnet=args.testnet)
    testnet = [c for c in result["checks"] if c["check"].startswith("testnet ")]
    rows = result["checks"]
    if not args.verbose:
        counts = {status: sum(c["status"] == status for c in rows) for status in ("PASS", "FAIL", "SKIP")}
        selected = [c for c in rows if c["status"] == "FAIL" or c["check"] == "audit anchor"]
        rows = [{"status": "PASS" if result["ok"] else "FAIL", "check": "checks", "detail": ", ".join(f"{n} {status}" for status, n in counts.items())}, *selected[:8]]
        if len(selected) > 8:
            rows.append({"status": "FAIL", "check": "details", "detail": "Use --verbose for all failures"})
    print(
        json.dumps(result)
        if args.json
        else "\n".join(
            [
                *(c["status"] + " " + c["check"] + ": " + c["detail"] for c in rows),
                *(
                    [
                        ("PASS" if all(c["status"] != "FAIL" for c in testnet) else "FAIL")
                        + " testnet %d/%d (read-only, s.altnet)" % (sum(c["status"] == "PASS" for c in testnet), len(testnet))
                    ]
                    if testnet
                    else []
                ),
                *(["Identity/origin SKIPs limit attribution; payment and passage checks are separate. PASS does not verify writer identity."] if any(c["status"] == "SKIP" and c["check"] in ("writer credentials", "historical origin") for c in result["checks"]) else []),
                "RESULT " + ("PASS" if result["ok"] else "FAIL"),
            ]
        )
    )
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
