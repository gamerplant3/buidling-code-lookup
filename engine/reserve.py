"""
Portfolio reserve capacity assessment using NBC 2015 specified snow loads.

Historic side uses construction-era Ss factor on ground snow; current side uses full NBC 2015 calc.
Commentary L reliability adjustments apply to the current demand side (MVP simplification).
"""

from __future__ import annotations

from nbc2015.snow_load import specified_snow_load
from snow_lookup import edition_for_year, resolve_location

RELIABILITY_STEP = 0.08
HISTORIC_SAFETY_BASE = 1.2
CURRENT_SAFETY_BASE = 1.05
TRAIL_DECIMALS = 3


def _fmt(value: float) -> str:
    """Format numbers for trail display (max 3 decimal places)."""
    return f"{round(float(value), TRAIL_DECIMALS):.{TRAIL_DECIMALS}f}"


def _roof_inputs(site: dict) -> dict:
    imp = (site.get("importance") or "normal").lower().replace("-", "_").replace(" ", "_")
    if imp in ("postdisaster", "post_disaster"):
        imp = "post_disaster"
    cw = (site.get("cwReduction") or "none").lower()
    return {
        "roof_l_m": float(site.get("roofLM") or site.get("roof_l_m") or 14.0),
        "roof_w_m": float(site.get("roofWM") or site.get("roof_w_m") or 9.5),
        "roof_slope_deg": float(site.get("roofSlopeDeg") or site.get("roof_slope_deg") or 0),
        "slippery": bool(site.get("roofSlippery") or site.get("slippery")),
        "importance": imp,
        "cw_reduction": cw if cw in ("none", "rural", "exposed_treeline") else "none",
    }


def _commentary_l_factor(is_wood: bool, satisfactory_performance: bool) -> tuple[float, list[str]]:
    delta = 0.0
    steps: list[str] = []
    if is_wood:
        delta += RELIABILITY_STEP
        steps.append("Commentary L: wood / high-risk (+1 reliability index)")
    if satisfactory_performance:
        delta -= RELIABILITY_STEP
        steps.append("Commentary L: satisfactory performance (−1 reliability index)")
    return round(CURRENT_SAFETY_BASE + delta, TRAIL_DECIMALS), steps


def _historic_ss(ss: float, year: int) -> tuple[float, str, str]:
    edition = edition_for_year(year)
    factor = float(edition["snowLoadFactor"])
    note = edition.get("note") or ""
    return round(ss * factor, TRAIL_DECIMALS), edition["code"], note


