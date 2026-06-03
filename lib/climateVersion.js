let cachedVersion = null;

/** Climate table version from server (invalidates stale IndexedDB assessments). */
export async function fetchClimateVersion() {
  if (cachedVersion) return cachedVersion;
  const res = await fetch('/api/climate');
  if (!res.ok) throw new Error('Could not load climate metadata');
  const data = await res.json();
  cachedVersion =
    data.climateVersion ||
    `pcic-${data.withSnowCount || 0}-${data.locationCount || 0}`;
  return cachedVersion;
}

export function isAssessmentStale(site, currentVersion) {
  if (!site?.reserveAssessment || !currentVersion) return false;
  const v = site.reserveAssessment.climateVersion;
  if (!v) return true;
  return v !== currentVersion;
}

export function sitesNeedReassess(sites, currentVersion) {
  return sites.some((s) => isAssessmentStale(s, currentVersion));
}
