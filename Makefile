# Thin wrapper over npm scripts. `make` lists targets.
# OFFSET=100 shifts every port (5200/8888/8890) so a worktree can run beside main.
OFFSET ?= $(or $(DEMO_PORT_OFFSET),$(shell sed -n 's/^DEMO_PORT_OFFSET=//p' .env 2>/dev/null),0)
export DEMO_PORT_OFFSET := $(OFFSET)
PORTS := $(shell echo $$((5100+$(OFFSET)))),$(shell echo $$((8788+$(OFFSET)))),$(shell echo $$((8790+$(OFFSET))))
DOCTOR := node --import tsx scripts/doctor.mjs

.DEFAULT_GOAL := help
.PHONY: help setup run live variant fault reset check verify doctor keys ports kill langfuse-dashboard wallets

help: ## list targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-8s %s\n", $$1, $$2}'

setup: ## install deps and create .env if missing
	npm ci
	@test -f .env || (cp .env.example .env && echo "Created .env; add DEEPSEEK_API_KEY and CLOUDFLARE_API_TOKEN for live mode")

run: ## fixture demo (offline, no keys)
	npm run demo

live: ## live demo: DeepSeek writes, Clef decides (runs key preflight first)
	npm run demo:live

variant: ## fixture demo on a corpus variant: make variant V=open-sufficient|contradiction|unchanged|injection
	@test -n "$(V)" || (echo "usage: make variant V=open-sufficient" && exit 1)
	CORPUS_VARIANT=$(V) npm run demo

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

keys: ## provider keys only, plus one real DeepSeek + Clef call (latency, limits)
	$(DOCTOR) --keys --deep

wallets: ## re-fund XRPL Testnet wallets from the faucet after a Testnet reset (same addresses)
	node --import tsx scripts/wallets.mjs

ports: ## who is listening on the demo ports
	@lsof -nP -iTCP:$(PORTS) -sTCP:LISTEN || echo "ports $(PORTS) free"

kill: ## free the demo ports
	@pids=$$(lsof -ti tcp:$(PORTS) -sTCP:LISTEN); if [ -n "$$pids" ]; then kill $$pids && echo "stopped $$pids"; else echo "nothing on $(PORTS)"; fi

langfuse-dashboard: ## (re)create the "ResearchAgent · live health" dashboard in Langfuse
	node scripts/langfuse-dashboard.mjs
