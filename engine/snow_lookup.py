"""Climate / snow table lookup - Table C-2 Canada + IDW interpolation."""
from __future__ import annotations

import json
import math
from pathlib import Path

from interpolation import interpolate_climate

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TABLE_FILE = DATA_DIR / "table-c2-canada.json"


def _load_json(name: str) -> dict | list:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def load_code_editions() -> list:
    return _load_json("code-editions.json")


def load_climate_table() -> dict:
    if not TABLE_FILE.exists():
        raise FileNotFoundError(
            f"Missing {TABLE_FILE.name}. Run: python scripts/import_pcic_table_c2.py"
        )
    return json.loads(TABLE_FILE.read_text(encoding="utf-8"))


def stations_with_snow(table: dict | None = None) -> list[dict]:
    table = table or load_climate_table()
    return [loc for loc in table.get("locations", []) if loc.get("ssKPa") is not None]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def get_location_by_key(key: str) -> dict | None:
    if not key:
        return None
    table = load_climate_table()
    for loc in table["locations"]:
        if loc.get("key") == key:
            return {**loc, "interpolated": False, "method": "exact"}
    return None


# Coordinates within this distance of a Table C-2 row use that station (not IDW).
EXACT_MATCH_KM = 2.0
NEAREST_STATION_SNAP_KM = 30.0


def _nearest_station(
    lat: float, lng: float, stations: list[dict]
) -> tuple[dict | None, float]:
    best = None
    best_d = float("inf")
    for loc in stations:
        if loc.get("ssKPa") is None:
            continue
        d = haversine_km(lat, lng, loc["lat"], loc["lng"])
        if d < best_d:
            best_d = d
            best = loc
    return best, best_d


def _station_at_coordinates(
    lat: float, lng: float, table: dict, tolerance_km: float
) -> dict | None:
    station, dist = _nearest_station(lat, lng, table.get("locations", []))
    if station is None or dist > tolerance_km:
        return None
    result = {
        **station,
        "interpolated": False,
        "method": "exact" if dist <= EXACT_MATCH_KM else "nearest",
        "nearestDistanceKm": round(dist, 2),
    }
    if dist > EXACT_MATCH_KM:
        result["note"] = f"Snapped to nearest Table C-2 station ({round(dist, 1)} km)"
    return result


def nearest_climate_station(
    lat: float, lng: float, max_km: float = NEAREST_STATION_SNAP_KM
) -> dict | None:
    """Nearest Table C-2 row with snow data, for geocode → locationKey assignment."""
    table = load_climate_table()
    station, dist = _nearest_station(lat, lng, stations_with_snow(table))
    if station is None or dist > max_km:
        return None
    return {
        "key": station["key"],
        "name": station["name"],
        "province": station.get("province"),
        "lat": station["lat"],
        "lng": station["lng"],
        "ssKPa": station.get("ssKPa"),
        "srKPa": station.get("srKPa"),
        "distanceKm": round(dist, 2),
        "method": "exact" if dist <= EXACT_MATCH_KM else "nearest",
    }


def resolve_location(
    location_key: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    elevation_m: float | None = None,
) -> dict:
    """
    Resolve climate data:
      1. Explicit location key (Table C-2 row)
      2. Nearest listed station within NEAREST_STATION_SNAP_KM (official Ss/Sr, not IDW)
      3. IDW only when no Table C-2 station is close enough
    """
    table = load_climate_table()
    anchors = stations_with_snow(table)

    if location_key:
        found = get_location_by_key(location_key)
        if found and found.get("ssKPa") is not None:
            return found

    if lat is not None and lng is not None:
        snapped = _station_at_coordinates(lat, lng, table, NEAREST_STATION_SNAP_KM)
        if snapped:
            return snapped

        interp = interpolate_climate(lat, lng, anchors, elevation_m=elevation_m)
        nearest = anchors[0] if not anchors else min(
            anchors, key=lambda s: haversine_km(lat, lng, s["lat"], s["lng"])
        )
        return {
            **interp,
            "name": f"Interpolated ({lat:.4f}, {lng:.4f})",
            "key": None,
            "province": nearest.get("province"),
            "lat": lat,
            "lng": lng,
            "note": f"IDW from {len(interp.get('neighbors', []))} Table C-2 stations)",
        }

    if anchors:
        return {**anchors[0], "interpolated": True, "note": "Defaulted - provide lat/lng or locationKey"}

    raise ValueError("No climate data available")


def edition_for_year(year: int) -> dict:
    editions = load_code_editions()
    for ed in editions:
        if year <= ed["maxYear"]:
            return ed
    return editions[-1]
