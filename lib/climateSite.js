/**
 * Align site coordinates with a selected Table C-2 row so assess uses the listed station.
 */

export function applyLocationKeyCoords(site, locations) {
  if (!site?.locationKey || !locations?.length) return site;
  const row = locations.find((c) => c.key === site.locationKey);
  if (!row) return site;
  if (site.lat === row.lat && site.lng === row.lng) return site;
  return { ...site, lat: row.lat, lng: row.lng };
}
