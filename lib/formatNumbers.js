
const STRUCTURAL_WIND_TRAIL =
  /^\s*wind\b|\bWP50\b|\bWP10\b|q\(1\/50\)|q\(1\/10\)/i;

export function isStructuralWindTrailLine(line) {
  return STRUCTURAL_WIND_TRAIL.test(String(line));
}

/** @deprecated use isStructuralWindTrailLine */
export const isWindTrailLine = isStructuralWindTrailLine;



export function formatTrailLine(line) {

  if (isStructuralWindTrailLine(line)) return null;

  return String(line).replace(/-?\d+\.\d+/g, (match) => {

    const n = parseFloat(match);

    if (!Number.isFinite(n)) return match;

    return n.toFixed(3);

  });

}



export function formatKpa(value) {

  if (value == null || Number.isNaN(Number(value))) return '-';

  return Number(value).toFixed(3);

}


