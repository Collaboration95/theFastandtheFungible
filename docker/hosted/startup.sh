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
systemctl enable --now docker
DISK=/dev/disk/by-id/google-ra-state
# Format only a genuinely blank disk. Unknown existing filesystems fail closed.
if ! blkid "$DISK"; then mkfs.ext4 -m 0 "$DISK"; fi
[[ $(blkid -s TYPE -o value "$DISK") == ext4 ]]
install -d -m 0700 /srv/researchagent
mountpoint -q /srv/researchagent || mount -o defaults,nodev,nosuid "$DISK" /srv/researchagent
uuid=$(blkid -s UUID -o value "$DISK")
grep -q "UUID=$uuid " /etc/fstab || printf 'UUID=%s /srv/researchagent ext4 defaults,nodev,nosuid 0 2\n' "$uuid" >>/etc/fstab
install -d -m 0700 -o 1000 -g 1000 /srv/researchagent/api /srv/researchagent/api/reports /srv/researchagent/publisher /srv/researchagent/publisher/data
chown 1000:1000 /srv/researchagent
chmod 700 /srv/researchagent
install -d -m 0700 /etc/researchagent /opt/researchagent
# Files are delivered as a local archive by the deploy script, not downloaded from GitHub.
# Stop before replacing configuration, including secrets.
if [[ -f /opt/researchagent/compose.yaml ]]; then docker compose --env-file /etc/researchagent/images -f /opt/researchagent/compose.yaml down --timeout 120; fi
meta instance/attributes/ra-bundle | base64 -d | tar -xz -C /opt/researchagent
cp /opt/researchagent/env.template /etc/researchagent/env.new
sed -i "s|^HOSTED_ORIGIN=.*|HOSTED_ORIGIN=$origin|" /etc/researchagent/env.new
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
