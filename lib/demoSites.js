/**
 * Demo portfolio: fictional retail sites only. Climate Ss/Sr always come from
 * table-c2-canada.json via locationKey + assess - never embedded in this file.
 */

export function stripSiteAssessments(site) {
  const {
    reserveAssessment,
    assessedAt,
    climateInterpolated,
    ...clean
  } = site;
  return clean;
}

export function stripPortfolioAssessments(sites) {
  return sites.map(stripSiteAssessments);
}

function demoSiteMatchesTemplate(site, template) {
  const keys = [
    'name',
    'address',
    'lat',
    'lng',
    'locationKey',
    'constructionYear',
    'zoning',
  ];
  return keys.every((k) => (site[k] ?? null) === (template[k] ?? null));
}

/** Refresh demo-* sites from demo-sites.json when IndexedDB still has old coords/keys. */
export function reconcileStoredSitesWithDemo(stored, demoTemplates) {
  const templateById = new Map(demoTemplates.map((d) => [d.id, d]));
  let metadataChanged = false;
  const storedIds = new Set(stored.map((s) => s.id));
  const sites = stored.map((site) => {
    const template = templateById.get(site.id);
    if (!template) return site;
    if (demoSiteMatchesTemplate(site, template)) return site;
    metadataChanged = true;
    const merged = { ...stripSiteAssessments(template), id: site.id };
    if (!template.locationKey) delete merged.locationKey;
    return merged;
  });

  for (const template of demoTemplates) {
    if (!storedIds.has(template.id)) {
      sites.push(stripSiteAssessments(template));
      metadataChanged = true;
    }
  }

  return { sites, metadataChanged };
}
