#!/usr/bin/env bash
# Deploy the live demo to Cloud Run as one container (nginx + API + publisher): make cloudrun [REF=<commit>].
# The source is `git archive <commit>` (no .env, no node_modules) with docker/cloudrun/Dockerfile and its ignore file
# at the root; Cloud Build builds it remotely, so no local Docker is needed. Keys come from .env (ENV_FILE=… overrides)
# as Cloud Run env vars; names are printed, never values. Needs `gcloud auth login` once.
# One always-on instance: the SQLite ledgers live on the instance and start fresh on every deploy or restart.
set -euo pipefail
ref=${1:-HEAD}
project=${CLOUDRUN_PROJECT:-new-project-1-511117}
region=${CLOUDRUN_REGION:-asia-southeast1}
service=${CLOUDRUN_SERVICE:-thefastandthefungible}
env_file=$(cd "$(dirname "${ENV_FILE:-.env}")" && pwd)/$(basename "${ENV_FILE:-.env}")
cd "$(git rev-parse --show-toplevel)"
sha=$(git rev-parse --short "$ref^{commit}")
git cat-file -e "$sha:docker/cloudrun/Dockerfile" 2>/dev/null || { echo "$ref has no docker/cloudrun/Dockerfile" >&2; exit 1; }
[ -f "$env_file" ] || { echo "No $env_file: the live demo needs its keys (ENV_FILE=… points elsewhere)" >&2; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/src"
git archive "$sha" | tar -x -C "$work/src"
cp "$work/src/docker/cloudrun/Dockerfile" "$work/src/Dockerfile"
cp "$work/src/docker/cloudrun/Dockerfile.dockerignore" "$work/src/.dockerignore"
printf '.gcloudignore\n.git\n**/node_modules\n' > "$work/src/.gcloudignore"
node docker/cloudrun/env.mjs "$env_file" "$work/env.yaml"
echo "==> $service ($project, $region) from $sha"
gcloud run deploy "$service" --project "$project" --region "$region" --source "$work/src" --env-vars-file "$work/env.yaml" \
  --port 8080 --memory 2Gi --cpu 2 --min-instances 1 --max-instances 1 --no-cpu-throttling --execution-environment gen2 \
  --timeout 3600 --allow-unauthenticated --labels "commit=$sha" --quiet
echo "Reset reputation before a stage run: curl -X POST <service URL>/api/reputation/reset"
