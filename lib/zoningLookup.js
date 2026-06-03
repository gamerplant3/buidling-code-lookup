/** Point-in-polygon for demo municipal zoning GeoJSON (no Turf dependency). */

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng, lat, coordinates) {
  if (!pointInRing(lng, lat, coordinates[0])) return false;
  for (let h = 1; h < coordinates.length; h++) {
    if (pointInRing(lng, lat, coordinates[h])) return false;
  }
  return true;
}

export function lookupZoningAtPoint(lng, lat, featureCollection) {
  if (lng == null || lat == null || !featureCollection?.features) return null;
  for (const f of featureCollection.features) {
    const geom = f.geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon' && pointInPolygon(lng, lat, geom.coordinates)) {
      return { ...f.properties, source: 'demo-zoning-ontario' };
    }
    if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        if (pointInPolygon(lng, lat, poly)) {
          return { ...f.properties, source: 'demo-zoning-ontario' };
        }
      }
    }
  }
  return null;
}

let zoningCache = null;

export async function loadDemoZoningLayer() {
  if (zoningCache) return zoningCache;
  const res = await fetch('/layers/demo-zoning-ontario.json');
  if (!res.ok) throw new Error('Demo zoning layer not found');
  zoningCache = await res.json();
  return zoningCache;
}
