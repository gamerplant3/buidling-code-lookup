/** Haversine distance (km) and nearest Table C-2 station (client fallback). */

function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dlat = ((lat2 - lat1) * Math.PI) / 180;
  const dlon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dlon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Nearest station with Ss/Sr, regardless of snap distance. */
export function findNearestClimateStation(lat, lng, locations) {
  if (lat == null || lng == null || !locations?.length) return null;
  let best = null;
  let bestD = Infinity;
  for (const loc of locations) {
    if (loc.ssKPa == null) continue;
    const d = haversineKm(lat, lng, loc.lat, loc.lng);
    if (d < bestD) {
      bestD = d;
      best = loc;
    }
  }
  if (!best) return null;
  const distanceKm = Math.round(bestD * 100) / 100;
  return {
    key: best.key,
    name: best.name,
    province: best.province,
    lat: best.lat,
    lng: best.lng,
    ssKPa: best.ssKPa,
    srKPa: best.srKPa,
    distanceKm,
    method: bestD <= 2 ? 'exact' : 'nearest',
  };
}

/** Nearest station only if within maxKm (default 30 km snap). */
export function nearestClimateFromList(lat, lng, locations, maxKm = 30) {
  const hit = findNearestClimateStation(lat, lng, locations);
  if (!hit || hit.distanceKm > maxKm) return null;
  return hit;
}

export async function fetchNearestClimate(lat, lng, climateLocations) {
  try {
    const res = await fetch(
      `/api/nearest-climate?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.found) return data;
    }
  } catch {
    /* engine offline - fallback below */
  }
  return nearestClimateFromList(lat, lng, climateLocations);
}
