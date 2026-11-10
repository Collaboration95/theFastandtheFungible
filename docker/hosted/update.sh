#!/usr/bin/env bash
# Called only by the operator/startup service. Never overlap stateful processes.
set -euo pipefail
umask 077
cd /opt/researchagent
exec 9>/run/researchagent-update.lock
flock -n 9 || { echo 'update already running' >&2; exit 1; }
set -a
source /etc/researchagent/images
set +a
export HOSTED_BIND_IP
HOSTED_BIND_IP=$(hostname -I | awk '{print $1}')
export HOSTED_PORT=8080 HOSTED_STATE_PATH=/srv/researchagent
DC=(docker compose --env-file /etc/researchagent/images -f compose.yaml)
# Pull first, while old version is still running. Down MUST finish before up.
"${DC[@]}" pull >/dev/null
"${DC[@]}" down --timeout 120 >/dev/null
"${DC[@]}" up -d --wait --wait-timeout 180 >/dev/null
find /srv/researchagent -type d -exec chmod 700 {} +
find /srv/researchagent -type f -exec chmod 600 {} +
echo 'hosted services started; admissions remain operator-controlled'
