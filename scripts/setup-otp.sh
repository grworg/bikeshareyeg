#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# setup-otp.sh — Build and start the OpenTripPlanner transit router
#
# This script:
#   1. Checks that the required data files exist
#   2. Builds the OTP routing graph from OSM + GTFS (one-time, ~10-20 min)
#   3. Starts the OTP server on port 8080
#
# Usage:
#   ./scripts/setup-otp.sh          # build graph + start server
#   ./scripts/setup-otp.sh --serve  # skip build, just start server
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OTP_DATA="$PROJECT_DIR/data/otp"
OTP_IMAGE="docker.io/opentripplanner/opentripplanner:2.6.0"
CONTAINER_NAME="bikeshareyeg-otp"

# ── Preflight checks ──
if ! command -v docker &>/dev/null; then
  echo "❌ Docker not found — please install Docker first." >&2
  exit 1
fi

if [[ ! -f "$OTP_DATA/alberta.osm.pbf" ]]; then
  echo "📥 Downloading Alberta OSM extract from Geofabrik (~320 MB)..."
  curl -L -o "$OTP_DATA/alberta.osm.pbf" \
    "https://download.geofabrik.de/north-america/canada/alberta-latest.osm.pbf"
fi

if [[ ! -f "$OTP_DATA/gtfs.zip" ]]; then
  echo "📥 Copying GTFS data..."
  cp "$PROJECT_DIR/data/gtfs/gtfs.zip" "$OTP_DATA/gtfs.zip"
fi

echo "📂 OTP data directory: $OTP_DATA"
ls -lh "$OTP_DATA"

# ── Build graph (unless --serve flag or graph already exists) ──
if [[ "${1:-}" != "--serve" ]] && [[ ! -f "$OTP_DATA/graph.obj" ]]; then
  echo ""
  echo "🔨 Building OTP routing graph (this takes 10-20 minutes)..."
  echo "   OSM: alberta.osm.pbf"
  echo "   GTFS: gtfs.zip"
  echo ""

  docker run --rm \
    -v "$OTP_DATA:/var/opentripplanner" \
    -e JAVA_OPTS="-Xmx6G" \
    "$OTP_IMAGE" \
    --build --save

  echo ""
  echo "✅ Graph built successfully!"
  ls -lh "$OTP_DATA/graph.obj"
fi

# ── Stop existing container if running ──
if docker ps -q -f name="$CONTAINER_NAME" | grep -q .; then
  echo "🛑 Stopping existing OTP container..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# ── Start OTP server ──
echo ""
echo "🚀 Starting OTP server on http://localhost:8080 ..."
docker run -d \
  --name "$CONTAINER_NAME" \
  -p 8080:8080 \
  -v "$OTP_DATA:/var/opentripplanner" \
  -e JAVA_OPTS="-Xmx2G" \
  "$OTP_IMAGE" \
  --load --serve

echo ""
echo "⏳ Waiting for OTP to become healthy..."
for i in $(seq 1 60); do
  if curl -sf -X POST http://localhost:8080/otp/routers/default/index/graphql \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __typename }"}' &>/dev/null; then
    echo "✅ OTP is running! GraphQL API: http://localhost:8080/otp/routers/default/index/graphql"
    exit 0
  fi
  sleep 2
  echo -n "."
done

echo ""
echo "⚠️  OTP did not respond in 120s. Check logs with: docker logs $CONTAINER_NAME"
