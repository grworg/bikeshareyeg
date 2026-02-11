# ── BikeShareYEG API ──────────────────────────────────────────
# Multi-stage build: install deps with uv, then copy into slim runtime image.

FROM python:3.12-slim AS builder

# System deps for geospatial libs (GDAL, GEOS, PROJ)
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        build-essential libgdal-dev libgeos-dev libproj-dev curl && \
    rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    mv /root/.local/bin/uv /usr/local/bin/uv

WORKDIR /app

# pyproject.toml references ../README.md
COPY pyproject.toml backend/pyproject.toml
RUN touch README.md

WORKDIR /app/backend

# Install dependencies (layer caching)
RUN uv venv .venv --python python3.12 && \
    uv pip install --quiet -e .

# Copy source
COPY src/ src/

# ── Runtime image ─────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Runtime geospatial shared libs (package names match Debian Trixie)
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
        libgdal36 libgeos3.13.1 libproj25 curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the entire venv and source from builder
COPY --from=builder /app/backend/.venv /app/backend/.venv
COPY --from=builder /app/backend/src /app/backend/src
COPY --from=builder /app/backend/pyproject.toml /app/backend/pyproject.toml

# Make sure the venv python is on PATH
ENV PATH="/app/backend/.venv/bin:$PATH"
# The app uses `from src.X` imports, so /app/backend must be on PYTHONPATH
ENV PYTHONPATH="/app/backend"

# data/ is volume-mounted at runtime
VOLUME ["/app/data"]

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:8000/health || exit 1

CMD ["gunicorn", "src.api.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--graceful-timeout", "30", \
     "--access-logfile", "-"]
