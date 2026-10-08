# Thin wrapper over npm scripts. `make` lists targets.
# OFFSET=100 shifts every port (5200/8888/8890) so a worktree can run beside main.
OFFSET ?= $(or $(DEMO_PORT_OFFSET),$(shell sed -n 's/^DEMO_PORT_OFFSET=//p' .env 2>/dev/null),0)
export DEMO_PORT_OFFSET := $(OFFSET)
PORTS := $(shell echo $$((5100+$(OFFSET)))),$(shell echo $$((8788+$(OFFSET)))),$(shell echo $$((8790+$(OFFSET))))
DOCTOR := node --import tsx scripts/doctor.mjs

.DEFAULT_GOAL := help
.PHONY: help setup run live fault reset check verify doctor keys preflight ports kill langfuse-dashboard wallets embeddings docker-build docker-run docker-live docker-down docker-logs corpus smoke

help: ## list targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-8s %s\n", $$1, $$2}'

setup: ## install deps and create .env if missing
	npm ci
	@test -f .env || (cp .env.example .env && echo "Created .env; add LLM_API_KEY and CLOUDFLARE_API_TOKEN for live mode")

run: ## fixture demo (offline, no keys)
	npm run demo

live: ## live demo: DeepSeek writes, Clef decides (DECISION_PROVIDER=openai: OpenAI Decisions); runs key preflight first; CF_BACKUP=1 uses the backup Cloudflare pair
	npm run demo:live

fault: ## fixture demo with the "fail next delivery" toggle
	PUBLISHER_FAULTS=1 npm run demo

reset: kill ## stop the demo, then wipe demo ledgers and reports (corpus kept)
	npm run demo:reset

check: ## lint + typecheck + unit tests (same as pre-commit)
	npm run check:fast

verify: ## check + browser tests + build
	npm run verify

doctor: ## node, deps, .env drift, ports, provider keys
	$(DOCTOR)

keys: ## provider keys only, plus one real DeepSeek + Clef + OpenAI Decisions call (latency, limits)
	$(DOCTOR) --keys --deep

preflight: ## stage check before the slot: one live decision round at the server timeout, quota, leftover trust/runs, backup pair, XRPL (CF_BACKUP=1 checks the backup pair as primary)
	$(DOCTOR) --stage

wallets: ## top up XRPL Testnet wallets from the faucet (same addresses); CREATE=1 first creates missing paid-publisher wallets in .env
	node --import tsx scripts/wallets.mjs $(if $(CREATE),--create)

embeddings: ## (live, Workers AI) embed new/changed v2 articles into data/corpus/v2/embeddings.json; Q=<queries.json> also records query vectors
	node --import tsx scripts/build-embeddings.mjs $(if $(Q),--queries $(Q))

ports: ## who is listening on the demo ports
	@lsof -nP -iTCP:$(PORTS) -sTCP:LISTEN || echo "ports $(PORTS) free"

kill: ## free the demo ports
	@pids=$$(lsof -ti tcp:$(PORTS) -sTCP:LISTEN); if [ -n "$$pids" ]; then kill $$pids && echo "stopped $$pids"; else echo "nothing on $(PORTS)"; fi

langfuse-dashboard: ## (re)create the "ResearchAgent · live health" dashboard in Langfuse
	node scripts/langfuse-dashboard.mjs

# --- Docker (docker/compose.yaml): same demo in Alpine containers, web on 127.0.0.1:$(WEB_PORT) ---
# Images are built from a commit (no registry); TAG=<short-sha> runs a specific build, default :local.
DC := docker compose -f docker/compose.yaml
export WEB_PORT ?= $(shell echo $$((5100+$(OFFSET))))
env_or = $(or $(shell sed -n 's/^$(1)=//p' .env 2>/dev/null),$(2))
# Mirrors scripts/demo.mjs --live: xrpl-testnet when a payer seed exists, Langfuse on.
LIVE_ENV := RA_LLM=deepseek RA_DECISION=cloudflare RA_EMBEDDINGS=live RA_LANGFUSE=$(call env_or,LANGFUSE_ENABLED,1) RA_LANGFUSE_ENV=$(call env_or,LANGFUSE_TRACING_ENVIRONMENT,live) \
  RA_RAIL=$(call env_or,SETTLEMENT_RAIL,$(shell grep -q '^XRPL_PAYER_SEED=.' .env 2>/dev/null && echo xrpl-testnet || echo simulated))

docker-build: ## build web/api/publisher images from a commit: make docker-build REF=<commit> (default HEAD)
	scripts/docker-build.sh $(or $(REF),HEAD)

docker-run: ## fixture demo in Docker (offline, no keys); TAG=<sha> picks the images
	@docker image inspect researchagent-api:$(or $(TAG),local) >/dev/null 2>&1 || scripts/docker-build.sh $(or $(TAG),HEAD)
	RA_RAIL=$(call env_or,SETTLEMENT_RAIL,simulated) RA_LANGFUSE=$(call env_or,LANGFUSE_ENABLED,0) $(DC) up -d --wait
	@echo "ResearchAgent (Docker, fixture): http://127.0.0.1:$(WEB_PORT)"

docker-live: ## live demo in Docker: DeepSeek, Clef, XRPL Testnet, Langfuse (keys from .env)
	@docker image inspect researchagent-api:$(or $(TAG),local) >/dev/null 2>&1 || scripts/docker-build.sh $(or $(TAG),HEAD)
	$(LIVE_ENV) $(DC) up -d --wait
	@echo "ResearchAgent (Docker, live): http://127.0.0.1:$(WEB_PORT)"

docker-down: ## stop the Docker demo (ledgers and reports stay in volumes; add V=1 to wipe them)
	$(DC) down $(if $(V),-v)

docker-logs: ## follow the Docker demo logs
	$(DC) logs -f --tail=100

corpus: ## generate the writer corpus with DeepSeek (resumable; ARGS="--only alphaleak" or "--dry-run")
	node --import tsx scripts/generate-corpus.mjs $(ARGS)

smoke: ## live smoke UC1-UC3 on DeepSeek + Clef + Testnet (SPENDS live calls); ARGS="--only UC2" or "--probe"; port offset 300 unless OFFSET= given
	DEMO_PORT_OFFSET=$(if $(filter command line,$(origin OFFSET)),$(OFFSET),300) node --import tsx scripts/live-smoke.mjs $(ARGS)
