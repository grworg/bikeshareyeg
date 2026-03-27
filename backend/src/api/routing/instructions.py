"""Generate turn-by-turn navigation instructions from route geometry.

Analyses heading changes along a LineString to produce Instruction objects
for walk/bike legs. Transit legs get simple board/alight instructions instead.
"""

from __future__ import annotations

import math

from src.api.routing.models import Instruction, RouteOption
from src.api.routing.helpers import haversine_m

MIN_SEGMENT_M = 15          # ignore segments shorter than this for heading calc
TURN_THRESHOLD_DEG = 25     # heading change below this = "straight" (omitted)
SLIGHT_THRESHOLD_DEG = 50   # 25–50° = slight turn
SHARP_THRESHOLD_DEG = 140   # >140° = sharp turn / u-turn
MIN_INSTRUCTION_GAP_M = 30  # merge instructions closer than this


def _bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Initial bearing from (lat1,lng1) to (lat2,lng2) in degrees 0-360."""
    rlat1, rlat2 = math.radians(lat1), math.radians(lat2)
    dlng = math.radians(lng2 - lng1)
    x = math.sin(dlng) * math.cos(rlat2)
    y = math.cos(rlat1) * math.sin(rlat2) - math.sin(rlat1) * math.cos(rlat2) * math.cos(dlng)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _angle_diff(a: float, b: float) -> float:
    """Signed difference b - a in range (-180, 180]."""
    d = (b - a + 180) % 360 - 180
    return d


def _classify_turn(angle: float) -> tuple[str, str]:
    """Classify a signed heading change into (type, text)."""
    a = abs(angle)
    if a < TURN_THRESHOLD_DEG:
        return "straight", "Continue straight"
    if a > SHARP_THRESHOLD_DEG:
        if angle < 0:
            return "u_turn", "Make a U-turn"
        return "u_turn", "Make a U-turn"
    if a <= SLIGHT_THRESHOLD_DEG:
        if angle < 0:
            return "slight_left", "Turn slightly left"
        return "slight_right", "Turn slightly right"
    if angle < 0:
        return "left", "Turn left"
    return "right", "Turn right"


def _cumulative_distances(coords: list[list[float]]) -> list[float]:
    """Compute cumulative distance along a coordinate array (GeoJSON [lng,lat])."""
    dists = [0.0]
    for i in range(1, len(coords)):
        d = haversine_m(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0])
        dists.append(dists[-1] + d)
    return dists


def generate_leg_instructions(geometry: dict, mode: str) -> list[Instruction]:
    """Generate turn-by-turn instructions for a walk/bike leg geometry."""
    coords = geometry.get("coordinates", [])
    if len(coords) < 2:
        return []

    cum_dist = _cumulative_distances(coords)
    total_dist = cum_dist[-1]

    instructions: list[Instruction] = []

    # Depart instruction
    if len(coords) >= 2:
        heading = _bearing(coords[0][1], coords[0][0], coords[1][1], coords[1][0])
        instructions.append(Instruction(
            type="depart",
            text=f"Head {_compass_direction(heading)}",
            distance_m=0.0,
            coord=coords[0][:2],
            heading=round(heading, 1),
        ))

    # Scan for heading changes at each vertex
    prev_heading: float | None = None
    for i in range(1, len(coords) - 1):
        seg_before = haversine_m(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0])
        seg_after = haversine_m(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])

        if seg_before < MIN_SEGMENT_M or seg_after < MIN_SEGMENT_M:
            continue

        h_in = _bearing(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0])
        h_out = _bearing(coords[i][1], coords[i][0], coords[i + 1][1], coords[i + 1][0])

        angle = _angle_diff(h_in, h_out)
        if abs(angle) < TURN_THRESHOLD_DEG:
            prev_heading = h_out
            continue

        if instructions and (cum_dist[i] - instructions[-1].distance_m) < MIN_INSTRUCTION_GAP_M:
            prev_heading = h_out
            continue

        turn_type, turn_text = _classify_turn(angle)
        instructions.append(Instruction(
            type=turn_type,
            text=turn_text,
            distance_m=round(cum_dist[i], 1),
            coord=coords[i][:2],
            heading=round(h_out, 1),
        ))
        prev_heading = h_out

    # Arrive instruction
    instructions.append(Instruction(
        type="arrive",
        text="Arrive at destination",
        distance_m=round(total_dist, 1),
        coord=coords[-1][:2],
        heading=None,
    ))

    return instructions


def _compass_direction(heading: float) -> str:
    dirs = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]
    idx = round(heading / 45) % 8
    return dirs[idx]


def enrich_instructions(route: RouteOption) -> None:
    """Add turn-by-turn instructions to walk/bike legs of a route."""
    for leg in route.legs:
        if leg.mode in ("walk", "bike") and leg.geometry:
            leg.instructions = generate_leg_instructions(leg.geometry, leg.mode)
