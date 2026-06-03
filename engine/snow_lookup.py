"""Climate / snow table lookup for MVP (Ontario Table C-2 subset)."""
from __future__ import annotations

import json
import math
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json(name: str) -> dict | list:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def load_climate_table() -> dict:
    return _load_json("table-c2-ontario.json")


def load_code_editions() -> list:
    return _load_json("code-editions.json")


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def get_location_by_key(key: str) -> dict | None:
    table = load_climate_table()
    for loc in table["locations"]:
        if loc["key"] == key:
            return {**loc, "interpolated": False}
    return None


def resolve_location(
    location_key: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    """Resolve climate row by key or nearest city by coordinates."""
    if location_key:
        found = get_location_by_key(location_key)
        if found:
            return found

    table = load_climate_table()
    locations = table["locations"]
    if lat is None or lng is None:
        if locations:
            return {**locations[0], "interpolated": True, "note": "Defaulted to first table city"}
        raise ValueError("No climate data available")

    nearest = min(
        locations,
        key=lambda loc: haversine_km(lat, lng, loc["lat"], loc["lng"]),
    )
    dist = haversine_km(lat, lng, nearest["lat"], nearest["lng"])
    return {
        **nearest,
        "interpolated": True,
        "nearestDistanceKm": round(dist, 1),
        "note": f"Nearest Table C-2 city: {nearest['name']} ({dist:.1f} km)",
    }


def edition_for_year(year: int) -> dict:
    editions = load_code_editions()
    for ed in editions:
        if year <= ed["maxYear"]:
            return ed
    return editions[-1]
