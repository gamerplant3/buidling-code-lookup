# Free & low-cost data sources (Canada / siting MVP)

Curated for this project: geocoding, climate, roads, zoning, elevation. **Always check each provider’s current terms** before production or commercial use.

## Already integrated in this MVP

| Source | Use | Cost | Notes |
|--------|-----|------|-------|
| [NRCan Geolocator](https://geolocator.nrcan.gc.ca/) | Address → lat/lng (Canada) | Free | Used via `/api/geocode`. Min 3 chars. Prefer for Canadian sites over raw Nominatim. |
| [OpenFreeMap](https://openfreemap.org/) | Basemap tiles | Free | MapLibre style in `MapView.jsx`. |

## Geocoding & place names

| Source | URL | Cost | Best for |
|--------|-----|------|----------|
| NRCan Geolocator API | `https://geolocator.nrcan.gc.ca/api/v1/search?q=...` | Free | Addresses, cities, postal FSA, official names |
| NRCan Geoname API | `https://geogratis.gc.ca/services/geoname/en/geonames/` | Free | Official CGNDB feature search |
| OpenStreetMap Nominatim | `https://nominatim.openstreetmap.org/` | Free | Global; **strict usage policy** — use NRCan first in Canada, cache results, no bulk |
| Statistics Canada Web Data Service | [WDS](https://www.statcan.gc.ca/en/developers/wds) | Free | Census boundaries, demographics (not live zoning) |

## Climate & environmental (snow, wind, temperature)

| Source | Cost | Notes |
|--------|------|-------|
| NBC Table C-2 (digitize from code PDFs) | Free- manual work | Authoritative for design snow Ss by city |
| Environment and Climate Change Canada | Free open data | Station data for interpolation between C-2 cities |
| [Open-Meteo](https://open-meteo.com/) | Free non-commercial API | Historical climate; useful for gap-fill, not code-official |
| Natural Resources Canada elevation | Free | Terrain / roughness context |

## Roads & access (frontage proxies)

| Source | Cost | Notes |
|--------|------|-------|
| [Statistics Canada Road Network File](https://open.canada.ca/data/en/dataset/9260360b-bf21-436d-bd59-ac050cdd74f6) | Open licence | Download GeoJSON/SHP; compute frontage in browser with Turf.js |
| OpenStreetMap Overpass API | Free | `highway=*` near parcel — respect rate limits |

**Demo:** keep `roadFrontageM` as a site attribute; later derive from RNF + parcel polygon.

## Zoning & land use

Municipal zoning is fragmented :(

| Source | Cost | Notes |
|--------|------|-------|
| Ontario GeoHub / municipal open data | Usually free | e.g. Toronto, Ottawa open zoning layers (GeoJSON/WFS) |
| [Canada Open Government Portal](https://open.canada.ca/) | Free | Search “zoning” + municipality |
| [Ontario Data Catalogue](https://data.ontario.ca/) | Free | Provincial layers; city zoning often at city portal |
| [OpenStreetMap landuse](https://wiki.openstreetmap.org/wiki Tag:landuse=*) | Free | Coarse; not legal zoning |
| Zoneomics, Regrid, Landgrid | Paid | Commercial parcel + zoning APIs when budget allows |

**Demo:** manual `zoning` field on sites; optional static GeoJSON in `/public/layers/` for point-in-polygon.

## Parcels & ownership

| Source | Cost | Notes |
|--------|------|-------|
| Municipal parcel fabric (open data) | Free varies | Toronto, Vancouver, etc. publish parcels |
| Teranet / provincial registries | Paid | Legal surveys |

## Soils, flood, environment (future siting layers)

| Source | Cost |
|--------|------|
| Flood plain maps ( provincial / NRCan ) | Often free GIS |
| Conservation authority GIS | Often free |
| Federal contaminated sites inventory | Free |

## AI / search (this repo)

| Service | Cost | Role |
|---------|------|------|
| Cohere trial | ~1000 calls/mo free | NL → `FilterPlan` JSON only |

**LLMs are for parsing user intent, NOT computing snow loads.** Using python for that.

## To do (expand demo)

1. Expand Table C-2 digitization (all provinces).
2. Auto-assign `locationKey` from geocode + nearest C-2 city (already in Python).
3. Download one city zoning GeoJSON → point-in-polygon on save.
4. Road Network File sample for one CSD → estimate frontage.
5. Heat map layer: batch assess grid of cities (explainer item #6).

## Organization

Source-linked outputs across many APIs. Every assessment result keeps `trail[]` strings and future `sourceRef` IDs — ready for agent orchestration later without changing the deterministic engine.
