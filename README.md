# Building Code Lookup

Roof **reserve capacity** screening (historic NBC snow logic) with AI-powered natural language filters (Cohere) and a map + globe UI. Sites persist in your browser (IndexedDB) — no database for now, just dev.

## Uses

- **Node.js** 18+
- **Python** 3.10+
- **Cohere trial API key** — [dashboard.cohere.com](https://dashboard.cohere.com/)

## Quick start

```bash
# 1. Install JS dependencies
npm install

# 2. Install Python engine
pip install -r engine/requirements.txt

# 3. Configure Cohere (required for AI search)
copy .env.example .env.local
# Edit .env.local and set COHERE_API_KEY=...

# 4. Start UI + Python engine together
npm start
```

Open **http://localhost:3000**

### Demo flow

1. Click **Assess all sites** (runs Python reserve engine on the demo Ontario sites in json).
2. In **AI search**, try: `Commercial sites with roof reserve and at least 30m road frontage`
3. Click map markers or list items for assessment trail / citations.
4. **Add site** → **Geocode** (free NRCan API) → save → auto-assess.

## Project layout

```
app/              Next.js UI + API routes (Cohere, geocode, assess proxy)
components/       Map, globe, forms, query bar
lib/              IndexedDB, filters, assess client
engine/           Python FastAPI — deterministic engineering -> reserve cap
data/             Table C-2 subset, code editions, demo sites
docs/             Free external data sources guide
public/data/      Demo JSON served to browser
```

## Disclaimer:

- Snow reserve math is very simplified right now for demo. Connect to NBC 2015 data (eg spreadsheet?) for prod.
- Zoning and road frontage manual fields until you attach municipal GIS layers (see `docs/free-data-sources.md`).

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `COHERE_API_KEY` | — | NL → filter plan |
| `COHERE_MODEL` | `command-r-08-2024` | Chat model |
| `ENGINE_URL` | `http://127.0.0.1:8000` | Python assess API |

## Screenshots

Page

<img width="1500" alt="Screenshot 2026-06-03 142718" src="https://github.com/user-attachments/assets/0663e065-f639-4233-ac3b-2aaa78d09bd6" />


Detail view


<img width="2108" height="776" alt="Screenshot 2026-06-03 142838" src="https://github.com/user-attachments/assets/cdf38d6c-8246-41e6-b227-0d82c024c61a" />
