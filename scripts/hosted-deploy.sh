#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
exec node docker/hosted/ops.mjs deploy "$@"
