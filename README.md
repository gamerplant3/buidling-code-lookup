# Building Code Lookup

Roof reserve capacity bulk calculations (screening) using historic NBC snow loading. **Agentic diligence** (Cohere tool use) geocodes, assesses, and explains reserve — or searches your portfolio. Sites persist in your browser (IndexedDB).

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

# 4. Configure Cohere (required for diligence agent)
copy .env.example .env.local
# Edit .env.local and set COHERE_API_KEY=...

# 5. Start UI + Python engine together
npm start
```

Open **http://localhost:3000**

### Demo flow

1. **Reset demo** loads 15 sites: 10 at listed Table C-2 stations (`exact`), 5 rural coords using **IDW** (no `locationKey`).
2. Click **Assess all sites** (snow reserve engine).
3. **Diligence agent** — try example 1 (Toronto warehouse) or example 2 (portfolio filter). Expand tool steps to see geocode → assess calls.
4. Select a site → **Reassess** one building, or **Add site** manually.
5. **Export CSV** for stakeholders, or **Export JSON** for full site data.

## Org

```
app/              Next.js UI + API routes (agent, geocode, assess proxy)
components/       Map, globe, agent panel, forms
lib/              IndexedDB, agent tools, assess client
lib/agent/        Cohere orchestrator + tool executors
engine/           Python FastAPI - deterministic engineering -> reserve cap
data/             table-c2-canada.json (from PCIC), code editions, demo-sites.json
docs/             Free external data sources guide
public/data/      Demo JSON served to browser
```

## Data integrations (see `docs/data-sources.md`)

- **Geocode enrich:** `/api/site-enrich` — climate snap/IDW hint, elevation, Toronto/Ottawa zoning, OSM frontage (one call after geocode).
- **Agent geocode:** NRCan Geolocator first; Nominatim fallback so the agent can still geocode Canadian addresses when NRCan’s geocoder is unreachable (502 response).
- **Zoning:** Toronto & Ottawa ArcGIS; demo polygons elsewhere.
- **Frontage:** Toronto by-law field when available; else OSM estimate (not StatsCan RNF).
- **Historic snow:** Edition factors in `data/code-editions.json` (NRC survey era notes).
- **Roof inputs:** L, W, slope, Cw, importance in add/edit site form.

## Disclaimer

- Screening tool only - not a structural design or permit substitute.
- Commentary L steps are simplified for this demo
## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `COHERE_API_KEY` | - | Diligence agent (tool use) |
| `COHERE_MODEL` | `command-r-08-2024` | Chat model with tools |
| `ENGINE_URL` | `http://127.0.0.1:8000` | Python assess API |

## Climate data

- **Source:** `data/table-c2-canada.json` (from `scripts/import_pcic_table_c2.py`)
- **Interpolation:** IDW for unlisted coordinates (`engine/interpolation.py`)
- **Snow loads:** NBC 2015 §4.1.6.2 in Python (`engine/nbc2015/snow_load.py`) - flat / simple gable, Ca=1

See `docs/table-c2-import.md` for PCIC file names (`lat-long`, `SL50-Ss`, `RL50-Sr`).

## Screenshots

Page

<img width="1500" alt="Screenshot 2026-06-03 180819" src="https://github.com/user-attachments/assets/08c8a1be-7b81-4abc-84f6-d0a58f8cbe32" />


