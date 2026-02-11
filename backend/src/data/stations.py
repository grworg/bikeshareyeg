"""
Bike-share station state for Edmonton.

Starts empty — users build their network via the designer (Seed LRT,
auto-planner, or manual placement).  Persists to data/stations.json
so the network survives backend restarts.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_PERSIST_PATH = _PROJECT_ROOT / "data" / "stations.json"

DEFAULT_STATIONS: list[dict] = []


# ---------------------------------------------------------------------------
# In-memory station state (mutable at runtime via the designer)
# ---------------------------------------------------------------------------

_current_stations: list[dict] | None = None


def _load_from_disk() -> list[dict]:
    """Load stations from disk, falling back to defaults."""
    if _PERSIST_PATH.exists():
        try:
            data = json.loads(_PERSIST_PATH.read_text())
            if isinstance(data, list):
                print(f"[Stations] Loaded {len(data)} stations from {_PERSIST_PATH.name}")
                return data
        except Exception as exc:
            print(f"[Stations] Failed to load {_PERSIST_PATH.name}: {exc}")
    return copy.deepcopy(DEFAULT_STATIONS)


def _save_to_disk(stations: list[dict]) -> None:
    """Persist stations to disk (fire-and-forget)."""
    try:
        _PERSIST_PATH.parent.mkdir(parents=True, exist_ok=True)
        _PERSIST_PATH.write_text(json.dumps(stations, indent=2))
    except Exception as exc:
        print(f"[Stations] Failed to save: {exc}")


def get_stations() -> list[dict]:
    """Return the current station state (deep copy to prevent mutation)."""
    global _current_stations
    if _current_stations is None:
        _current_stations = _load_from_disk()
    return copy.deepcopy(_current_stations)


def set_stations(stations: list[dict]) -> list[dict]:
    """Replace the entire station state."""
    global _current_stations
    _current_stations = copy.deepcopy(stations)
    _save_to_disk(_current_stations)
    return get_stations()


def update_station(station_id: str, updates: dict) -> dict | None:
    """Update a single station by ID. Returns the updated station or None."""
    global _current_stations
    if _current_stations is None:
        _current_stations = _load_from_disk()
    for s in _current_stations:
        if s["id"] == station_id:
            s.update(updates)
            _save_to_disk(_current_stations)
            return dict(s)
    return None


def reset_stations() -> list[dict]:
    """Reset stations back to defaults."""
    global _current_stations
    _current_stations = None
    _save_to_disk(copy.deepcopy(DEFAULT_STATIONS))
    return get_stations()
