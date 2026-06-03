# Building Code Lookup

Roof **reserve capacity** screening (historic NBC snow logic) with AI-powered natural language filters (Cohere) and a map + globe UI. Sites persist in your browser (IndexedDB) - no database for now, just dev.

## Uses

- **Node.js** 18+
- **Python** 3.10+
- **Cohere trial API key** - [dashboard.cohere.com](https://dashboard.cohere.com/)

## Quick start

```bash
# 1. Install JS dependencies
npm install

# 2. Install Python engine
pip install -r engine/requirements.txt

# 3. Build Table C-2 JSON from PCIC exports (three files in data/)
python scripts/import_pcic_table_c2.py

# 4. Configure Cohere (required for AI search)
copy .env.example .env.local
# Edit .env.local and set COHERE_API_KEY=...

# 5. Start UI + Python engine together
npm start
```

Open **http://localhost:3000**

### Demo flow

1. **Reset demo** loads 15 sites: 10 at listed Table C-2 stations (`exact`), 5 rural coords using **IDW** (no `locationKey`).
2. Click **Assess all sites** (snow reserve engine).
3. **Export CSV** for a stakeholder summary, or **Export JSON** for full site data.
4. Select a site → **Reassess** one building without re-running the whole portfolio.
5. Expand **Add site** when needed (collapsed by default); geocode via NRCan.
6. **AI search** example: `Commercial sites with roof reserve and at least 30m road frontage`

## Project layout

```
app/              Next.js UI + API routes (Cohere, geocode, assess proxy)
components/       Map, globe, forms, query bar
lib/              IndexedDB, filters, assess client
engine/           Python FastAPI - deterministic engineering -> reserve cap
data/             table-c2-canada.json (from PCIC), code editions, demo-sites.json
docs/             Free external data sources guide
public/data/      Demo JSON served to browser
```

## Data integrations (see `docs/free-data-sources.md`)

- **Geocode enrich:** `/api/site-enrich` — climate snap/IDW hint, elevation, Toronto/Ottawa zoning, OSM frontage (one call after geocode).
- **Zoning:** Toronto & Ottawa ArcGIS; demo polygons elsewhere.
- **Frontage:** Toronto by-law field when available; else OSM estimate (not StatsCan RNF).
- **Historic snow:** Edition factors in `data/code-editions.json` (NRC survey era notes).
- **Roof inputs:** L, W, slope, Cw, importance in add/edit site form.

## Disclaimer

- Screening tool only - not a structural design or permit substitute.
- Commentary L steps are simplified; see site detail panel for explanation.
## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `COHERE_API_KEY` | - | NL → filter plan |
| `COHERE_MODEL` | `command-r-08-2024` | Chat model |
| `ENGINE_URL` | `http://127.0.0.1:8000` | Python assess API |

## Climate data

- **Source:** `data/table-c2-canada.json` (from `scripts/import_pcic_table_c2.py`)
- **Interpolation:** IDW for unlisted coordinates (`engine/interpolation.py`)
- **Snow loads:** NBC 2015 §4.1.6.2 in Python (`engine/nbc2015/snow_load.py`) - flat / simple gable, Ca=1

See `docs/table-c2-import.md` for PCIC file names (`lat-long`, `SL50-Ss`, `RL50-Sr`).

## Screenshots

Page

<img width="1500" alt="Screenshot 2026-06-03 142718" src="https://github.com/user-attachments/assets/0663e065-f639-4233-ac3b-2aaa78d09bd6" />


Detail view


<img width="2108" height="776" alt="Screenshot 2026-06-03 142838" src="https://github.com/user-attachments/assets/cdf38d6c-8246-41e6-b227-0d82c024c61a" />
