#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# BikeShareYEG — Deploy to Production
#
# Builds Docker images locally, transfers them to the remote
# server, syncs code and data, and restarts services.
#
# This approach works even when the server lacks outbound internet
# from Docker containers (no docker pull / docker build on server).
#
# Usage:
#   ./scripts/deploy.sh                    # full deploy
#   ./scripts/deploy.sh --skip-build       # sync + restart only
#   ./scripts/deploy.sh --sync-data        # also sync overlay/cache data
#
# Prerequisites:
#   - Docker (local, for building images)
#   - SSH access to the server (configured as "grassroots" in ~/.ssh/config)
#   - rsync
#
# Configuration:
#   Edit the variables below or set them as environment variables.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

# ── Configuration (override via env vars) ────────────────────
SSH_HOST="${DEPLOY_SSH_HOST:-grassroots}"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/opt/bikeshareyeg}"
DOMAIN="${DEPLOY_DOMAIN:-bikeshare.grassrootswork.org}"

SKIP_BUILD=false
SYNC_DATA=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --sync-data)  SYNC_DATA=true ;;
    -h|--help)
      echo "Usage: ./scripts/deploy.sh [--skip-build] [--sync-data]"
      echo ""
      echo "  --skip-build   Skip Docker image build (sync code + restart only)"
      echo "  --sync-data    Also sync data/overpass_cache and data/overlays"
      echo ""
      echo "Environment variables:"
      echo "  DEPLOY_SSH_HOST    SSH host alias (default: grassroots)"
      echo "  DEPLOY_REMOTE_DIR  Remote app directory (default: /opt/bikeshareyeg)"
      echo "  DEPLOY_DOMAIN      Public domain (default: bikeshare.grassrootswork.org)"
      exit 0
      ;;
  esac
done

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
step() { echo -e "\n${BOLD}${BLUE}──── $* ────${NC}"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; }

# ── Preflight ────────────────────────────────────────────────
step "Preflight checks"

if ! command -v docker &>/dev/null; then
  err "Docker not found locally"; exit 1
fi
if ! command -v rsync &>/dev/null; then
  err "rsync not found"; exit 1
fi
if ! ssh -o ConnectTimeout=5 "$SSH_HOST" true 2>/dev/null; then
  err "Cannot SSH to $SSH_HOST"; exit 1
fi
ok "All checks passed"

# ── Build Docker images (local) ─────────────────────────────
if [ "$SKIP_BUILD" = false ]; then
  step "Building Docker images locally"
  docker compose build api web
  ok "Images built"

  step "Transferring images to server"
  docker save bikeshareyeg-api bikeshareyeg-web \
    | gzip \
    | ssh "$SSH_HOST" "docker load"
  ok "Images loaded on server"
else
  ok "Skipping image build (--skip-build)"
fi

# ── Sync code to server ─────────────────────────────────────
step "Syncing code to $SSH_HOST:$REMOTE_DIR"
rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='data/overpass_cache' \
  --exclude='data/overlays' \
  --exclude='data/raw' \
  --exclude='data/processed' \
  --exclude='data/cache' \
  --exclude='data/otp/*.osm.pbf' \
  --exclude='data/otp/graph.obj' \
  --exclude='.env' \
  "$PROJECT_DIR/" "$SSH_HOST:$REMOTE_DIR/"
ok "Code synced"

# ── Sync data files (optional) ──────────────────────────────
if [ "$SYNC_DATA" = true ]; then
  step "Syncing data files"
  rsync -az data/overpass_cache/ "$SSH_HOST:$REMOTE_DIR/data/overpass_cache/"
  rsync -az data/overlays/ "$SSH_HOST:$REMOTE_DIR/data/overlays/"
  ok "Data files synced"
fi

# ── Ensure .env exists on server ─────────────────────────────
ssh "$SSH_HOST" "
  if [ ! -f $REMOTE_DIR/.env ]; then
    echo '[deploy] Creating .env from template...'
    cp $REMOTE_DIR/.env.example $REMOTE_DIR/.env
    sed -i 's/BIKESHARE_DEBUG=true/BIKESHARE_DEBUG=false/' $REMOTE_DIR/.env
    sed -i 's|BIKESHARE_ALLOWED_ORIGINS=.*|BIKESHARE_ALLOWED_ORIGINS=https://$DOMAIN|' $REMOTE_DIR/.env
  fi
"

# ── Restart services ─────────────────────────────────────────
step "Restarting services"
ssh "$SSH_HOST" "cd $REMOTE_DIR && docker compose up -d --no-build"
ok "Services started"

# ── Connect host Caddy to bikeshareyeg network ──────────────
# The host's grassroots-caddy reverse-proxies to bikeshareyeg-caddy
# by container name, so it must be on the same Docker network.
step "Connecting host Caddy to bikeshareyeg network"
BIKESHARE_NET=$(ssh "$SSH_HOST" "docker inspect bikeshareyeg-caddy --format '{{range \$k, \$v := .NetworkSettings.Networks}}{{\$k}}{{end}}'" 2>/dev/null || true)
if [ -n "$BIKESHARE_NET" ]; then
  ssh "$SSH_HOST" "docker network connect $BIKESHARE_NET grassroots-caddy 2>/dev/null || true"
  ok "grassroots-caddy connected to $BIKESHARE_NET"
else
  err "Could not determine bikeshareyeg network name"
fi

# ── Health check ─────────────────────────────────────────────
step "Health check"
for i in $(seq 1 20); do
  if ssh "$SSH_HOST" "curl -sf http://localhost:8443/health" &>/dev/null; then
    ok "API healthy"
    break
  fi
  if [ "$i" -eq 20 ]; then
    err "API did not become healthy in 60s"
    ssh "$SSH_HOST" "docker logs bikeshareyeg-api --tail 10" 2>&1
    exit 1
  fi
  sleep 3
done

# Public endpoint check
if curl -sf "https://$DOMAIN/health" &>/dev/null; then
  ok "Public endpoint healthy"
else
  err "Public endpoint not reachable (may need a moment for TLS)"
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Deployment complete!${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}URL:${NC}  https://$DOMAIN"
echo -e "  ${GREEN}SSH:${NC}  ssh $SSH_HOST"
echo ""
echo -e "  Useful commands:"
echo -e "    ssh $SSH_HOST 'cd $REMOTE_DIR && docker compose logs -f'"
echo -e "    ssh $SSH_HOST 'cd $REMOTE_DIR && docker compose ps'"
echo ""
