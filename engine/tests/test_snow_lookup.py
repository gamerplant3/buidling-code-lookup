"""Climate resolution: nearest station vs IDW."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))

from snow_lookup import resolve_location, NEAREST_STATION_SNAP_KM


def test_thunder_bay_coords_snap_to_nearest_c2_station():
    """Coords near but not on C-2 row should snap to Thunder Bay, not IDW."""
    climate = resolve_location(
        location_key=None,
        lat=48.382,
        lng=-89.247,
    )
    assert climate["name"] == "Thunder Bay"
    assert climate["method"] in ("exact", "nearest")
    assert climate.get("interpolated") is False
    assert climate["ssKPa"] == 2.9
    assert climate["nearestDistanceKm"] < NEAREST_STATION_SNAP_KM


def test_thunder_bay_by_key_always_exact():
    climate = resolve_location(location_key="thunder_bay_on", lat=48.382, lng=-89.247)
    assert climate["name"] == "Thunder Bay"
    assert climate["method"] == "exact"
    assert climate["ssKPa"] == 2.9


def test_leamington_old_demo_coords_snap():
    climate = resolve_location(location_key="leamington_on", lat=42.05, lng=-82.6)
    assert climate["name"] == "Leamington"
    assert climate.get("interpolated") is False
    assert climate["ssKPa"] == 0.8


def test_demo_idw_site_no_location_key():
    """Rural coords from demo-sites.json demo-4 - beyond 30 km snap."""
    climate = resolve_location(location_key=None, lat=47.0, lng=-80.5)
    assert climate.get("interpolated") is True
    assert climate.get("method") == "idw"
    assert climate.get("neighbors")
