#!/usr/bin/env bash
# Build the web, api and publisher images from one commit (default HEAD).
# The context is `git archive <commit>`, so uncommitted files, .env and node_modules never enter it.
# Tags: researchagent-<svc>:<short-sha> and :local (what `make docker-run` uses by default).
set -euo pipefail
ref=${1:-HEAD}
cd "$(git rev-parse --show-toplevel)"
sha=$(git rev-parse --short "$ref^{commit}")
full=$(git rev-parse "$ref^{commit}")
git cat-file -e "$sha:docker/app.Dockerfile" 2>/dev/null || { echo "$ref has no docker/app.Dockerfile" >&2; exit 1; }
for target in publisher api web; do
  echo "==> researchagent-$target:$sha"
  git archive --format=tar "$sha" | DOCKER_BUILDKIT=1 docker build - -f docker/app.Dockerfile --target "$target" \
    --label "org.opencontainers.image.revision=$full" -t "researchagent-$target:$sha" -t "researchagent-$target:local"
done
docker image ls --filter "reference=researchagent-*:$sha" --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}'
echo "Run it: TAG=$sha make docker-run   (or docker-live)"
