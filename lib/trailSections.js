/** Split assessment trail into lookup vs calculation sections. */

export function splitAssessmentTrail(ra) {
  if (!ra) return { lookup: [], calc: [] };
  if (ra.trailLookup?.length) {
    return {
      lookup: ra.trailLookup,
      calc: ra.trailCalc || [],
    };
  }
  const trail = ra.trail || [];
  const splitAt = trail.findIndex((line) =>
    String(line).startsWith('S = Is')
  );
  if (splitAt <= 0) {
    return { lookup: trail.slice(0, 3), calc: trail.slice(3) };
  }
  return { lookup: trail.slice(0, splitAt), calc: trail.slice(splitAt) };
}
