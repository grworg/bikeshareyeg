"""
Station placement optimization using OR-Tools.

Solves the facility location problem:
  Given candidate locations (H3 hex centroids) and demand estimates,
  select K station locations that maximize coverage / minimize
  average distance to demand.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from ortools.linear_solver import pywraplp


@dataclass
class CandidateLocation:
    """A potential station location."""

    id: str
    lat: float
    lng: float
    demand_score: float  # relative demand weight at this location
    cost: float = 1.0  # relative cost of placing a station here


@dataclass
class PlacementResult:
    """Result of the station placement optimization."""

    selected_ids: list[str]
    total_coverage: float
    objective_value: float


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate great-circle distance in km between two points."""
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlng = np.radians(lng2 - lng1)
    a = np.sin(dlat / 2) ** 2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlng / 2) ** 2
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))


def optimize_station_placement(
    candidates: list[CandidateLocation],
    num_stations: int,
    coverage_radius_km: float = 0.5,
    max_seconds: int = 30,
) -> PlacementResult:
    """
    Solve the maximal covering location problem (MCLP).

    Select `num_stations` from `candidates` to maximize the total
    demand covered within `coverage_radius_km` of at least one station.

    Args:
        candidates: List of candidate locations with demand scores.
        num_stations: Number of stations to place.
        coverage_radius_km: A demand point is "covered" if within this distance.
        max_seconds: Solver time limit.

    Returns:
        PlacementResult with selected station IDs and coverage stats.
    """
    n = len(candidates)
    solver = pywraplp.Solver.CreateSolver("SCIP")
    if not solver:
        raise RuntimeError("SCIP solver not available")

    # Decision variables: x[i] = 1 if we place a station at candidate i
    x = [solver.IntVar(0, 1, f"x_{i}") for i in range(n)]

    # Coverage variables: y[j] = 1 if demand point j is covered
    y = [solver.IntVar(0, 1, f"y_{j}") for j in range(n)]

    # Precompute which candidates can cover which demand points
    coverage_matrix = np.zeros((n, n), dtype=bool)
    for i in range(n):
        for j in range(n):
            dist = haversine_km(
                candidates[i].lat, candidates[i].lng,
                candidates[j].lat, candidates[j].lng,
            )
            coverage_matrix[i][j] = dist <= coverage_radius_km

    # Constraint: place exactly num_stations
    solver.Add(sum(x) == num_stations)

    # Constraint: y[j] can be 1 only if some x[i] covers j
    for j in range(n):
        covering = [x[i] for i in range(n) if coverage_matrix[i][j]]
        if covering:
            solver.Add(y[j] <= sum(covering))
        else:
            solver.Add(y[j] == 0)

    # Objective: maximize weighted coverage
    objective = solver.Objective()
    for j in range(n):
        objective.SetCoefficient(y[j], candidates[j].demand_score)
    objective.SetMaximization()

    solver.SetTimeLimit(max_seconds * 1000)
    status = solver.Solve()

    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        raise RuntimeError(f"Solver failed with status {status}")

    selected = [candidates[i].id for i in range(n) if x[i].solution_value() > 0.5]
    total_coverage = sum(
        candidates[j].demand_score for j in range(n) if y[j].solution_value() > 0.5
    )

    return PlacementResult(
        selected_ids=selected,
        total_coverage=total_coverage,
        objective_value=solver.Objective().Value(),
    )
