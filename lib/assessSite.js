/** Call Python engine via Next.js API proxy. */

export async function assessSite(site) {
  const res = await fetch('/api/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      constructionYear: site.constructionYear,
      locationKey: site.locationKey,
      lat: site.lat,
      lng: site.lng,
      replaceBallastedWithAdhered: site.replaceBallastedWithAdhered,
      isWoodStructure: site.isWoodStructure,
      satisfactoryPerformance: site.satisfactoryPerformance,
      roofWeightExistingKPa: site.roofWeightExistingKPa,
      roofWeightNewKPa: site.roofWeightNewKPa,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Assessment failed (${res.status})`);
  }

  const assessment = await res.json();
  return {
    ...site,
    reserveAssessment: assessment,
    climateInterpolated: assessment.climateInterpolated,
    assessedAt: new Date().toISOString(),
  };
}

export async function assessAllSites(sites, onProgress) {
  const updated = [];
  for (let i = 0; i < sites.length; i++) {
    const assessed = await assessSite(sites[i]);
    updated.push(assessed);
    if (onProgress) onProgress(i + 1, sites.length);
  }
  return updated;
}
