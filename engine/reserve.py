"""
MVP reserve capacity assessment (portfolio flowchart).

Implements a simplified deterministic model for demo purposes.
Calibrate safety factors and edition factors against NBC 2015 spreadsheet before production use.
"""
from __future__ import annotations

from snow_lookup import edition_for_year, resolve_location

# Commentary L — reliability index adjustment (simplified MVP)
# Calibrate these against NBC 2015 spreadsheet before client use.
RELIABILITY_STEP = 0.08
# Flowchart: conventional safety on historic capacity vs adjusted safety on current demand
HISTORIC_SAFETY_BASE = 1.2
CURRENT_SAFETY_BASE = 1.05


def _commentary_l_factor(is_wood: bool, satisfactory_performance: bool) -> tuple[float, list[str]]:
    steps = []
    delta = 0.0
    if is_wood:
        delta += RELIABILITY_STEP
        steps.append("Commentary L: high-risk / wood structure (+1 reliability index → higher load factor)")
    if satisfactory_performance:
        delta -= RELIABILITY_STEP
        steps.append("Commentary L: record of satisfactory performance (-1 reliability index)")
    factor = CURRENT_SAFETY_BASE + delta
    return factor, steps


def assess_reserve(site: dict) -> dict:
    """
    Site input fields:
      constructionYear, locationKey, lat, lng,
      replaceBallastedWithAdhered, isWoodStructure, satisfactoryPerformance,
      roofWeightExistingKPa, roofWeightNewKPa
    """
    year = int(site.get("constructionYear") or 2000)
    edition = edition_for_year(year)
    climate = resolve_location(
        site.get("locationKey"),
        site.get("lat"),
        site.get("lng"),
    )

    ss = float(climate["ssKPa"])
    edition_factor = float(edition["snowLoadFactor"])

    # Original design snow at time of construction (historic code factor on Ss)
    original_design_snow_kpa = round(ss * edition_factor, 3)
    factored_historic = round(original_design_snow_kpa * HISTORIC_SAFETY_BASE, 3)

    # Current code snow + Commentary L adjusted safety
    current_design_snow_kpa = round(ss * float(edition_for_year(2026)["snowLoadFactor"]), 3)
    actual_safety, commentary_steps = _commentary_l_factor(
        bool(site.get("isWoodStructure")),
        bool(site.get("satisfactoryPerformance")),
    )
    factored_actual_snow = round(current_design_snow_kpa * actual_safety, 3)

    use_lighter = bool(site.get("replaceBallastedWithAdhered"))
    roof_kpa = float(
        site.get("roofWeightNewKPa" if use_lighter else "roofWeightExistingKPa") or 0.3
    )

    # Total demand on reserve: current factored snow + roof weight
    total_actual_demand = round(factored_actual_snow + roof_kpa, 3)
    pass_assessment = factored_historic > total_actual_demand
    delta_kpa = round(factored_historic - total_actual_demand, 3)

    trail = [
        f"Construction year {year} → {edition['code']}",
        f"Climate station: {climate['name']}" + (
            f" (interpolated, {climate.get('nearestDistanceKm')} km)" if climate.get("interpolated") else ""
        ),
        f"Ground snow Ss = {ss} kPa (Table C-2 subset)",
        f"Original design snow = Ss × edition factor {edition_factor} = {original_design_snow_kpa} kPa",
        f"Factored historic load = {original_design_snow_kpa} × {HISTORIC_SAFETY_BASE} = {factored_historic} kPa",
        f"Current design snow (NBC 2015 factor) = {current_design_snow_kpa} kPa",
        *commentary_steps,
        f"Adjusted safety factor (current) = {actual_safety}",
        f"Factored actual snow = {factored_actual_snow} kPa",
        f"Roof weight used = {roof_kpa} kPa ({'new lighter' if use_lighter else 'existing'})",
        f"Compare: factored historic ({factored_historic}) vs actual demand ({total_actual_demand})",
    ]

    return {
        "pass": pass_assessment,
        "deltaKPa": delta_kpa,
        "factoredHistoricKPa": factored_historic,
        "factoredActualKPa": factored_actual_snow,
        "roofWeightKPa": roof_kpa,
        "totalActualDemandKPa": total_actual_demand,
        "originalDesignCode": edition["code"],
        "climateLocation": climate["name"],
        "climateInterpolated": bool(climate.get("interpolated")),
        "originalDesignSnowKPa": original_design_snow_kpa,
        "currentDesignSnowKPa": current_design_snow_kpa,
        "trail": trail,
        "disclaimer": "MVP simplified model — verify against NBC 2015 spreadsheet and stamped analysis.",
    }
