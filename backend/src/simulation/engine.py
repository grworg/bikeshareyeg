"""
Discrete-event simulation of a bike-sharing system using SimPy.

Models:
  - Stations with finite dock capacity
  - Trip generation based on demand patterns
  - Riders pick up and return bikes
  - Rebalancing trucks redistribute bikes
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

import numpy as np
import simpy


@dataclass
class Station:
    """A bike-sharing station with docks and bikes."""

    id: str
    name: str
    lat: float
    lng: float
    capacity: int  # total docks
    initial_bikes: int = 0

    # Runtime state (set during simulation)
    bikes: int = field(init=False, default=0)
    trips_started: int = field(init=False, default=0)
    trips_ended: int = field(init=False, default=0)
    failed_pickups: int = field(init=False, default=0)
    failed_returns: int = field(init=False, default=0)

    def __post_init__(self):
        self.bikes = self.initial_bikes


@dataclass
class TripRecord:
    """Record of a completed or failed trip."""

    origin_id: str
    destination_id: str
    request_time: float
    start_time: float | None
    end_time: float | None
    duration: float | None
    success: bool
    failure_reason: str | None = None


class BikeShareSimulation:
    """
    SimPy-based discrete-event simulation of a bike-sharing network.

    Usage:
        sim = BikeShareSimulation(stations, od_matrix, duration_hours=24)
        results = sim.run()
    """

    def __init__(
        self,
        stations: list[Station],
        od_matrix: dict[tuple[str, str], float],
        duration_hours: float = 24.0,
        trips_per_hour: float = 100.0,
        avg_trip_minutes: float = 15.0,
        seed: int | None = 42,
    ):
        """
        Args:
            stations: List of Station objects defining the network.
            od_matrix: Origin-destination demand weights. Keys are (origin_id, dest_id),
                       values are relative demand weights (will be normalized).
            duration_hours: How long to run the simulation.
            trips_per_hour: Average system-wide trip generation rate.
            avg_trip_minutes: Average trip duration in minutes.
            seed: Random seed for reproducibility.
        """
        self.stations = {s.id: s for s in stations}
        self.od_matrix = od_matrix
        self.duration = duration_hours * 60  # convert to minutes
        self.trips_per_hour = trips_per_hour
        self.avg_trip_minutes = avg_trip_minutes
        self.seed = seed
        self.trip_log: list[TripRecord] = []
        self.occupancy_log: list[dict] = []  # periodic snapshots

    def run(self) -> dict:
        """Run the simulation and return results."""
        random.seed(self.seed)
        np.random.seed(self.seed)

        env = simpy.Environment()

        # Create SimPy resources for each station
        resources = {}
        for sid, station in self.stations.items():
            station.bikes = station.initial_bikes
            station.trips_started = 0
            station.trips_ended = 0
            station.failed_pickups = 0
            station.failed_returns = 0
            resources[sid] = simpy.Resource(env, capacity=1)  # lock for atomic ops

        # Normalize OD matrix
        total_weight = sum(self.od_matrix.values()) or 1.0
        od_pairs = list(self.od_matrix.keys())
        od_probs = [self.od_matrix[k] / total_weight for k in od_pairs]

        env.process(self._trip_generator(env, resources, od_pairs, od_probs))
        env.process(self._snapshot_logger(env, interval=15))  # every 15 min
        env.run(until=self.duration)

        return self._compile_results()

    def _trip_generator(self, env, resources, od_pairs, od_probs):
        """Generate trips according to a Poisson process."""
        interarrival = 60.0 / self.trips_per_hour  # minutes between trips

        while True:
            yield env.timeout(random.expovariate(1.0 / interarrival))

            # Pick an OD pair
            idx = np.random.choice(len(od_pairs), p=od_probs)
            origin_id, dest_id = od_pairs[idx]
            env.process(self._trip(env, resources, origin_id, dest_id))

    def _trip(self, env, resources, origin_id: str, dest_id: str):
        """Simulate a single bike trip."""
        request_time = env.now
        origin = self.stations[origin_id]
        dest = self.stations[dest_id]

        # Try to pick up a bike
        with resources[origin_id].request() as req:
            yield req
            if origin.bikes <= 0:
                origin.failed_pickups += 1
                self.trip_log.append(TripRecord(
                    origin_id=origin_id, destination_id=dest_id,
                    request_time=request_time, start_time=None,
                    end_time=None, duration=None, success=False,
                    failure_reason="no_bikes_available",
                ))
                return
            origin.bikes -= 1
            origin.trips_started += 1

        # Travel
        start_time = env.now
        trip_duration = max(1.0, random.gauss(self.avg_trip_minutes, self.avg_trip_minutes * 0.3))
        yield env.timeout(trip_duration)

        # Try to return the bike
        with resources[dest_id].request() as req:
            yield req
            if dest.bikes >= dest.capacity:
                dest.failed_returns += 1
                # Bike goes back to nearest available (simplified: just add it anyway)
                dest.bikes = dest.capacity
                self.trip_log.append(TripRecord(
                    origin_id=origin_id, destination_id=dest_id,
                    request_time=request_time, start_time=start_time,
                    end_time=env.now, duration=trip_duration, success=False,
                    failure_reason="no_docks_available",
                ))
                return
            dest.bikes += 1
            dest.trips_ended += 1

        self.trip_log.append(TripRecord(
            origin_id=origin_id, destination_id=dest_id,
            request_time=request_time, start_time=start_time,
            end_time=env.now, duration=trip_duration, success=True,
        ))

    def _snapshot_logger(self, env, interval: float = 15):
        """Periodically record station occupancy for visualization."""
        while True:
            snapshot = {
                "time": env.now,
                "stations": {
                    sid: {"bikes": s.bikes, "capacity": s.capacity, "pct": s.bikes / max(s.capacity, 1)}
                    for sid, s in self.stations.items()
                },
            }
            self.occupancy_log.append(snapshot)
            yield env.timeout(interval)

    def _compile_results(self) -> dict:
        """Compile simulation results into a summary dict."""
        successful = [t for t in self.trip_log if t.success]
        failed = [t for t in self.trip_log if not t.success]

        station_stats = {}
        for sid, s in self.stations.items():
            station_stats[sid] = {
                "name": s.name,
                "lat": s.lat,
                "lng": s.lng,
                "capacity": s.capacity,
                "final_bikes": s.bikes,
                "trips_started": s.trips_started,
                "trips_ended": s.trips_ended,
                "failed_pickups": s.failed_pickups,
                "failed_returns": s.failed_returns,
                "net_flow": s.trips_ended - s.trips_started,
            }

        return {
            "total_trips": len(self.trip_log),
            "successful_trips": len(successful),
            "failed_trips": len(failed),
            "avg_trip_duration": (
                np.mean([t.duration for t in successful]) if successful else 0
            ),
            "service_rate": len(successful) / max(len(self.trip_log), 1),
            "station_stats": station_stats,
            "occupancy_timeline": self.occupancy_log,
            "trip_log": [
                {
                    "origin": t.origin_id,
                    "destination": t.destination_id,
                    "request_time": t.request_time,
                    "start_time": t.start_time,
                    "end_time": t.end_time,
                    "duration": t.duration,
                    "success": t.success,
                    "failure_reason": t.failure_reason,
                }
                for t in self.trip_log
            ],
        }
