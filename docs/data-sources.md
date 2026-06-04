# Data sources

## Wired in the app

| What | Source | API / data |
|------|--------|------------|
| Address → coordinates | [NRCan Geolocator](https://geolocator.nrcan.gc.ca/) | `GET /api/geocode` |
| One-shot site hints | Composed server-side | `GET /api/site-enrich?lat=&lng=` - climate snap/IDW hint, Open-Meteo elevation, Toronto/Ottawa zoning, OSM frontage |
| Table C-2 Ss/Sr | PCIC Design Value Explorer | `data/table-c2-canada.json` + Python engine (`exact` / `nearest` ≤30 km / `idw`) |
| Snow assessment | NBC 2015 (in-engine) | `POST /api/assess` |
| Map tiles | [OpenFreeMap](https://openfreemap.org/) | MapLibre in `MapView.jsx` |
| Scout (AI agent) | Cohere trial (tool use) | `POST /api/agent` - geocode, assess, portfolio search; snow math stays in Python |
| Historic code notes | Curated JSON | `data/code-editions.json`, `docs/historic-editions.md` |

Individual routes (`/api/zoning`, `/api/frontage`, `/api/elevation`, `/api/nearest-climate`) remain for debugging; the form uses **`/api/site-enrich`** after geocode.

### Geocode flow

1. User picks a Geolocator result.
2. **`/api/site-enrich`** runs in parallel: nearest C-2 station (snap coords + `locationKey` if ≤30 km, else clear key and note IDW), elevation, zoning (Toronto `ZN_FRONTAGE` when available), else OSM frontage estimate.
3. User saves and **Assess** runs Python with the saved coordinates / key.

### Zoning & frontage

- **Toronto / Ottawa:** municipal ArcGIS point queries (`lib/municipalZoning.js`).
- **Other demo cities:** coarse polygons in `public/layers/demo-zoning-ontario.json`.
- **Frontage:** by-law field (Toronto) or OSM Overpass heuristic (`lib/roadFrontage.js`) - screening only, not legal survey.

## Possible improvements

| Item | Comment |
|-------|----------|
| Roads | [StatsCan Road Network File](https://open.canada.ca/data/en/dataset/9260360b-bf21-436d-bd59-ac050cdd74f6) - national download; clip locally in QGIS; would replace OSM frontage |
| More zoning | Other cities’ open data, Ontario GeoHub, paid parcel APIs |
| Parcels / flood / soils | Municipal fabric, conservation authority GIS |
