"""
NBC 2015 specified snow load - Article 4.1.6.2 (flat / simple gable, uniform case Ca=1).

References: NBC 2015 Part 4
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

LimitState = Literal["uls", "sls"]
Importance = Literal["low", "normal", "high", "post_disaster"]
CwReduction = Literal["none", "rural", "exposed_treeline"]

IS_TABLE = {
    "low": {"uls": 0.8, "sls": 0.9},
    "normal": {"uls": 1.0, "sls": 0.9},
    "high": {"uls": 1.15, "sls": 0.9},
    "post_disaster": {"uls": 1.25, "sls": 0.9},
}

CB_TABLE_LC_CW2 = [
    (70, {1.0: 0.80, 0.75: 0.80, 0.5: 0.80}),
    (80, {1.0: 0.82, 0.75: 0.85, 0.5: 0.91}),
    (100, {1.0: 0.85, 0.75: 0.94, 0.5: 1.11}),
    (120, {1.0: 0.88, 0.75: 1.01, 0.5: 1.27}),
    (140, {1.0: 0.90, 0.75: 1.07, 0.5: 1.40}),
    (160, {1.0: 0.92, 0.75: 1.12, 0.5: 1.51}),
    (180, {1.0: 0.93, 0.75: 1.16, 0.5: 1.60}),
    (200, {1.0: 0.95, 0.75: 1.19, 0.5: 1.67}),
    (240, {1.0: 0.96, 0.75: 1.24, 0.5: 1.78}),
    (280, {1.0: 0.98, 0.75: 1.27, 0.5: 1.85}),
    (320, {1.0: 0.98, 0.75: 1.29, 0.5: 1.90}),
    (400, {1.0: 0.99, 0.75: 1.31, 0.5: 1.96}),
    (580, {1.0: 1.00, 0.75: 1.33, 0.5: 1.99}),
]

SNOW_GAMMA = 4.0  # kN/m³ per 4.1.6.13 (workbook uses ~2.64 kPa/m - we use code γ for Cb threshold)


def importance_factor(importance: Importance, limit_state: LimitState = "uls") -> float:
    return IS_TABLE[importance][limit_state]


def characteristic_length(l_m: float, w_m: float) -> float:
    """lc = 2w - w²/l (4.1.6.2(2))."""
    if l_m <= 0 or w_m <= 0:
        raise ValueError("Roof plan dimensions l and w must be positive")
    if w_m > l_m:
        l_m, w_m = w_m, l_m
    return 2.0 * w_m - (w_m * w_m) / l_m


def _interp_cb_table(lc_cw2: float, cw: float) -> float:
    cw_key = min(CB_TABLE_LC_CW2[0][1].keys(), key=lambda c: abs(c - cw))
    if lc_cw2 <= CB_TABLE_LC_CW2[0][0]:
        return CB_TABLE_LC_CW2[0][1][cw_key]
    for i in range(len(CB_TABLE_LC_CW2) - 1):
        x0, row0 = CB_TABLE_LC_CW2[i]
        x1, row1 = CB_TABLE_LC_CW2[i + 1]
        if lc_cw2 <= x1:
            y0, y1 = row0[cw_key], row1[cw_key]
            if x1 == x0:
                return y0
            t = (lc_cw2 - x0) / (x1 - x0)
            return y0 + t * (y1 - y0)
    return CB_TABLE_LC_CW2[-1][1][cw_key]


def calc_cb(l_m: float, w_m: float, cw: float) -> float:
    lc = characteristic_length(l_m, w_m)
    threshold = 70.0 / (cw * cw)
    if lc <= threshold:
        return 0.8
    lc_cw2 = lc * cw * cw
    return (1.0 / cw) * (1.0 - (1.0 - 0.8 * cw) * math.exp(-(lc_cw2 - 70.0) / 100.0))


def calc_cw(
    importance: Importance,
    reduction: CwReduction = "none",
) -> float:
    cw = 1.0
    if importance in ("low", "normal"):
        if reduction == "rural":
            cw = 0.75
        elif reduction == "exposed_treeline":
            cw = 0.5
    return cw


def calc_cs(roof_slope_deg: float, slippery: bool = False) -> float:
    alpha = roof_slope_deg
    if slippery:
        if alpha <= 15:
            return 1.0
        if alpha >= 60:
            return 0.0
        return (60.0 - alpha) / 45.0
    if alpha <= 30:
        return 1.0
    if alpha >= 70:
        return 0.0
    return (70.0 - alpha) / 40.0


def effective_sr(ss: float, sr: float, cb: float, cw: float, cs: float, ca: float = 1.0) -> float:
    cap = ss * cb * cw * cs * ca
    return min(sr, cap)


@dataclass
class SnowLoadResult:
    s_kpa: float
    limit_state: LimitState
    is_factor: float
    cb: float
    cw: float
    cs: float
    ca: float
    ss_kpa: float
    sr_kpa: float
    lc_m: float
    formula: str
    trail: list[str]


def specified_snow_load(
    ss_kpa: float,
    sr_kpa: float,
    *,
    roof_l_m: float,
    roof_w_m: float,
    roof_slope_deg: float = 0.0,
    slippery: bool = False,
    importance: Importance = "normal",
    cw_reduction: CwReduction = "none",
    ca: float = 1.0,
    limit_state: LimitState = "uls",
    cb_override: float | None = None,
    cw_override: float | None = None,
) -> SnowLoadResult:
    """
    S = Is [Ss (Cb Cw Cs Ca) + Sr], Sr capped per 4.1.6.2(1).
    Uniform load case: Ca = 1.0 (4.1.6.2(8)).
    """
    is_factor = importance_factor(importance, limit_state)
    cw = cw_override if cw_override is not None else calc_cw(importance, cw_reduction)
    cb = cb_override if cb_override is not None else calc_cb(roof_l_m, roof_w_m, cw)
    cs = calc_cs(roof_slope_deg, slippery)
    sr_eff = effective_sr(ss_kpa, sr_kpa, cb, cw, cs, ca)
    lc = characteristic_length(roof_l_m, roof_w_m)

    snow_term = ss_kpa * cb * cw * cs * ca
    s_kpa = is_factor * (snow_term + sr_eff)

    trail = [
        f"S = Is [Ss(Cb·Cw·Cs·Ca) + Sr]  (NBC 2015 4.1.6.2)",
        f"Ss = {ss_kpa} kPa, Sr = {sr_kpa} kPa (effective Sr = {round(sr_eff, 3)} kPa)",
        f"lc = 2w − w²/l = {round(lc, 3)} m",
        f"Cb = {round(cb, 4)}, Cw = {cw}, Cs = {round(cs, 4)}, Ca = {ca}",
        f"Is ({limit_state.upper()}) = {is_factor}",
        f"S ({limit_state.upper()}) = {round(s_kpa, 4)} kPa",
    ]

    return SnowLoadResult(
        s_kpa=round(s_kpa, 4),
        limit_state=limit_state,
        is_factor=is_factor,
        cb=round(cb, 4),
        cw=cw,
        cs=round(cs, 4),
        ca=ca,
        ss_kpa=ss_kpa,
        sr_kpa=sr_eff,
        lc_m=round(lc, 4),
        formula="S = Is [Ss (Cb Cw Cs Ca) + Sr]",
        trail=trail,
    )
