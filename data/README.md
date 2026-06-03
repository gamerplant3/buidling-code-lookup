# Data files

| File | Purpose |
|------|---------|
| `table-c2-canada.json` | **Authoritative climate** - 680 NBC Table C-2 stations from PCIC (run import script) |
| `pcic-table-c2-lat-long.csv` | PCIC export: coordinates |
| `pcic-table-c2-SL50-Ss.csv` | PCIC export: Ss (SL50 NBCC column) |
| `pcic-table-c2-RL50-Sr.csv` | PCIC export: Sr (RL50 NBCC column) |
| `demo-sites.json` | **15-site national portfolio** - 10 exact Table C-2 stations, 5 IDW (coords only, no `locationKey`) |
| `code-editions.json` | MVP construction-year → NBC edition mapping (not from PCIC) |

Optional PCIC exports (`pcic-table-c2-WP50-q50.csv`, `WP10-q10.csv`) are **not imported** — structural wind is out of scope. Snow exposure uses the **Cw** field on each site.

Rebuild climate JSON after CSV changes:

```bash
python scripts/import_pcic_table_c2.py
```
