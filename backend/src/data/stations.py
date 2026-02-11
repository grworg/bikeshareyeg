"""
Bike-share station state for Edmonton.

In production the station state is **per-session** so multiple visitors can
design networks concurrently without clobbering each other.

Sessions are identified by a cookie (``bsyeg_sid``).  An LRU dict evicts the
oldest session when ``max_sessions`` is exceeded so memory stays bounded.

The *default* station set (shared seed data) is still loaded from
``data/stations.json`` on first boot and serves as the template for new
sessions.
"""

from __future__ import annotations

import copy
import json
import threading
import time
import uuid
from collections import OrderedDict
from pathlib import Path

from src.config import settings

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_PERSIST_PATH = _PROJECT_ROOT / "data" / "stations.json"

# ---------------------------------------------------------------------------
# Default / seed stations (loaded once from disk)
# ---------------------------------------------------------------------------

_default_stations: list[dict] | None = None


def _load_defaults() -> list[dict]:
    global _default_stations
    if _default_stations is not None:
        return _default_stations
    if _PERSIST_PATH.exists():
        try:
            data = json.loads(_PERSIST_PATH.read_text())
            if isinstance(data, list):
                print(f"[Stations] Loaded {len(data)} default stations from {_PERSIST_PATH.name}")
                _default_stations = data
                return _default_stations
        except Exception as exc:
            print(f"[Stations] Failed to load {_PERSIST_PATH.name}: {exc}")
    _default_stations = []
    return _default_stations


# ---------------------------------------------------------------------------
# Per-session state (thread-safe LRU dict)
# ---------------------------------------------------------------------------

class _SessionStore:
    """Thread-safe LRU dict of session_id → station list."""

    def __init__(self, max_size: int, ttl_s: int):
        self._max = max_size
        self._ttl = ttl_s
        self._lock = threading.Lock()
        # OrderedDict gives us O(1) move-to-end for LRU
        self._data: OrderedDict[str, tuple[float, list[dict]]] = OrderedDict()

    def get(self, sid: str) -> list[dict] | None:
        with self._lock:
            entry = self._data.get(sid)
            if entry is None:
                return None
            ts, stations = entry
            if time.time() - ts > self._ttl:
                del self._data[sid]
                return None
            # Touch: move to end (most recently used)
            self._data.move_to_end(sid)
            return copy.deepcopy(stations)

    def put(self, sid: str, stations: list[dict]) -> None:
        with self._lock:
            self._data[sid] = (time.time(), copy.deepcopy(stations))
            self._data.move_to_end(sid)
            # Evict oldest if over capacity
            while len(self._data) > self._max:
                self._data.popitem(last=False)

    def delete(self, sid: str) -> None:
        with self._lock:
            self._data.pop(sid, None)

    def __len__(self) -> int:
        with self._lock:
            return len(self._data)


_store = _SessionStore(
    max_size=settings.max_sessions,
    ttl_s=settings.session_ttl_s,
)


# ---------------------------------------------------------------------------
# Public API (called by route handlers with a session_id)
# ---------------------------------------------------------------------------

def create_session() -> str:
    """Create a new session pre-populated with default stations."""
    sid = uuid.uuid4().hex
    _store.put(sid, copy.deepcopy(_load_defaults()))
    return sid


def get_stations(session_id: str) -> list[dict]:
    """Return the station state for this session (deep copy)."""
    stations = _store.get(session_id)
    if stations is None:
        # Session expired or unknown — reinitialise from defaults
        _store.put(session_id, copy.deepcopy(_load_defaults()))
        return copy.deepcopy(_load_defaults())
    return stations


def set_stations(session_id: str, stations: list[dict]) -> list[dict]:
    """Replace the entire station state for this session."""
    _store.put(session_id, stations)
    return get_stations(session_id)


def reset_stations(session_id: str) -> list[dict]:
    """Reset this session's stations back to defaults."""
    _store.put(session_id, copy.deepcopy(_load_defaults()))
    return get_stations(session_id)
