#!/usr/bin/env bash
# Prepare only. This script never invokes Docker, gcloud or any cloud API.
set +x
set -euo pipefail
fail() { printf '%s\n' "$1" >&2; exit 2; }
mode=${1:---dry-run}
[[ $# -le 1 && ( "$mode" == --dry-run || "$mode" == --deploy ) ]] || fail 'Usage: scripts/deploy-publisher.sh [--dry-run|--deploy]'
[[ ${PROJECT_ID:-} =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || fail 'Invalid PROJECT_ID.'
[[ ${REGION:-} =~ ^[a-z]+-[a-z]+[0-9]+$ ]] || fail 'Invalid REGION.'
[[ ${SERVICE:-} =~ ^[a-z][a-z0-9-]{0,47}[a-z0-9]$ ]] || fail 'Invalid SERVICE (2–49 characters).'
[[ ${IMAGE_VERSION:-} =~ ^[0-9a-f]{40}$ ]] || fail 'IMAGE_VERSION must be the full source commit SHA.'
[[ ${IMAGE:-} =~ ^${REGION}-docker\.pkg\.dev/${PROJECT_ID}/[a-z0-9][a-z0-9_-]*/[a-z0-9][a-z0-9/_-]*$ ]] || fail 'IMAGE must be an untagged Artifact Registry image in PROJECT_ID/REGION; repository must already exist.'
[[ ${PUBLISHER_SECRET_RESOURCE:-} =~ ^projects/[0-9]+/secrets/[A-Za-z0-9_-]+$ ]] || fail 'Supply an existing PUBLISHER_SECRET_RESOURCE reference, never a literal key.'
[[ ${PUBLISHER_SECRET_VERSION:-} =~ ^[1-9][0-9]*$ ]] || fail 'PUBLISHER_SECRET_VERSION must be a pinned numeric version.'
[[ ${MAX_INSTANCES:-1} == 1 ]] || fail 'MAX_INSTANCES must be 1.'
[[ ${PUBLISHER_FAULTS:-0} == 0 ]] || fail 'Fault flags are prohibited.'
[[ -z ${PUBLISHER_SECRET:-} ]] || fail 'Unset literal PUBLISHER_SECRET; this script accepts only a Secret Manager resource reference.'
[[ ${JOURNAL_MOUNT:-} =~ ^/mnt/[a-zA-Z0-9_-]+$ ]] || fail 'JOURNAL_MOUNT must name configured persistent storage under /mnt/.'
[[ ${PUBLISHER_JOURNAL_PATH:-} == "$JOURNAL_MOUNT/publisher.db" ]] || fail 'PUBLISHER_JOURNAL_PATH must be publisher.db directly on JOURNAL_MOUNT.'
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
[[ $(git -C "$root" rev-parse HEAD) == "$IMAGE_VERSION" ]] || fail 'IMAGE_VERSION does not match this checkout.'
[[ -z $(git -C "$root" status --porcelain --untracked-files=normal) ]] || fail 'Build from a clean committed checkout.'

# An offline v1 service JSON export is evidence of configured storage, not an
# authorization to invent a volume type. Current Cloud Run types fail WAL safety.
if [[ -n ${SERVICE_CONFIG_JSON:-} ]]; then
  node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
const fail = message => { console.error(message); process.exit(2); };
let config;
try { config = JSON.parse(readFileSync(process.env.SERVICE_CONFIG_JSON, 'utf8')); }
catch { fail('Invalid offline SERVICE_CONFIG_JSON.'); }
if (config.kind !== 'Service' || config.metadata?.name !== process.env.SERVICE)
  fail('Service configuration does not match SERVICE.');
const spec = config.spec?.template?.spec;
const containers = spec?.containers ?? [];
if (containers.length !== 1) fail('Require one publisher container.');
const container = containers[0];
const env = container.env ?? [];
if (env.some(e => e.name === 'PUBLISHER_FAULTS' && (e.value !== '0' || e.valueFrom)))
  fail('Fault configuration is prohibited.');
if (env.some(e => e.name === 'PUBLISHER_SECRET' && e.value !== undefined))
  fail('Literal publisher secret configuration is prohibited.');
const journal = env.find(e => e.name === 'PUBLISHER_JOURNAL_PATH');
if (journal?.value !== process.env.PUBLISHER_JOURNAL_PATH)
  fail('Journal path does not match service configuration.');
const mount = container.volumeMounts?.find(m => m.mountPath === process.env.JOURNAL_MOUNT);
const volume = spec.volumes?.find(v => v.name === mount?.name);
if (!mount || !volume || mount.readOnly === true) fail('Needs you: pre-existing writable journal volume is required.');
if (volume.nfs || volume.csi || volume.emptyDir || volume.secret)
  fail('Needs you: NFS, GCS FUSE, ephemeral and secret volumes are not qualified for persistent SQLite WAL.');
fail('Needs you: unknown storage type; qualify SQLite WAL durability/locking and add a reviewed preflight before deployment.');
JS
fi
if [[ "$mode" == --deploy ]]; then
  fail 'Needs you: deployment is disabled until a pre-existing persistent SQLite WAL volume/config is qualified. Supply SERVICE_CONFIG_JSON for offline preflight. Use local publisher meanwhile.'
fi
printf '%s\n' 'DRY RUN ONLY: commands below are not executed; build/push are human steps.'
printf 'cd %q\n' "$root"
printf 'docker build --platform linux/amd64 -f Dockerfile.publisher -t %q .\n' "$IMAGE:$IMAGE_VERSION"
printf 'docker push %q\n' "$IMAGE:$IMAGE_VERSION"
printf '%s\n' \
  'Deployment WITHHELD: no qualified persistent SQLite WAL volume/config.' \
  'Required service constraints: max instances 1, faults disabled, journal on configured persistent storage.' \
  'PUBLISHER_SECRET must use the existing Secret Manager reference and pinned version supplied above.' \
  'No APIs, IAM, registry, service, secret, volume or database resources are created.' \
  'Needs you: see docs/publisher-deploy.md; retain the local publisher fallback.'
