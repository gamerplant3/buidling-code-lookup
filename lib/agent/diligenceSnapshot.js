import { v4 as uuidv4 } from 'uuid';

const ASSESS_FIELDS = [
  'replaceBallastedWithAdhered',
  'isWoodStructure',
  'satisfactoryPerformance',
  'roofWeightExistingKPa',
  'roofWeightNewKPa',
  'roofLM',
  'roofWM',
  'roofSlopeDeg',
  'roofSlippery',
  'importance',
  'cwReduction',
];

/** Build a diligence snapshot from agent tool trace (client or server). */
export function extractDiligenceSnapshot(toolTrace) {
  if (!toolTrace?.length) return null;

  const snap = { assessArgs: {} };

  for (const step of toolTrace) {
    for (const call of step.calls || []) {
      const { name, args, result } = call;
      if (!result || result.error) continue;

      if (name === 'geocode_address' && result.results?.length === 1) {
        const r = result.results[0];
        snap.label = r.label;
        snap.address = r.label;
        snap.lat = r.lat;
        snap.lng = r.lng;
      }

      if (name === 'enrich_location') {
        if (result.patch) Object.assign(snap, result.patch);
        if (result.hints) snap.enrichHints = result.hints;
      }

      if (name === 'assess_roof_reserve' && result.assessment) {
        snap.assessment = result.assessment;
        snap.assessArgs = { ...(args || {}) };
        if (args?.constructionYear != null) snap.constructionYear = args.constructionYear;
        if (args?.lat != null) snap.lat = args.lat;
        if (args?.lng != null) snap.lng = args.lng;
        for (const key of ASSESS_FIELDS) {
          if (args?.[key] !== undefined) snap[key] = args[key];
        }
      }
    }
  }

  if (!snap.assessment || snap.lat == null || snap.lng == null) return null;
  return snap;
}

/** Merge persisted context (prior turn) with in-flight diligence from the current run. */
export function mergeDiligenceContext(persisted, inRun) {
  if (!persisted && !inRun) return null;
  return {
    ...(persisted || {}),
    ...(inRun || {}),
    assessArgs: { ...(persisted?.assessArgs || {}), ...(inRun?.assessArgs || {}) },
    assessment: inRun?.assessment || persisted?.assessment,
  };
}

export function buildSiteFromDiligence(snap) {
  const args = snap.assessArgs || {};
  const label = snap.name || snap.label || snap.address || 'Agent site';

  const site = {
    id: uuidv4(),
    name: typeof label === 'string' ? label.slice(0, 80) : 'Agent site',
    address: snap.address || snap.label || '',
    lat: snap.lat,
    lng: snap.lng,
    elevationM: snap.elevationM,
    constructionYear: snap.constructionYear ?? args.constructionYear ?? 1990,
    zoning: snap.zoning || 'commercial',
    roadFrontageM: snap.roadFrontageM ?? 30,
    replaceBallastedWithAdhered:
      snap.replaceBallastedWithAdhered ?? args.replaceBallastedWithAdhered ?? false,
    isWoodStructure: snap.isWoodStructure ?? args.isWoodStructure ?? false,
    satisfactoryPerformance:
      snap.satisfactoryPerformance ?? args.satisfactoryPerformance ?? false,
    roofWeightExistingKPa: args.roofWeightExistingKPa ?? 0.35,
    roofWeightNewKPa: args.roofWeightNewKPa ?? 0.22,
    roofLM: args.roofLM ?? 14,
    roofWM: args.roofWM ?? 9.5,
    roofSlopeDeg: args.roofSlopeDeg ?? 0,
    roofSlippery: args.roofSlippery ?? false,
    importance: args.importance ?? 'normal',
    cwReduction: args.cwReduction ?? 'none',
    reserveAssessment: snap.assessment,
    climateInterpolated: snap.assessment?.climateInterpolated,
    climateMethod: snap.assessment?.climateMethod,
    assessedAt: new Date().toISOString(),
  };

  if (snap.locationKey) site.locationKey = snap.locationKey;
  return site;
}
