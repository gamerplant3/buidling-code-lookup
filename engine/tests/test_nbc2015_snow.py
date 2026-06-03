"""Tests for NBC 2015 snow load (validated against Snow Loading Advisor / Jabacus)."""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "engine"))

from nbc2015.snow_load import specified_snow_load, characteristic_length, calc_cb, calc_cs


def test_toronto_single_level_roof_uls():
    """Workbook: Toronto City Hall, w=9.54, l=14.16, Ss=1.1, Sr=0.4 → S=1.28 kPa ULS."""
    result = specified_snow_load(
        1.1,
        0.4,
        roof_l_m=14.16,
        roof_w_m=9.54,
        roof_slope_deg=0,
        slippery=False,
        importance="normal",
        limit_state="uls",
    )
    assert abs(result.s_kpa - 1.28) < 0.01
    assert abs(result.cb - 0.8) < 0.001


def test_toronto_sls():
    result = specified_snow_load(
        1.1,
        0.4,
        roof_l_m=14.16,
        roof_w_m=9.54,
        limit_state="sls",
    )
    assert abs(result.s_kpa - 1.152) < 0.01


def test_lc_formula():
    lc = characteristic_length(14.16, 9.54)
    assert abs(lc - (2 * 9.54 - 9.54**2 / 14.16)) < 0.01


def test_cs_flat():
    assert calc_cs(0, False) == 1.0
    assert calc_cs(30, False) == 1.0
    assert abs(calc_cs(50, False) - 0.5) < 0.001


def test_cb_large_roof():
    cb = calc_cb(100, 80, 1.0)
    assert cb > 0.8
