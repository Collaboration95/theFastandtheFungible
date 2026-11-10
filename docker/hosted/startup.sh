#!/usr/bin/env bash
# VM metadata startup script; no secrets are sent to stdout/stderr or metadata.
set -euo pipefail
umask 077
exec >/dev/null 2>&1
meta() { curl -fsS -H 'Metadata-Flavor: Google' "http://metadata.google.internal/computeMetadata/v1/$1"; }
project=$(meta project/project-id)
registry=$(meta instance/attributes/ra-registry)
commit=$(meta instance/attributes/ra-commit)
origin=$(meta instance/attributes/ra-origin)
[[ $commit =~ ^[0-9a-f]{40}$ ]]
[[ $origin =~ ^https://[a-zA-Z0-9.-]+$ ]]
# The deploy script waits for this marker; it is written only after every step succeeds.
rm -f /run/researchagent-startup.done
# No broad distro upgrade. Docker's official repository supplies Compose v2.
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod 644 /etc/apt/keyrings/docker.asc
. /etc/os-release
printf 'deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian %s stable\n' "$VERSION_CODENAME" >/etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
DISK=/dev/disk/by-id/google-ra-state
pause_on_disk() {
  local file=/srv/researchagent/control.json tmp
  tmp=$(mktemp /srv/researchagent/.control.XXXXXX)
  sed -e 's/"admissionsPaused":false/"admissionsPaused":true/' -e 's/"spendingPaused":false/"spendingPaused":true/' -e 's/"reasonCode":"[a-z0-9_-]*"/"reasonCode":"deploy"/' "$file" >"$tmp" || true
  if ! grep -q '"admissionsPaused":true' "$tmp" || ! grep -q '"spendingPaused":true' "$tmp"; then
    printf '%s\n' '{"admissionsPaused":true,"spendingPaused":true,"reasonCode":"deploy","expiresAt":"2026-11-19T16:00:00Z"}' >"$tmp"
  fi
  chown 1000:1000 "$tmp"; chmod 600 "$tmp"; sync
  mv "$tmp" "$file"; sync
}
# Format only a genuinely blank disk. Unknown existing filesystems fail closed.
if blkid "$DISK"; then :; else
  status=$?
  [[ $status == 2 ]] || exit 1
  mkfs.ext4 -m 0 "$DISK"
fi
[[ $(blkid -s TYPE -o value "$DISK") == ext4 ]]
install -d -m 0700 /srv/researchagent
mountpoint -q /srv/researchagent || mount -o defaults,nodev,nosuid "$DISK" /srv/researchagent
uuid=$(blkid -s UUID -o value "$DISK")
grep -q "UUID=$uuid " /etc/fstab || printf 'UUID=%s /srv/researchagent ext4 defaults,nodev,nosuid 0 2\n' "$uuid" >>/etc/fstab
# On every subsequent reboot Docker must wait for the persistent filesystem.
install -d -m 0755 /etc/systemd/system/docker.service.d
printf '[Unit]\nRequiresMountsFor=/srv/researchagent\n' >/etc/systemd/system/docker.service.d/researchagent.conf
systemctl daemon-reload
systemctl enable --now docker
install -d -m 0700 -o 1000 -g 1000 /srv/researchagent/api /srv/researchagent/api/reports /srv/researchagent/publisher /srv/researchagent/publisher/data
chown 1000:1000 /srv/researchagent
chmod 700 /srv/researchagent
install -d -m 0700 /etc/researchagent /opt/researchagent
# Files are delivered as a local archive by the deploy script, not downloaded from GitHub.
# Stop before replacing configuration, including secrets.
if [[ -f /opt/researchagent/compose.yaml && -f /etc/researchagent/images && -f /etc/researchagent/env && -f /srv/researchagent/control.json ]]; then
  # Pause via the current image before stopping; recovery continues during drain.
  # If the current image cannot run the control CLI (a broken release), pause the
  # same durable document directly so a fixed release can still replace it.
  docker compose --env-file /etc/researchagent/images -f /opt/researchagent/compose.yaml run --rm --no-deps --entrypoint node api /app/scripts/hosted-control.mjs pause --local --execute --path /state/control.json --reason deploy || pause_on_disk
  docker compose --env-file /etc/researchagent/images -f /opt/researchagent/compose.yaml down --timeout 120
fi
meta instance/attributes/ra-bundle | base64 -d | tar -xz -C /opt/researchagent
cp /opt/researchagent/env.template /etc/researchagent/env.new
sed -i "s|^HOSTED_ORIGIN=.*|HOSTED_ORIGIN=$origin|" /etc/researchagent/env.new
# Operator-qualified runtime values (provider rates, preflight deadline, wallet cap,
# decision provider while a live key is unavailable) live in a private override
# file so a reboot or redeploy keeps them. Only these names are accepted; anything
# else fails the start closed. A fixture decision model is labelled on every answer.
if [[ -f /etc/researchagent/env.local ]]; then
  while IFS='=' read -r name value; do
    [[ -z $name || $name == \#* ]] && continue
    [[ $name =~ ^(HOSTED_PROVIDERS_READY_UNTIL|HOSTED_(RESEARCH|DECISION)_(INPUT|OUTPUT)_USD_PER_MILLION|HOSTED_DECISION_OUTPUT_TOKENS|HOSTED_QUESTION_CAP_MINOR|HOSTED_ADMISSIONS_UNTIL|HOSTED_(DECK|VIDEO|PROGRESS|REPLAY)_URL|WALLET_DAILY_CAP_MINOR|DECISION_PROVIDER)$ && $value =~ ^[A-Za-z0-9.:/_-]+$ ]] || exit 1
    [[ $name != DECISION_PROVIDER || $value =~ ^(openai|cloudflare|fixture)$ ]] || exit 1
    sed -i "/^$name=/d" /etc/researchagent/env.new
    printf '%s=%s\n' "$name" "$value" >>/etc/researchagent/env.new
  done </etc/researchagent/env.local
fi
# Each value is immutable per commit (version 1). Rotation requires a new release id.
while IFS='=' read -r name secret; do
  [[ $name =~ ^[A-Z][A-Z0-9_]+$ && $secret =~ ^[a-z0-9-]+$ ]]
  value=$(gcloud secrets versions access 1 --secret="$secret" --project="$project")
  [[ -n $value && $value != *$'\n'* && $value != *$'\r'* && $value != *"'"* && $value != *'$'* && $value != *'`'* ]]
  printf "%s='%s'\n" "$name" "$value" >>/etc/researchagent/env.new
  unset value
done </opt/researchagent/secrets.map
chmod 600 /etc/researchagent/env.new
mv /etc/researchagent/env.new /etc/researchagent/env
cp /opt/researchagent/images /etc/researchagent/images
chmod 600 /etc/researchagent/images
if [[ ! -e /srv/researchagent/control.json ]]; then
  printf '%s\n' '{"admissionsPaused":true,"spendingPaused":true,"reasonCode":"prelaunch","expiresAt":"2026-11-19T16:00:00Z"}' >/srv/researchagent/control.json
fi
chown 1000:1000 /srv/researchagent/control.json
chmod 600 /srv/researchagent/control.json
gcloud auth configure-docker "${registry%%/*}" --quiet
bash /opt/researchagent/update.sh
printf '%s %s\n' "$commit" "$origin" >/run/researchagent-startup.done
