#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# BikeShareYEG — Hetzner VM Setup Script
#
# Target: Ubuntu 24.04 LTS on a CX22 or CX32 Hetzner Cloud VM
#
# Prerequisites: SSH into the VM as root
#
# Usage:
#   git clone https://github.com/grworg/bikeshareyeg.git /opt/bikeshareyeg
#   bash /opt/bikeshareyeg/deploy/setup.sh YOUR_DOMAIN
#
# What this does:
#   • Installs Docker Engine + Compose
#   • Configures UFW firewall (SSH + HTTP/S only)
#   • Creates .env from template with production defaults
#   • Builds & starts all containers (API, frontend, OTP, Caddy)
#
# Caddy auto-provisions HTTPS certificates via Let's Encrypt.
# ──────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:?Usage: setup.sh <domain>}"
APP_DIR="/opt/bikeshareyeg"

echo "═══════════════════════════════════════════════════════"
echo "  BikeShareYEG deploy → ${DOMAIN}"
echo "═══════════════════════════════════════════════════════"

# ── 1. Install Docker ────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    echo "[1/4] Installing Docker…"
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
    echo "[✓] Docker installed"
else
    echo "[1/4] Docker already installed — skipping"
fi

# Verify compose plugin
if ! docker compose version &>/dev/null; then
    echo "[!] docker compose plugin not found — installing"
    apt-get install -y -qq docker-compose-plugin
fi

# ── 2. Firewall ──────────────────────────────────────────────
echo "[2/4] Configuring firewall…"
apt-get install -y -qq ufw
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
echo "[✓] UFW enabled — SSH, HTTP, HTTPS"

# ── 3. Environment config ───────────────────────────────────
echo "[3/4] Configuring environment…"
cd "$APP_DIR"

if [ ! -f .env ]; then
    cp .env.example .env
    # Production defaults
    sed -i "s/BIKESHARE_DEBUG=true/BIKESHARE_DEBUG=false/" .env
    sed -i "s|BIKESHARE_ALLOWED_ORIGINS=.*|BIKESHARE_ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}|" .env

    # Uncomment and set the domain for Caddy
    echo "" >> .env
    echo "# Auto-set by setup.sh" >> .env
    echo "DOMAIN=${DOMAIN}" >> .env

    echo "[✓] Created .env — review before continuing: nano ${APP_DIR}/.env"
else
    echo "[!] .env already exists — skipping (check DOMAIN is set)"
fi

# ── 4. Build & start ────────────────────────────────────────
echo "[4/4] Building and starting containers…"
docker compose up -d --build

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Setup complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Services:"
echo "    docker compose ps          # status"
echo "    docker compose logs -f     # follow all logs"
echo "    docker compose logs api    # API logs only"
echo ""
echo "  Caddy will auto-provision HTTPS for: ${DOMAIN}"
echo "  (DNS must point to this server's IP first)"
echo ""
echo "  Data lives in: ${APP_DIR}/data/"
echo "  Config:        ${APP_DIR}/.env"
echo ""
echo "  To rebuild after code changes:"
echo "    cd ${APP_DIR} && docker compose up -d --build"
echo ""
