#!/usr/bin/env bash
# Deploy the whole app (web + API + publisher, one container) to Cloud Run. Cloud Build builds the
# root Dockerfile remotely, so no local Docker is needed. Prereqs: `gcloud auth login` and a project
# with billing (the free-trial credit covers this). Re-running updates the same service.
#
#   PROJECT_ID=my-project scripts/deploy-cloudrun.sh                 # live: DeepSeek + Clef + XRPL Testnet from .env
#   MODE=fixture PROJECT_ID=my-project scripts/deploy-cloudrun.sh    # offline fixtures, no provider keys
#   MIN_INSTANCES=1 ...   # demo day only: no cold start (billed while idle)
#   PUBLIC=1 ...          # drop the basic-auth gate (anyone can spend your provider quota and Testnet XRP)
#
# Secrets go to Secret Manager through stdin; they never reach the command line, the image or this
# script's output. The basic-auth login is generated once; read it with:
#   gcloud secrets versions access latest --secret DEMO_BASIC_AUTH
set -euo pipefail
PROJECT_ID=${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}
REGION=${REGION:-asia-southeast1}
SERVICE=${SERVICE:-researchagent}
ENV_FILE=${ENV_FILE:-.env}
MODE=${MODE:-live}
[ -n "$PROJECT_ID" ] || { echo "Set PROJECT_ID (or gcloud config set project ...)"; exit 1; }
g() { gcloud --project "$PROJECT_ID" --quiet "$@"; }
# Read KEY from the environment, else from .env without sourcing it.
val() { local v="${!1:-}"; [ -n "$v" ] || v=$(sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | tail -1); v="${v#[\"\']}"; printf %s "${v%[\"\']}"; }

g services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
SA="$(g projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
# Source deploys build as the default compute account; newer projects no longer grant it this role.
g projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SA" --role roles/run.builder --condition=None >/dev/null

secrets=()
secret() { # NAME VALUE: add a version only when the value changed, then mount it as env NAME
  g secrets describe "$1" >/dev/null 2>&1 || g secrets create "$1" --replication-policy=automatic >/dev/null
  [ "$(g secrets versions access latest --secret "$1" 2>/dev/null || true)" = "$2" ] || printf %s "$2" | g secrets versions add "$1" --data-file=- >/dev/null
  g secrets add-iam-policy-binding "$1" --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor >/dev/null
  secrets+=("$1=$1:latest")
}
existing() { g secrets versions access latest --secret "$1" 2>/dev/null || true; }

pub=$(existing PUBLISHER_SECRET); secret PUBLISHER_SECRET "${pub:-$(openssl rand -hex 32)}"
if [ -z "${PUBLIC:-}" ]; then
  auth=$(val DEMO_BASIC_AUTH); [ -n "$auth" ] || auth=$(existing DEMO_BASIC_AUTH); secret DEMO_BASIC_AUTH "${auth:-demo:$(openssl rand -hex 8)}"
fi

envs=("PUBLISHER_FAULTS=$(val PUBLISHER_FAULTS)")
if [ "$MODE" = live ]; then
  for key in DEEPSEEK_API_KEY CLOUDFLARE_API_TOKEN; do [ -n "$(val $key)" ] || { echo "$key missing in $ENV_FILE (or use MODE=fixture)"; exit 1; }; secret $key "$(val $key)"; done
  envs+=(LLM_PROVIDER=deepseek DECISION_PROVIDER=cloudflare)
  if [ -n "$(val XRPL_PAYER_SEED)" ]; then secret XRPL_PAYER_SEED "$(val XRPL_PAYER_SEED)"; envs+=(SETTLEMENT_RAIL=xrpl-testnet); else envs+=(SETTLEMENT_RAIL=simulated); fi
  for key in DEEPSEEK_MODEL DEEPSEEK_BASE_URL LLM_TIMEOUT_MS CLOUDFLARE_ACCOUNT_ID DECISION_MODEL BUY_THRESHOLD XRPL_PAYER_ADDRESS XRPL_RECEIVER_ADDRESS XRPL_RPC_URL CORPUS_VARIANT; do
    [ -z "$(val $key)" ] || envs+=("$key=$(val $key)")
  done
else
  envs+=(LLM_PROVIDER=fixture DECISION_PROVIDER=fixture SETTLEMENT_RAIL=simulated)
fi

# One instance: runs, SSE streams and both SQLite ledgers live in that instance's memory.
# CPU stays allocated so a run keeps working between requests.
g run deploy "$SERVICE" --source . --region "$REGION" --allow-unauthenticated \
  --execution-environment gen2 --cpu 1 --memory 2Gi --no-cpu-throttling --timeout 3600 \
  --max-instances 1 --min-instances "${MIN_INSTANCES:-0}" \
  --set-env-vars "^@^$(IFS=@; echo "${envs[*]}")" --set-secrets "$(IFS=,; echo "${secrets[*]}")"
echo "ResearchAgent: $(g run services describe "$SERVICE" --region "$REGION" --format='value(status.url)') ($MODE mode)"