def assess_reserve(site: dict) -> dict:
    year = int(site.get("constructionYear") or 2000)
    climate = resolve_location(
        site.get("locationKey"),
        site.get("lat"),
        site.get("lng"),
        site.get("elevationM"),
    )

    ss = float(climate["ssKPa"])
    sr = float(climate.get("srKPa") or 0.0)
    roof = _roof_inputs(site)

    historic_ss, historic_code, edition_note = _historic_ss(ss, year)
    edition = edition_for_year(year)
    historic = specified_snow_load(
        historic_ss,
        sr,
        limit_state="uls",
        **roof,
    )
    factored_historic = round(historic.s_kpa * HISTORIC_SAFETY_BASE, TRAIL_DECIMALS)

    current = specified_snow_load(ss, sr, limit_state="uls", **roof)
    actual_safety, commentary_steps = _commentary_l_factor(
        bool(site.get("isWoodStructure")),
        bool(site.get("satisfactoryPerformance")),
    )
    factored_actual_snow = round(current.s_kpa * actual_safety, TRAIL_DECIMALS)

    use_lighter = bool(site.get("replaceBallastedWithAdhered"))
    roof_kpa = round(
        float(site.get("roofWeightNewKPa" if use_lighter else "roofWeightExistingKPa") or 0.3),
        TRAIL_DECIMALS,
    )

    total_actual_demand = round(factored_actual_snow + roof_kpa, TRAIL_DECIMALS)
    pass_assessment = factored_historic > total_actual_demand
    delta_kpa = round(factored_historic - total_actual_demand, TRAIL_DECIMALS)

    climate_line = (
        f"Climate: {climate.get('name')}"
        + (f" ({climate.get('note')})" if climate.get("note") else "")
        + (
            f" [{climate.get('method')}, {climate.get('confidence', 'n/a')} confidence]"
            if climate.get("interpolated")
            else (f" [{climate.get('method')}]" if climate.get("method") else "")
        )
    )

    trail_lookup = [
        f"Construction year {year} → {historic_code}",
        f"Historic snow provision: Ss × {_fmt(edition['snowLoadFactor'])} ({edition_note})",
        climate_line,
        f"Ground snow Ss = {_fmt(ss)} kPa, Sr = {_fmt(sr)} kPa (PCIC NBCC SL50 / RL50)",
    ]
    if climate.get("neighbors"):
        trail_lookup.append(
            "IDW neighbors: "
            + ", ".join(
                f"{n['name']} ({n['distanceKm']} km, w={n['weight']})"
                for n in climate["neighbors"][:4]
            )
        )

    trail_calc = [
        historic.trail[0],
        f"Historic Ss (edition factor) = {_fmt(historic_ss)} kPa → S = {_fmt(historic.s_kpa)} kPa",
        f"Factored historic capacity = {_fmt(historic.s_kpa)} × {_fmt(HISTORIC_SAFETY_BASE)} = {_fmt(factored_historic)} kPa",
        f"lc = {_fmt(current.lc_m)} m",
        f"Cb = {_fmt(current.cb)}, Cw = {current.cw}, Cs = {_fmt(current.cs)}, Ca = {_fmt(current.ca)}",
        f"Is (ULS) = {_fmt(current.is_factor)}",
        f"S (ULS) = {_fmt(current.s_kpa)} kPa",
        *commentary_steps,
        f"Adjusted safety factor (current demand) = {_fmt(actual_safety)}",
        f"Factored actual snow = {_fmt(current.s_kpa)} × {_fmt(actual_safety)} = {_fmt(factored_actual_snow)} kPa",
        f"Roof weight = {_fmt(roof_kpa)} kPa ({'new lighter' if use_lighter else 'existing'})",
        f"Reserve check: historic {_fmt(factored_historic)} kPa vs total demand {_fmt(total_actual_demand)} kPa",
    ]

    trail = [*trail_lookup, *trail_calc]

    assessment_case = {
        "label": "Flat roof - uniform load sample",
        "standard": "NBC 2015 §4.1.6.2",
        "roofLM": roof["roof_l_m"],
        "roofWM": roof["roof_w_m"],
        "roofSlopeDeg": roof["roof_slope_deg"],
        "ca": 1.0,
        "note": "Simple gable/uniform case with Ca = 1. Not for drift, sliding, or multi-level roofs.",
    }

    source_refs = [
        {
            "id": "pcic-table-c2",
            "label": "PCIC Design Value Explorer (NBCC SL50-Ss, RL50-Sr)",
        },
        {
            "id": "nbc-2015-4.1.6.2",
            "label": "NBC 2015 specified snow load (4.1.6.2)",
        },
        {
            "id": "code-editions-historic",
            "label": "Historic NBC snow provisions (data/code-editions.json)",
        },
    ]

    return {
        "pass": pass_assessment,
        "deltaKPa": delta_kpa,
        "factoredHistoricKPa": factored_historic,
        "factoredActualKPa": factored_actual_snow,
        "roofWeightKPa": roof_kpa,
        "totalActualDemandKPa": total_actual_demand,
        "specifiedSnowHistoricKPa": historic.s_kpa,
        "specifiedSnowCurrentKPa": current.s_kpa,
        "originalDesignCode": historic_code,
        "climateLocation": climate.get("name"),
        "climateInterpolated": bool(climate.get("interpolated")),
        "climateMethod": climate.get("method"),
        "climateConfidence": climate.get("confidence"),
        "ssKPa": ss,
        "srKPa": sr,
        "cb": current.cb,
        "cw": current.cw,
        "cs": current.cs,
        "historicEditionNote": edition_note,
        "trail": trail,
        "trailLookup": trail_lookup,
        "trailCalc": trail_calc,
        "assessmentCase": assessment_case,
        "sourceRefs": source_refs,
        "disclaimer": (
            "Note: flat/uniform roof (Ca=1), historic factors and Commentary L steps are simplified."
        ),
    }
