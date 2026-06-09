.PHONY: help up down status health index collections

help: ## Show targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Start Qdrant cluster
	docker compose up -d

down: ## Stop cluster
	docker compose down

status: ## Show cluster containers
	docker compose ps

health: ## Check Qdrant health
	curl -s http://localhost:6333/healthz | python3 -m json.tool

collections: ## List collections
	curl -s http://localhost:6333/collections | python3 -m json.tool

index: ## Run ecosystem indexer
	node scripts/index-ecosystem.mjs

index-repo: ## Index a single repo (REPO=name)
	REPOS=$(REPO) node scripts/index-ecosystem.mjs

test: ## Run cluster verification tests
	bash tests/verify-cluster.sh

monitor-install: ## Install 24/7 health monitor cron (every 5 min)
	@(crontab -l 2>/dev/null | grep -v '# SAMAKIA_VECTOR_MONITOR'; \
	  echo "*/5 * * * * curl -sf http://localhost:6333/healthz >/dev/null || (cd /home/aggelos/SAMAKIA-VECTOR && docker compose up -d) # SAMAKIA_VECTOR_MONITOR") | crontab -
	@echo "[OK] monitor cron installed (every 5min, auto-restart on failure)"

monitor-remove: ## Remove monitor cron
	@(crontab -l 2>/dev/null | grep -v '# SAMAKIA_VECTOR_MONITOR') | crontab -
	@echo "[OK] monitor cron removed"
