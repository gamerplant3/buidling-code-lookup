const ENGINE_URL = process.env.ENGINE_URL || 'http://127.0.0.1:8000';

/** Run NBC snow reserve assessment via Python engine (server-side). */
export async function assessRoofReserve(siteInput) {
  const body = {
    constructionYear: siteInput.constructionYear ?? 1990,
    locationKey: siteInput.locationKey ?? undefined,
    lat: siteInput.lat ?? undefined,
    lng: siteInput.lng ?? undefined,
    elevationM: siteInput.elevationM ?? undefined,
    replaceBallastedWithAdhered: Boolean(siteInput.replaceBallastedWithAdhered),
    isWoodStructure: Boolean(siteInput.isWoodStructure),
    satisfactoryPerformance: Boolean(siteInput.satisfactoryPerformance),
    roofWeightExistingKPa: siteInput.roofWeightExistingKPa ?? 0.35,
    roofWeightNewKPa: siteInput.roofWeightNewKPa ?? 0.22,
    roofLM: siteInput.roofLM ?? 14,
    roofWM: siteInput.roofWM ?? 9.5,
    roofSlopeDeg: siteInput.roofSlopeDeg ?? 0,
    roofSlippery: Boolean(siteInput.roofSlippery),
    importance: siteInput.importance ?? 'normal',
    cwReduction: siteInput.cwReduction ?? 'none',
  };

  const res = await fetch(`${ENGINE_URL}/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Engine assess failed (${res.status}): ${text.slice(0, 200)}`);
  }

  return res.json();
}
