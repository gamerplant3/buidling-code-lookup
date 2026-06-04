/** Compact site records for agent portfolio context (token-conscious). */

export function summarizeSite(site) {
  if (!site) return null;
  const ra = site.reserveAssessment;
  return {
    id: site.id,
    name: site.name,
    address: site.address,
    zoning: site.zoning,
    constructionYear: site.constructionYear,
    roadFrontageM: site.roadFrontageM,
    lat: site.lat,
    lng: site.lng,
    locationKey: site.locationKey,
    assessed: Boolean(ra),
    pass: ra?.pass ?? null,
    deltaKPa: ra?.deltaKPa ?? null,
    climateMethod: site.climateMethod ?? ra?.climateMethod ?? null,
    climateLocation: ra?.climateLocation ?? null,
    isWoodStructure: site.isWoodStructure,
    replaceBallastedWithAdhered: site.replaceBallastedWithAdhered,
  };
}

export function summarizeSiteDetail(site) {
  if (!site) return null;
  const ra = site.reserveAssessment;
  if (!ra) {
    return { ...summarizeSite(site), note: 'Not assessed yet — run assess or ask agent to assess a new address.' };
  }
  return {
    ...summarizeSite(site),
    factoredHistoricKPa: ra.factoredHistoricKPa,
    totalActualDemandKPa: ra.totalActualDemandKPa,
    specifiedSnowCurrentKPa: ra.specifiedSnowCurrentKPa,
    ssKPa: ra.ssKPa,
    srKPa: ra.srKPa,
    climateConfidence: ra.climateConfidence,
    originalDesignCode: ra.originalDesignCode,
    trailLookup: (ra.trailLookup || []).slice(0, 3),
    trailCalc: (ra.trailCalc || []).slice(0, 3),
  };
}
