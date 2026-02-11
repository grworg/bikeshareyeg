#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# BikeShareYEG — Hetzner VM Setup Script
#
# Target: Ubuntu 24.04 LTS on a CX22 or CX32 Hetzner Cloud VM
#
# Usage:
#   1. SSH into the VM as root
#   2. Upload/clone the repo to /opt/bikeshareyeg
#   3. Run: bash /opt/bikeshareyeg/deploy/setup.sh YOUR_DOMAIN
#
# What this does:
#   • Creates a 'bikeshare' service user
#   • Installs system deps (Python 3.12, Node 22, uv, Caddy, Docker)
#   • Installs Python + Node dependencies
#   • Builds the Next.js frontend
#   • Copies systemd units & Caddyfile
#   • Configures UFW firewall
#   • Enables and starts all services
# ──────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:?Usage: setup.sh <domain>}"
APP_DIR="/opt/bikeshareyeg"

echo "═══════════════════════════════════════════════════════"
echo "  BikeShareYEG deploy → ${DOMAIN}"
echo "═══════════════════════════════════════════════════════"

# ── 0. Service user ──────────────────────────────────────────
if ! id -u bikeshare &>/dev/null; then
    useradd --system --shell /usr/sbin/nologin --home-dir "$APP_DIR" bikeshare
    echo "[✓] Created user: bikeshare"
fi

# ── 1. System packages ──────────────────────────────────────
echo "[1/8] Installing system packages…"
apt-get update -qq
apt-get install -y -qq \
    python3.12 python3.12-venv python3.12-dev \
    build-essential curl git unzip \
    ca-certificates gnupg lsb-release

# Node.js 22 via NodeSource
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

# uv (fast Python package manager)
if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
fi

# Caddy
if ! command -v caddy &>/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y caddy
fi

# Docker (for OTP)
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
fi

echo "[✓] System packages installed"

# ── 2. Application directory ────────────────────────────────
echo "[2/8] Setting up application directory…"
chown -R bikeshare:bikeshare "$APP_DIR"

# ── 3. Python backend ──────────────────────────────────────
echo "[3/8] Installing Python dependencies…"
cd "$APP_DIR/backend"
sudo -u bikeshare uv venv .venv --python python3.12
sudo -u bikeshare uv pip install -e ".[dev]" --quiet 2>/dev/null \
    || sudo -u bikeshare uv pip install -e . --quiet

# ── 4. Frontend build ──────────────────────────────────────
echo "[4/8] Building Next.js frontend…"
cd "$APP_DIR/frontend"
sudo -u bikeshare npm ci --quiet
sudo -u bikeshare npm run build

# Copy static assets into standalone output (Next.js standalone quirk)
if [ -d ".next/standalone" ]; then
    cp -r public .next/standalone/ 2>/dev/null || true
    cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
fi

# ── 5. Production .env ─────────────────────────────────────
echo "[5/8] Configuring environment…"
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    # Flip to production defaults
    sed -i "s/BIKESHARE_DEBUG=true/BIKESHARE_DEBUG=false/" "$APP_DIR/.env"
    sed -i "s|BIKESHARE_ALLOWED_ORIGINS=.*|BIKESHARE_ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}|" "$APP_DIR/.env"
    echo "[!] Created .env — review /opt/bikeshareyeg/.env before starting"
fi

# ── 6. systemd units ──────────────────────────────────────
echo "[6/8] Installing systemd services…"
cp "$APP_DIR/deploy/bikeshareyeg-api.service" /etc/systemd/system/
cp "$APP_DIR/deploy/bikeshareyeg-web.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable bikeshareyeg-api bikeshareyeg-web

# ── 7. Caddy ──────────────────────────────────────────────
echo "[7/8] Configuring Caddy…"
mkdir -p /var/log/caddy
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
# Inject the domain
sed -i "s|{\$DOMAIN:localhost}|${DOMAIN}|" /etc/caddy/Caddyfile
systemctl enable caddy

# ── 8. Firewall ───────────────────────────────────────────
echo "[8/8] Configuring firewall…"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
echo "[✓] UFW enabled — only SSH, HTTP, HTTPS open"

# ── Summary ───────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Setup complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Review config:     nano /opt/bikeshareyeg/.env"
echo "  2. Start OTP:         cd /opt/bikeshareyeg && docker compose up -d"
echo "  3. Start services:    systemctl start bikeshareyeg-api bikeshareyeg-web caddy"
echo "  4. Check status:      systemctl status bikeshareyeg-api bikeshareyeg-web caddy"
echo "  5. View logs:         journalctl -u bikeshareyeg-api -f"
echo ""
echo "  Caddy will auto-provision HTTPS for: ${DOMAIN}"
echo ""
