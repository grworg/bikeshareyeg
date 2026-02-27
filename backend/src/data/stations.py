"""
Bike-share station state — per-session, cookie-based.

Multiple visitors can design networks concurrently without clobbering each
other.  An LRU dict evicts the oldest session when ``max_sessions`` is
exceeded so memory stays bounded.

New sessions always start with an empty station list.  Users build their
network via the Designer (manual placement or optimizer).
"""

from __future__ import annotations

import copy
import threading
import time
import uuid
from collections import OrderedDict

from src.config import settings


# ---------------------------------------------------------------------------
# Per-session state (thread-safe LRU dict)
# ---------------------------------------------------------------------------

class _SessionStore:
    """Thread-safe LRU dict of session_id → station list."""

    def __init__(self, max_size: int, ttl_s: int):
        self._max = max_size
        self._ttl = ttl_s
        self._lock = threading.Lock()
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
            self._data.move_to_end(sid)
            return copy.deepcopy(stations)

    def put(self, sid: str, stations: list[dict]) -> None:
        with self._lock:
            self._data[sid] = (time.time(), copy.deepcopy(stations))
            self._data.move_to_end(sid)
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
    """Create a new session with an empty station list."""
    sid = uuid.uuid4().hex
    _store.put(sid, [])
    return sid


def get_stations(session_id: str) -> list[dict]:
    """Return the station state for this session (deep copy)."""
    stations = _store.get(session_id)
    if stations is None:
        _store.put(session_id, [])
        return []
    return stations


def set_stations(session_id: str, stations: list[dict]) -> list[dict]:
    """Replace the entire station state for this session."""
    _store.put(session_id, stations)
    return get_stations(session_id)


def reset_stations(session_id: str) -> list[dict]:
    """Reset this session's stations to empty."""
    _store.put(session_id, [])
    return []


def clear_stations(session_id: str) -> list[dict]:
    """Remove all stations for this session (empty network)."""
    _store.put(session_id, [])
    return []
