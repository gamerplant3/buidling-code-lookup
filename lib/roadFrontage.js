/** OSM Overpass - rough road frontage (see docs; not StatsCan RNF). */

const OVERPASS = 'https://overpass-api.de/api/interpreter';

function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}

function polylineLengthM(coords) {
  let m = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dlat = ((lat2 - lat1) * Math.PI) / 180;
    const dlon = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dlon / 2) ** 2;
    m += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return m;
}

export async function estimateOsmFrontage(lat, lng, radiusM = 150) {
  const query = `
    [out:json][timeout:25];
    way(around:${Math.min(radiusM, 300)},${lat},${lng})
      ["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service)$"];
    out geom;
  `;

  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    next: { revalidate: 604800 },
  });

  if (!res.ok) return { found: false, error: `Overpass HTTP ${res.status}` };

  const data = await res.json();
  const ways = data?.elements || [];
  let best = null;
  let bestScore = Infinity;

  for (const way of ways) {
    if (!way.geometry?.length) continue;
    const coords = way.geometry.map((n) => [n.lon, n.lat]);
    let minD = Infinity;
    for (let i = 1; i < coords.length; i++) {
      minD = Math.min(
        minD,
        distPointToSegment(lng, lat, coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1])
      );
    }
    const distM = minD * 111320 * Math.cos((lat * Math.PI) / 180);
    if (distM > 120) continue;
    const segLen = polylineLengthM(coords);
    const frontage = Math.min(Math.max(segLen * 0.35, 15), 200);
    if (distM < bestScore) {
      bestScore = distM;
      best = {
        roadFrontageM: Math.round(frontage),
        highway: way.tags?.highway,
        name: way.tags?.name || way.tags?.ref,
        distanceToRoadM: Math.round(distM),
        source: 'openstreetmap-overpass',
      };
    }
  }

  if (!best) {
    return { found: false, note: 'No OSM highway nearby - enter frontage manually.' };
  }
  return { found: true, ...best };
}
