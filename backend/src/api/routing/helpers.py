"""Shared helper functions for route computation."""

from __future__ import annotations

import math
from datetime import datetime, date


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def fmt_dist(m: float) -> str:
    if m >= 1000:
        return f"{m / 1000:.1f} km"
    return f"{m:.0f} m"


def fmt_time(s: float) -> str:
    mins = round(s / 60)
    if mins < 1:
        return "< 1 min"
    if mins >= 60:
        h, m = divmod(mins, 60)
        return f"{h} h {m} min" if m else f"{h} h"
    return f"{mins} min"


def epoch_ms_to_hhmm(ms: int) -> str:
    """Convert epoch milliseconds to HH:MM (local time)."""
    dt = datetime.fromtimestamp(ms / 1000)
    return f"{dt.hour:02d}:{dt.minute:02d}"


def seconds_to_hhmm_local(s: int) -> str:
    """Seconds since midnight → HH:MM."""
    s = s % 86400
    h, m = divmod(s // 60, 60)
    return f"{h:02d}:{m:02d}"


def parse_departure(dt_str: str | None) -> tuple[date, int]:
    """Parse departure_time string → (date, seconds_since_midnight).
    Returns current date/time if None."""
    now = datetime.now()
    if not dt_str:
        return now.date(), now.hour * 3600 + now.minute * 60 + now.second
    try:
        dt = datetime.fromisoformat(dt_str)
        return dt.date(), dt.hour * 3600 + dt.minute * 60 + dt.second
    except ValueError:
        return now.date(), now.hour * 3600 + now.minute * 60 + now.second
