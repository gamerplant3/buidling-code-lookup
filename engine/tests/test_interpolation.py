"""Tests for IDW climate interpolation."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))

from interpolation import interpolate_climate, haversine_km


def test_haversine_toronto_london():
    d = haversine_km(43.65, -79.38, 42.98, -81.23)
    assert 160 < d < 200


def test_idw_between_two_stations():
    stations = [
        {"name": "A", "lat": 43.0, "lng": -80.0, "ssKPa": 2.0, "srKPa": 0.4, "elevationM": 200},
        {"name": "B", "lat": 44.0, "lng": -80.0, "ssKPa": 3.0, "srKPa": 0.4, "elevationM": 200},
    ]
    mid = interpolate_climate(43.5, -80.0, stations)
    assert 2.0 < mid["ssKPa"] < 3.0
    assert mid["interpolated"] is True
    assert len(mid["neighbors"]) >= 2
