#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# BikeShareYEG — Deploy to an existing server
#
# Assumes Docker is already installed (e.g. colocated with another
# compose stack). This script:
#   1. Creates .env from template with production defaults
#   2. Builds and starts all containers
#
# The host's main reverse proxy (Caddy, nginx, etc.) should forward
# bikeshare.grassrootswork.org → 127.0.0.1:8443
#
# Usage:
#   git clone https://github.com/grworg/bikeshareyeg.git /opt/bikeshareyeg
#   bash /opt/bikeshareyeg/deploy/setup.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${1:-bikeshare.grassrootswork.org}"

echo "═══════════════════════════════════════════════════════"
echo "  BikeShareYEG deploy"
echo "═══════════════════════════════════════════════════════"

# ── Preflight checks ────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    echo "[!] Docker not found. Install it first: https://get.docker.com"
    exit 1
fi

if ! docker compose version &>/dev/null; then
    echo "[!] docker compose plugin not found."
    exit 1
fi

# ── Environment config ──────────────────────────────────────
cd "$APP_DIR"

if [ ! -f .env ]; then
    echo "[1/2] Creating .env from template…"
    cp .env.example .env
    sed -i "s/BIKESHARE_DEBUG=true/BIKESHARE_DEBUG=false/" .env
    sed -i "s|BIKESHARE_ALLOWED_ORIGINS=.*|BIKESHARE_ALLOWED_ORIGINS=https://${DOMAIN}|" .env
    echo "[✓] Created .env — review: nano ${APP_DIR}/.env"
else
    echo "[1/2] .env already exists — skipping"
fi

# ── Build & start ───────────────────────────────────────────
echo "[2/2] Building and starting containers…"
docker compose up -d --build

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Setup complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  BikeShareYEG is listening on 127.0.0.1:8443"
echo ""
echo "  Make sure your host reverse proxy forwards:"
echo "    ${DOMAIN} → localhost:8443"
echo ""
echo "  Commands:"
echo "    docker compose ps          # status"
echo "    docker compose logs -f     # follow logs"
echo "    docker compose up -d --build  # rebuild"
echo ""
