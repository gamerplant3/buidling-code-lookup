# Table C-2 import



## PCIC export files (snow - required)



Place these in `data/`:



| File | Contents |

|------|----------|

| `pcic-table-c2-lat-long.csv` | Location, prov, Latitude, Longitude |

| `pcic-table-c2-SL50-Ss.csv` | **SL50 (NBCC)** = ground snow **Ss** (kPa) |

| `pcic-table-c2-RL50-Sr.csv` | **RL50 (NBCC)** = associated rain **Sr** (kPa) |



The import script uses the **(NBCC)** columns (official Table C-2 values), not the separate `(kPa)` climate-future columns in the same files.



## Build JSON


-
```bash

python scripts/import_pcic_table_c2.py

```
-
-

Output: `data/table-c2-canada.json` (loaded by the Python engine).



Custom paths:



```bash

python scripts/import_pcic_table_c2.py \

  --coords data/pcic-table-c2-lat-long.csv \

  --ss-csv data/pcic-table-c2-SL50-Ss.csv \

  --sr-csv data/pcic-table-c2-RL50-Sr.csv

```



## Interpolation



Sites without an exact Table C-2 row use **IDW** on stations with `ssKPa` (`engine/interpolation.py`). Assessment trails list neighbors and confidence.



Climate data lives only in `data/table-c2-canada.json` (built from the three snow PCIC CSVs by default).


