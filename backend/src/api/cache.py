"""
Simple thread-safe LRU cache for upstream API responses.

Used to avoid hammering BRouter, OSRM, Photon, and Open-Meteo on repeat
queries.  Entries expire after ``ttl`` seconds.
"""

from __future__ import annotations

import hashlib
import json
import threading
import time
from collections import OrderedDict
from typing import Any


class ResponseCache:
    """Thread-safe TTL + size bounded LRU cache."""

    def __init__(self, max_size: int = 2000, ttl_s: int = 3600):
        self._max = max_size
        self._ttl = ttl_s
        self._lock = threading.Lock()
        self._data: OrderedDict[str, tuple[float, Any]] = OrderedDict()

    @staticmethod
    def _key(prefix: str, params: dict | str) -> str:
        raw = f"{prefix}:{json.dumps(params, sort_keys=True) if isinstance(params, dict) else params}"
        return hashlib.sha256(raw.encode()).hexdigest()[:24]

    def get(self, prefix: str, params: dict | str) -> Any | None:
        k = self._key(prefix, params)
        with self._lock:
            entry = self._data.get(k)
            if entry is None:
                return None
            ts, value = entry
            if time.time() - ts > self._ttl:
                del self._data[k]
                return None
            self._data.move_to_end(k)
            return value

    def put(self, prefix: str, params: dict | str, value: Any) -> None:
        k = self._key(prefix, params)
        with self._lock:
            self._data[k] = (time.time(), value)
            self._data.move_to_end(k)
            while len(self._data) > self._max:
                self._data.popitem(last=False)


# Shared singletons
route_cache = ResponseCache(max_size=5000, ttl_s=3600)
elevation_cache = ResponseCache(max_size=2000, ttl_s=86400)
