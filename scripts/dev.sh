#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# BikeShareYEG — Local Development Environment
#
# Installs dependencies (if needed) and starts the backend API,
# frontend dev server, and (optionally) OpenTripPlanner.
#
# Usage:
#   ./scripts/dev.sh              # start backend + frontend
#   ./scripts/dev.sh --with-otp   # also start OTP container
#   ./scripts/dev.sh --install    # force reinstall dependencies
#
# Prerequisites:
#   - Python >= 3.11 + uv (or pip)
#   - Node.js >= 20 + npm
#   - Docker (only if using --with-otp)
# ──────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

WITH_OTP=false
FORCE_INSTALL=false

for arg in "$@"; do
  case "$arg" in
    --with-otp)  WITH_OTP=true ;;
    --install)   FORCE_INSTALL=true ;;
    -h|--help)
      echo "Usage: ./scripts/dev.sh [--with-otp] [--install]"
      echo ""
      echo "  --with-otp   Start OpenTripPlanner for multimodal routing"
      echo "  --install    Force reinstall all dependencies"
      exit 0
      ;;
  esac
done

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${BLUE}[dev]${NC} $*"; }
ok()    { echo -e "${GREEN}[dev]${NC} $*"; }
err()   { echo -e "${RED}[dev]${NC} $*" >&2; }

# ── Preflight checks ────────────────────────────────────────
info "Checking prerequisites..."

if ! command -v python3 &>/dev/null; then
  err "Python 3 not found. Install Python >= 3.11."
  exit 1
fi

if ! command -v node &>/dev/null; then
  err "Node.js not found. Install Node.js >= 20."
  exit 1
fi

if [ "$WITH_OTP" = true ] && ! command -v docker &>/dev/null; then
  err "Docker not found (required for --with-otp)."
  exit 1
fi

# ── Environment file ────────────────────────────────────────
if [ ! -f .env ]; then
  info "Creating .env from .env.example..."
  cp .env.example .env
  ok ".env created — edit if needed"
fi

# ── Backend dependencies ────────────────────────────────────
if [ "$FORCE_INSTALL" = true ] || [ ! -d backend/.venv ]; then
  info "Installing backend dependencies..."
  cd backend
  if command -v uv &>/dev/null; then
    uv venv .venv --python python3
    uv pip install -e .
  else
    python3 -m venv .venv
    .venv/bin/pip install -e .
  fi
  cd "$PROJECT_DIR"
  ok "Backend dependencies installed"
else
  ok "Backend venv exists (use --install to reinstall)"
fi

# ── Frontend dependencies ───────────────────────────────────
if [ "$FORCE_INSTALL" = true ] || [ ! -d frontend/node_modules ]; then
  info "Installing frontend dependencies..."
  cd frontend
  npm install
  cd "$PROJECT_DIR"
  ok "Frontend dependencies installed"
else
  ok "Frontend node_modules exists (use --install to reinstall)"
fi

# ── Process overlay data if missing ─────────────────────────
if [ ! -f data/overlays/population_density.geojson ]; then
  info "Generating population density overlay..."
  backend/.venv/bin/python scripts/process-census-data.py || {
    err "Failed to generate overlays (non-fatal — planner will work without population data)"
  }
fi

# ── Trap: clean up background processes on exit ─────────────
PIDS=()
cleanup() {
  info "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  if [ "$WITH_OTP" = true ]; then
    docker stop bikeshareyeg-otp 2>/dev/null || true
  fi
  wait 2>/dev/null
  ok "Stopped."
}
trap cleanup EXIT INT TERM

# ── Start OTP (if requested) ────────────────────────────────
if [ "$WITH_OTP" = true ]; then
  info "Starting OpenTripPlanner..."
  bash scripts/setup-otp.sh &
  PIDS+=($!)
fi

# ── Start backend ───────────────────────────────────────────
info "Starting backend (http://localhost:8000)..."
(cd backend && .venv/bin/uvicorn src.api.main:app --reload --port 8000) 2>&1 &
BACKEND_PID=$!
PIDS+=($BACKEND_PID)

# Wait briefly for backend to start
sleep 2

# ── Start frontend ──────────────────────────────────────────
info "Starting frontend (http://localhost:3000)..."
(cd frontend && npm run dev) 2>&1 &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  BikeShareYEG — Development Environment${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Frontend:${NC}  http://localhost:3000"
echo -e "  ${GREEN}Backend:${NC}   http://localhost:8000"
echo -e "  ${GREEN}API docs:${NC}  http://localhost:8000/docs"
if [ "$WITH_OTP" = true ]; then
echo -e "  ${GREEN}OTP:${NC}       http://localhost:8080"
fi
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services"
echo ""

# ── Wait for any process to exit ────────────────────────────
wait -n "${PIDS[@]}" 2>/dev/null || true
