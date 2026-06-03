/** Call Python engine via Next.js API proxy. */

import { applyLocationKeyCoords } from '@/lib/climateSite';
import { fetchClimateVersion } from '@/lib/climateVersion';

export async function assessSite(site, climateVersion, climateLocations) {
  const payload = applyLocationKeyCoords(site, climateLocations);
  const res = await fetch('/api/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      constructionYear: payload.constructionYear,
      locationKey: payload.locationKey,
      lat: payload.lat,
      lng: payload.lng,
      elevationM: payload.elevationM,
      replaceBallastedWithAdhered: payload.replaceBallastedWithAdhered,
      isWoodStructure: payload.isWoodStructure,
      satisfactoryPerformance: payload.satisfactoryPerformance,
      roofWeightExistingKPa: payload.roofWeightExistingKPa,
      roofWeightNewKPa: payload.roofWeightNewKPa,
      roofLM: payload.roofLM,
      roofWM: payload.roofWM,
      roofSlopeDeg: payload.roofSlopeDeg,
      roofSlippery: payload.roofSlippery,
      importance: payload.importance,
      cwReduction: payload.cwReduction,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Assessment failed (${res.status})`);
  }

  const assessment = await res.json();
  const version = climateVersion || (await fetchClimateVersion());
  return {
    ...applyLocationKeyCoords(site, climateLocations),
    reserveAssessment: { ...assessment, climateVersion: version },
    climateInterpolated: assessment.climateInterpolated,
    climateMethod: assessment.climateMethod,
    assessedAt: new Date().toISOString(),
  };
}

export async function assessAllSites(sites, onProgress, climateLocations) {
  const climateVersion = await fetchClimateVersion();
  let locations = climateLocations;
  if (!locations?.length) {
    const res = await fetch('/api/climate');
    const data = await res.json();
    locations = data.locations || [];
  }
  const updated = [];
  for (let i = 0; i < sites.length; i++) {
    const assessed = await assessSite(sites[i], climateVersion, locations);
    updated.push(assessed);
    if (onProgress) onProgress(i + 1, sites.length);
  }
  return updated;
}
