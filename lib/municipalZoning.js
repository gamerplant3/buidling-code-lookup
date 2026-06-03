/** Toronto & Ottawa open zoning + demo Ontario fallback. */

import { readFile } from 'fs/promises';
import path from 'path';
import { lookupZoningAtPoint } from '@/lib/zoningLookup';

const TORONTO_LAYER =
  'https://gis.toronto.ca/arcgis/rest/services/cot_geospatial11/FeatureServer/3/query';
const OTTAWA_LAYER =
  'https://maps.ottawa.ca/arcgis/rest/services/Zoning/MapServer/3/query';

const MUNI_BOUNDS = [
  {
    id: 'toronto',
    name: 'City of Toronto',
    minLat: 43.58,
    maxLat: 43.86,
    minLng: -79.64,
    maxLng: -79.12,
    url: TORONTO_LAYER,
    outFields: 'ZN_ZONE,ZN_STRING,ZN_LU_CATEGORY,ZN_FRONTAGE',
    parse: (attrs) => ({
      zoneCode: attrs.ZN_ZONE,
      label: attrs.ZN_STRING,
      zoning: mapTorontoCategory(attrs.ZN_ZONE, attrs.ZN_LU_CATEGORY),
      roadFrontageM:
        attrs.ZN_FRONTAGE > 0 ? Math.round(Number(attrs.ZN_FRONTAGE)) : null,
      source: 'toronto-open-data',
    }),
  },
  {
    id: 'ottawa',
    name: 'City of Ottawa',
    minLat: 44.9,
    maxLat: 45.55,
    minLng: -76.05,
    maxLng: -75.3,
    url: OTTAWA_LAYER,
    outFields: 'ZONE_CODE,ZONINGTYPE,TOOLTIP',
    parse: (attrs) => ({
      zoneCode: attrs.ZONE_CODE,
      label: attrs.TOOLTIP || attrs.ZONE_CODE,
      zoning: mapOttawaZone(attrs.ZONE_CODE),
      source: 'ottawa-open-data',
    }),
  },
];

function mapTorontoCategory(zone, category) {
  const z = String(zone || '').toUpperCase();
  if (z.startsWith('R') || z === 'RA' || z === 'RS') return 'residential';
  if (z.startsWith('I') || z === 'IH') return 'industrial';
  if (z.startsWith('E') || z === 'EO') return 'industrial';
  if (z.startsWith('C') || z === 'CR' || z === 'CRE') return 'commercial';
  if (category === 101) return 'residential';
  if (category === 201 || category === 202) return 'commercial';
  return 'mixed';
}

function mapOttawaZone(code) {
  const c = String(code || '').toUpperCase();
  if (c.startsWith('R') || c.includes('RES')) return 'residential';
  if (c.startsWith('I') || c.includes('IND')) return 'industrial';
  if (c.startsWith('C') || c.startsWith('V') || c.includes('COM')) return 'commercial';
  return 'mixed';
}

async function queryArcGisPoint(layerUrl, lat, lng, outFields, parse) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'false',
    f: 'json',
  });
  const res = await fetch(`${layerUrl}?${params}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const attrs = (await res.json())?.features?.[0]?.attributes;
  return attrs ? parse(attrs) : null;
}

export async function lookupMunicipalZoning(lat, lng) {
  for (const muni of MUNI_BOUNDS) {
    if (lat < muni.minLat || lat > muni.maxLat || lng < muni.minLng || lng > muni.maxLng) {
      continue;
    }
    try {
      const hit = await queryArcGisPoint(muni.url, lat, lng, muni.outFields, muni.parse);
      if (hit) return { found: true, municipality: muni.name, ...hit };
    } catch {
      /* next */
    }
  }

  try {
    const raw = await readFile(
      path.join(process.cwd(), 'public', 'layers', 'demo-zoning-ontario.json'),
      'utf-8'
    );
    const hit = lookupZoningAtPoint(lng, lat, JSON.parse(raw));
    if (hit) {
      return {
        found: true,
        municipality: 'Demo layer',
        zoneCode: hit.label,
        label: hit.label,
        zoning: hit.zoning,
        source: hit.source,
      };
    }
  } catch {
    /* optional file */
  }

  return { found: false };
}
