# BikeShareYEG — Project Commands
# ════════════════════════════════════════════════════════════════
#
# Development:
#   make dev           Start backend + frontend (hot-reload)
#   make dev-otp       Start everything including OpenTripPlanner
#   make install       Force reinstall all dependencies
#   make lint          Run linters (ruff + next lint)
#   make format        Auto-format Python code
#
# Production:
#   make deploy        Build images, transfer, and deploy to server
#   make deploy-quick  Sync code + restart (skip image rebuild)
#   make deploy-data   Deploy with overlay/cache data sync
#
# Docker (local):
#   make up            Start full stack via docker-compose
#   make down          Stop all containers
#   make logs          Follow container logs
#
# Data:
#   make overlays      Generate population density overlay
#   make otp-graph     Build OTP routing graph
#

.PHONY: dev dev-otp install lint format \
        deploy deploy-quick deploy-data \
        up down logs \
        overlays otp-graph help

# ── Development ──────────────────────────────────────────────

dev:  ## Start backend + frontend for local development
	@bash scripts/dev.sh

dev-otp:  ## Start everything including OpenTripPlanner
	@bash scripts/dev.sh --with-otp

install:  ## Force reinstall all dependencies
	@bash scripts/dev.sh --install

lint:  ## Run linters
	@echo "── Python (ruff) ──"
	cd backend && .venv/bin/ruff check src/
	@echo ""
	@echo "── TypeScript (next lint) ──"
	cd frontend && npm run lint

format:  ## Auto-format Python code
	cd backend && .venv/bin/ruff format src/ && .venv/bin/ruff check --fix src/

# ── Production ───────────────────────────────────────────────

deploy:  ## Build, transfer, and deploy to production
	@bash scripts/deploy.sh

deploy-quick:  ## Sync code + restart only (no image rebuild)
	@bash scripts/deploy.sh --skip-build

deploy-data:  ## Deploy with overlay/cache data sync
	@bash scripts/deploy.sh --sync-data

# ── Docker (local) ───────────────────────────────────────────

up:  ## Start full stack via docker-compose (local)
	docker compose up -d --build

down:  ## Stop all containers
	docker compose down

logs:  ## Follow container logs
	docker compose logs -f

# ── Data ─────────────────────────────────────────────────────

overlays:  ## Generate population density overlay from census data
	cd backend && .venv/bin/python ../scripts/process-census-data.py

otp-graph:  ## Build OTP routing graph (downloads OSM + GTFS data)
	@bash scripts/setup-otp.sh

# ── Help ─────────────────────────────────────────────────────

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
