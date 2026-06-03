#!/usr/bin/env python3
"""
Build data/table-c2-canada.json from PCIC Design Value Explorer exports.

Default layout (data/):
  pcic-table-c2-lat-long.csv   - Location, prov, Latitude, Longitude
  pcic-table-c2-SL50-Ss.csv    - SL50 (NBCC) = ground snow Ss (kPa)
  pcic-table-c2-RL50-Sr.csv    - RL50 (NBCC) = associated rain Sr (kPa)
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

DEFAULT_COORDS = DATA / "pcic-table-c2-lat-long.csv"
DEFAULT_SS = DATA / "pcic-table-c2-SL50-Ss.csv"
DEFAULT_SR = DATA / "pcic-table-c2-RL50-Sr.csv"
DEFAULT_OUT = DATA / "table-c2-canada.json"

# PCIC / NBC column names
SS_NBCC_COLUMNS = ("sl50 (nbcc)", "ss (nbcc)", "ss")
SS_FALLBACK_COLUMNS = ("sl50 (kpa)", "ss (kpa)")
SR_NBCC_COLUMNS = ("rl50 (nbcc)", "sr (nbcc)", "sr")
SR_FALLBACK_COLUMNS = ("rl50 (kpa)", "sr (kpa)")


def norm_name(name: str) -> str:
    """Legacy short name (strips parentheticals) - used only for CSV row matching."""
    s = re.sub(r"\([^)]*\)", "", str(name).lower())
    return re.sub(r"[^a-z0-9]", "", s)


def row_key(location: str, prov: str) -> str:
    return f"{norm_name(location)}|{prov.strip().upper()}"


def make_location_key(location: str, prov: str, seen: set[str]) -> str:
    """
    Unique slug for JSON / React keys. Keeps parenthetical disambiguators and province.
    e.g. 'Ottawa (Barrhaven)', ON -> ottawa_barrhaven_on
    """
    loc = str(location).strip()
    prov_slug = prov.strip().lower()
    segments: list[str] = []

    paren_match = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", loc)
    if paren_match:
        segments.append(paren_match.group(1))
        segments.append(paren_match.group(2))
    else:
        segments.append(loc)
    segments.append(prov_slug)

    slug = "_".join(
        re.sub(r"[^a-z0-9]+", "_", seg.lower()).strip("_")
        for seg in segments
        if seg
    )
    slug = re.sub(r"_+", "_", slug)

    key = slug
    n = 2
    while key in seen:
        key = f"{slug}_{n}"
        n += 1
    seen.add(key)
    return key


def load_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def pick_column(headers: list[str], primary: tuple[str, ...], fallback: tuple[str, ...]) -> str | None:
    normalized = {h: h.strip().lower() for h in headers}
    for h, hl in normalized.items():
        if hl in primary:
            return h
    for h, hl in normalized.items():
        if hl in fallback:
            return h
    for h, hl in normalized.items():
        if any(p.replace(" (nbcc)", "") in hl for p in primary):
            return h
    return None


def build_value_index(rows: list[dict], value_col: str) -> dict[str, float]:
    loc_col = next((h for h in rows[0] if "location" in h.lower()), "Location")
    prov_col = next((h for h in rows[0] if h.lower() in ("prov", "province")), "prov")
    index: dict[str, float] = {}
    for row in rows:
        loc = row.get(loc_col)
        if not loc:
            continue
        prov = (row.get(prov_col) or "").strip()
        try:
            index[row_key(loc, prov)] = float(row[value_col])
        except (TypeError, ValueError, KeyError):
            continue
    return index


def merge_climate_files(
    coords_rows: list[dict],
    ss_rows: list[dict],
    sr_rows: list[dict],
) -> list[dict]:
    ss_headers = list(ss_rows[0].keys())
    sr_headers = list(sr_rows[0].keys())

    ss_col = pick_column(ss_headers, SS_NBCC_COLUMNS, SS_FALLBACK_COLUMNS)
    sr_col = pick_column(sr_headers, SR_NBCC_COLUMNS, SR_FALLBACK_COLUMNS)

    if not ss_col:
        raise SystemExit(f"Could not find Ss column in snow file. Headers: {ss_headers}")
    if not sr_col:
        raise SystemExit(f"Could not find Sr column in rain file. Headers: {sr_headers}")

    print(f"Using Ss column: {ss_col!r}")
    print(f"Using Sr column: {sr_col!r}")

    ss_index = build_value_index(ss_rows, ss_col)
    sr_index = build_value_index(sr_rows, sr_col)

    locations: list[dict] = []
    seen_keys: set[str] = set()
    with_ss = 0
    missing_ss = 0

    for row in coords_rows:
        loc = row.get("Location") or row.get("location")
        if not loc:
            continue
        prov = (row.get("prov") or row.get("Province") or "").strip()
        try:
            lat = float(row.get("Latitude") or row.get("lat"))
            lng = float(row.get("Longitude") or row.get("lng"))
        except (TypeError, ValueError):
            continue

        key = row_key(loc, prov)
        ss = ss_index.get(key)
        sr = sr_index.get(key)

        entry = {
            "key": make_location_key(loc, prov, seen_keys),
            "name": str(loc).strip(),
            "province": prov,
            "lat": round(lat, 5),
            "lng": round(lng, 5),
        }

        if ss is not None:
            entry["ssKPa"] = round(ss, 3)
            entry["srKPa"] = round(sr if sr is not None else 0.0, 3)
            with_ss += 1
        else:
            missing_ss += 1

        locations.append(entry)

    print(f"Stations: {len(locations)}, with Ss/Sr: {with_ss}, missing Ss: {missing_ss}")
    if missing_ss:
        print(f"Warning: {missing_ss} stations had no Ss match in snow CSV", file=sys.stderr)

    return locations


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Table C-2 from PCIC CSV exports")
    parser.add_argument("--coords", type=Path, default=DEFAULT_COORDS, help="Lat/long file")
    parser.add_argument("--ss-csv", type=Path, default=DEFAULT_SS, help="SL50 / Ss file")
    parser.add_argument("--sr-csv", type=Path, default=DEFAULT_SR, help="RL50 / Sr file")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    for p, label in ((args.coords, "coords"), (args.ss_csv, "Ss"), (args.sr_csv, "Sr")):
        if not p.exists():
            raise SystemExit(f"Missing {label} file: {p}")

    coords_rows = load_csv(args.coords)
    ss_rows = load_csv(args.ss_csv)
    sr_rows = load_csv(args.sr_csv)

    locations = merge_climate_files(coords_rows, ss_rows, sr_rows)

    snow_blob = json.dumps(
        [(loc["key"], loc.get("ssKPa"), loc.get("srKPa")) for loc in locations],
        sort_keys=True,
    )
    climate_version = hashlib.sha256(snow_blob.encode()).hexdigest()[:16]

    payload = {
        "source": "PCIC Design Value Explorer (lat-long + SL50-Ss + RL50-Sr)",
        "climateVersion": climate_version,
        "coordsFile": args.coords.name,
        "ssFile": args.ss_csv.name,
        "srFile": args.sr_csv.name,
        "ssColumn": "SL50 (NBCC)",
        "srColumn": "RL50 (NBCC)",
        "locationCount": len(locations),
        "withSnowCount": sum(1 for x in locations if "ssKPa" in x),
        "locations": locations,
    }

    args.out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
