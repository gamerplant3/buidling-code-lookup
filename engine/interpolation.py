"""Inverse-distance weighting for Table C-2 climatic variables."""
from __future__ import annotations

import math
from typing import Any

EARTH_RADIUS_KM = 6371.0

# IDW defaults (tune after comparing to PCIC map-point values)
DEFAULT_K_NEIGHBORS = 6
DEFAULT_POWER = 2.0
DEFAULT_MAX_RADIUS_KM = 250.0
ELEVATION_LAPSE_SS = 0.08  # +8% Ss per 100 m vs reference elevation


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _idw_value(
    target_lat: float,
    target_lng: float,
    stations: list[dict],
    field: str,
    *,
    k: int = DEFAULT_K_NEIGHBORS,
    power: float = DEFAULT_POWER,
    max_radius_km: float = DEFAULT_MAX_RADIUS_KM,
    target_elevation_m: float | None = None,
    elevation_field: str = "elevationM",
    apply_elevation_lapse: bool = False,
) -> tuple[float | None, list[dict]]:
    """Return interpolated scalar and neighbor metadata."""
    candidates: list[tuple[float, dict]] = []
    for st in stations:
        val = st.get(field)
        if val is None:
            continue
        dist = haversine_km(target_lat, target_lng, st["lat"], st["lng"])
        if dist <= max_radius_km:
            candidates.append((dist, st))

    if not candidates:
        return None, []

    candidates.sort(key=lambda x: x[0])
    picked = candidates if len(candidates) <= k else candidates[:k]

    if picked[0][0] == 0:
        st = picked[0][1]
        return float(st[field]), [
            {
                "name": st.get("name"),
                "distanceKm": 0.0,
                "weight": 1.0,
                field: st.get(field),
            }
        ]

    weights = [1.0 / (max(d, 0.05) ** power) for d, _ in picked]
    wsum = sum(weights)
    value = sum(w * float(st[field]) for w, (_, st) in zip(weights, picked)) / wsum

    if apply_elevation_lapse and target_elevation_m is not None and field == "ssKPa":
        ref_elev = sum(w * float(st.get(elevation_field) or 0) for w, (_, st) in zip(weights, picked)) / wsum
        if ref_elev:
            lapse = 1.0 + ELEVATION_LAPSE_SS * ((target_elevation_m - ref_elev) / 100.0)
            value *= lapse

    neighbors = [
        {
            "name": st.get("name"),
            "distanceKm": round(dist, 2),
            "weight": round(w / wsum, 4),
            field: st.get(field),
        }
        for w, (dist, st) in zip(weights, picked)
    ]
    return round(value, 4), neighbors


def interpolate_climate(
    lat: float,
    lng: float,
    stations: list[dict],
    *,
    elevation_m: float | None = None,
    k: int = DEFAULT_K_NEIGHBORS,
    max_radius_km: float = DEFAULT_MAX_RADIUS_KM,
) -> dict[str, Any]:
    """Interpolate Ss and Sr at a point from Table C-2 stations with known values."""
    ss, ss_neighbors = _idw_value(
        lat,
        lng,
        stations,
        "ssKPa",
        k=k,
        max_radius_km=max_radius_km,
        target_elevation_m=elevation_m,
        apply_elevation_lapse=True,
    )
    sr, sr_neighbors = _idw_value(
        lat,
        lng,
        stations,
        "srKPa",
        k=k,
        max_radius_km=max_radius_km,
    )

    if ss is None:
        raise ValueError("No Table C-2 stations with Ss within search radius")

    nearest_km = ss_neighbors[0]["distanceKm"] if ss_neighbors else None
    confidence = "high"
    if nearest_km is not None:
        if nearest_km > 100:
            confidence = "low"
        elif nearest_km > 50:
            confidence = "medium"

    return {
        "ssKPa": ss,
        "srKPa": sr if sr is not None else 0.0,
        "interpolated": True,
        "method": "idw",
        "confidence": confidence,
        "nearestDistanceKm": nearest_km,
        "neighbors": ss_neighbors,
        "elevationM": elevation_m,
    }
