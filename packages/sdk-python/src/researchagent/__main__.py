"""Offline receipt verification CLI."""

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
    args = parser.parse_args()
    try:
        bundle = json.loads(args.receipts.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        parser.error("Cannot read receipt JSON")
    result = verify(bundle, ledger=args.ledger)
    print(
        json.dumps(result)
        if args.json
        else "\n".join(
            [
                *(
                    c["status"] + " " + c["check"] + ": " + c["detail"]
                    for c in result["checks"]
                ),
                "RESULT " + ("PASS" if result["ok"] else "FAIL"),
            ]
        )
    )
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
