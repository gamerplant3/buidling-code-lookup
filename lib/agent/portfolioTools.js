import { summarizeSite, summarizeSiteDetail } from '@/lib/agent/summarizeSite';

function assessedSites(sites) {
  return (sites || []).filter((s) => s?.reserveAssessment);
}

function roundKpa(n) {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n * 1000) / 1000;
}

/** Resolve sites by id, exact name, or partial name/address match. */
export function resolvePortfolioSites(sites, idsOrNames) {
  const keys = (idsOrNames || []).map((k) => String(k).trim()).filter(Boolean);
  const resolved = [];
  const missing = [];

  for (const key of keys) {
    let site = sites.find((s) => s.id === key);
    if (!site) {
      const lower = key.toLowerCase();
      const matches = sites.filter(
        (s) =>
          s.name?.toLowerCase() === lower ||
          s.name?.toLowerCase().includes(lower) ||
          s.address?.toLowerCase().includes(lower)
      );
      site = matches.length === 1 ? matches[0] : matches.find((s) => s.name?.toLowerCase() === lower);
    }
    if (site) resolved.push(site);
    else missing.push(key);
  }

  return { resolved, missing };
}

export function findPortfolioSites(sites, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { matches: [], query: q };

  const matches = sites
    .filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q) ||
        s.locationKey?.toLowerCase().includes(q) ||
        s.zoning?.toLowerCase().includes(q)
    )
    .map(summarizeSite)
    .slice(0, 10);

  return { query: q, matchCount: matches.length, matches };
}

export function summarizePortfolio(sites, scope = 'assessed_only') {
  const all = sites || [];
  const pool = scope === 'all' ? all : assessedSites(all);
  const assessed = scope === 'all' ? assessedSites(all) : pool;
  const pass = assessed.filter((s) => s.reserveAssessment.pass);
  const fail = assessed.filter((s) => !s.reserveAssessment.pass);
  const idw = assessed.filter(
    (s) => s.climateMethod === 'idw' || s.reserveAssessment?.climateMethod === 'idw' || s.climateInterpolated
  );

  const byZoning = {};
  for (const s of assessed) {
    const z = s.zoning || 'unknown';
    if (!byZoning[z]) byZoning[z] = { count: 0, pass: 0, fail: 0 };
    byZoning[z].count += 1;
    if (s.reserveAssessment.pass) byZoning[z].pass += 1;
    else byZoning[z].fail += 1;
  }

  const byClimateMethod = {};
  for (const s of assessed) {
    const m = s.reserveAssessment?.climateMethod || s.climateMethod || 'unknown';
    if (!byClimateMethod[m]) byClimateMethod[m] = { count: 0, pass: 0, fail: 0 };
    byClimateMethod[m].count += 1;
    if (s.reserveAssessment.pass) byClimateMethod[m].pass += 1;
    else byClimateMethod[m].fail += 1;
  }

  const sortedFail = [...fail].sort(
    (a, b) => (a.reserveAssessment.deltaKPa ?? 0) - (b.reserveAssessment.deltaKPa ?? 0)
  );
  const sortedPass = [...pass].sort(
    (a, b) => (b.reserveAssessment.deltaKPa ?? 0) - (a.reserveAssessment.deltaKPa ?? 0)
  );

  const avgDeltaPass =
    pass.length > 0
      ? roundKpa(pass.reduce((sum, s) => sum + (s.reserveAssessment.deltaKPa ?? 0), 0) / pass.length)
      : null;

  return {
    scope,
    totalSites: all.length,
    assessedCount: assessed.length,
    unassessedCount: all.length - assessed.length,
    passCount: pass.length,
    failCount: fail.length,
    passRate: assessed.length ? roundKpa(pass.length / assessed.length) : null,
    idwCount: idw.length,
    idwFailCount: idw.filter((s) => !s.reserveAssessment.pass).length,
    avgDeltaKPaPass: avgDeltaPass,
    byZoning,
    byClimateMethod,
    riskiestFail: sortedFail[0] ? summarizeSite(sortedFail[0]) : null,
    bestPass: sortedPass[0] ? summarizeSite(sortedPass[0]) : null,
  };
}

function compareRow(site) {
  const ra = site.reserveAssessment;
  return {
    id: site.id,
    name: site.name,
    address: site.address,
    constructionYear: site.constructionYear,
    zoning: site.zoning,
    pass: ra?.pass ?? null,
    deltaKPa: roundKpa(ra?.deltaKPa),
    factoredHistoricKPa: roundKpa(ra?.factoredHistoricKPa),
    totalActualDemandKPa: roundKpa(ra?.totalActualDemandKPa),
    specifiedSnowCurrentKPa: roundKpa(ra?.specifiedSnowCurrentKPa),
    climateMethod: ra?.climateMethod || site.climateMethod || null,
    climateLocation: ra?.climateLocation || null,
    isWoodStructure: site.isWoodStructure,
    replaceBallastedWithAdhered: site.replaceBallastedWithAdhered,
  };
}

export function comparePortfolioSites(sites, siteIds, { includeExplanations = true } = {}) {
  const { resolved, missing } = resolvePortfolioSites(sites, siteIds);
  if (resolved.length < 2) {
    return {
      error: 'Need at least two valid sites to compare. Use find_portfolio_sites if ids are unknown.',
      missing,
      foundCount: resolved.length,
    };
  }

  const compared = resolved.slice(0, 4);
  const rows = compared.map(compareRow);
  const passes = rows.filter((r) => r.pass === true).length;
  const fails = rows.filter((r) => r.pass === false).length;

  const result = {
    comparedCount: rows.length,
    missing,
    passCount: passes,
    failCount: fails,
    sites: rows,
    note: 'Compare factoredHistoricKPa vs totalActualDemandKPa to see capacity vs demand drivers.',
  };

  if (includeExplanations) {
    result.explanations = compared.map((site) => explainPortfolioSite(site));
    if (compared.length === 2) {
      result.contrast = buildCompareContrast(compared[0], compared[1]);
    }
  }

  return result;
}

/** Highlight deterministic differences between two assessed sites. */
function buildCompareContrast(siteA, siteB) {
  const explA = explainPortfolioSite(siteA);
  const explB = explainPortfolioSite(siteB);
  if (!explA.assessed || !explB.assessed) {
    return ['One or both sites are unassessed — run Assess all first.'];
  }

  const lines = [];
  const raA = siteA.reserveAssessment;
  const raB = siteB.reserveAssessment;

  if (explA.pass !== explB.pass) {
    lines.push(
      `${siteA.name} ${explA.pass ? 'passes' : 'fails'} (${roundKpa(raA.deltaKPa)} kPa margin) vs ${siteB.name} ${explB.pass ? 'passes' : 'fails'} (${roundKpa(raB.deltaKPa)} kPa margin).`
    );
  } else {
    lines.push(
      `Both ${explA.pass ? 'pass' : 'fail'}; ${siteA.name} margin ${roundKpa(raA.deltaKPa)} kPa vs ${siteB.name} ${roundKpa(raB.deltaKPa)} kPa.`
    );
  }

  const snowA = raA.specifiedSnowCurrentKPa;
  const snowB = raB.specifiedSnowCurrentKPa;
  if (snowA != null && snowB != null && Math.abs(snowA - snowB) > 0.05) {
    const higher = snowA > snowB ? siteA.name : siteB.name;
    lines.push(
      `Higher current specified snow at ${higher} (${roundKpa(Math.max(snowA, snowB))} vs ${roundKpa(Math.min(snowA, snowB))} kPa) — raises demand on the failing side if applicable.`
    );
  }

  const capA = raA.factoredHistoricKPa;
  const capB = raB.factoredHistoricKPa;
  if (capA != null && capB != null && Math.abs(capA - capB) > 0.05) {
    const higher = capA > capB ? siteA.name : siteB.name;
    lines.push(
      `Higher historic factored capacity at ${higher} (${roundKpa(Math.max(capA, capB))} vs ${roundKpa(Math.min(capA, capB))} kPa).`
    );
  }

  const climA = raA.climateMethod || siteA.climateMethod;
  const climB = raB.climateMethod || siteB.climateMethod;
  if (climA !== climB) {
    lines.push(`Climate method differs: ${siteA.name} (${climA || 'unknown'}) vs ${siteB.name} (${climB || 'unknown'}).`);
  }

  if (siteA.constructionYear !== siteB.constructionYear) {
    lines.push(
      `Construction era: ${siteA.name} (${siteA.constructionYear}) vs ${siteB.name} (${siteB.constructionYear}) — affects original design snow code.`
    );
  }

  if (siteA.isWoodStructure !== siteB.isWoodStructure) {
    lines.push(
      `Wood structure: ${siteA.isWoodStructure ? siteA.name : siteB.name} only${siteA.isWoodStructure || siteB.isWoodStructure ? ' (Commentary L)' : ''}.`
    );
  }

  return lines;
}

function trailLines(ra, limit = 3) {
  const lines = [...(ra.trailLookup || []), ...(ra.trailCalc || [])]
    .map((t) => (typeof t === 'string' ? t : t?.text || t?.line || JSON.stringify(t)))
    .filter(Boolean);
  return lines.slice(0, limit);
}

/** Deterministic pass/fail explanation for "why" questions. */
export function explainPortfolioSite(site) {
  if (!site) return { error: 'Site not found' };

  const ra = site.reserveAssessment;
  if (!ra) {
    return {
      siteId: site.id,
      name: site.name,
      assessed: false,
      note: 'Site has not been assessed — run Assess all or reassess this site first.',
    };
  }

  const drivers = [];
  const riskFlags = [];

  const historic = ra.factoredHistoricKPa;
  const demand = ra.totalActualDemandKPa;
  const delta = ra.deltaKPa;

  if (ra.pass) {
    drivers.push(
      `Reserve passes: historic factored snow capacity ${roundKpa(historic)} kPa exceeds current total demand ${roundKpa(demand)} kPa (margin ${roundKpa(delta)} kPa).`
    );
  } else {
    const shortfall = delta != null && delta < 0 ? Math.abs(delta) : null;
    drivers.push(
      `Reserve fails: current total demand ${roundKpa(demand)} kPa exceeds historic factored capacity ${roundKpa(historic)} kPa${shortfall != null ? ` by ${roundKpa(shortfall)} kPa` : ''}.`
    );
  }

  if (ra.specifiedSnowCurrentKPa != null) {
    drivers.push(`Current NBC specified snow (ground): ${roundKpa(ra.specifiedSnowCurrentKPa)} kPa at ${ra.climateLocation || 'climate station'}.`);
  }

  const climateMethod = ra.climateMethod || site.climateMethod;
  if (climateMethod === 'idw' || site.climateInterpolated || ra.climateInterpolated) {
    riskFlags.push('IDW climate — interpolated Ss/Sr, lower confidence than exact Table C-2 station');
    drivers.push('Climate data uses IDW interpolation rather than a nearby listed station.');
  } else if (climateMethod === 'nearest') {
    drivers.push('Climate snapped to nearest Table C-2 station within tolerance.');
  } else if (climateMethod === 'exact') {
    drivers.push('Climate from exact Table C-2 station match.');
  }

  if (site.isWoodStructure) {
    riskFlags.push('Wood structure (Commentary L)');
    if (!site.satisfactoryPerformance) {
      riskFlags.push('No satisfactory performance history — higher diligence bar');
      drivers.push('Wood structure without satisfactory performance record increases Commentary L risk.');
    }
  }

  if (site.replaceBallastedWithAdhered) {
    drivers.push('Assessment assumes replacing ballasted roof with lighter adhered system.');
  }

  if (ra.originalDesignCode) {
    drivers.push(`Original design era: ${ra.originalDesignCode}.`);
  }

  return {
    siteId: site.id,
    name: site.name,
    assessed: true,
    pass: ra.pass,
    deltaKPa: roundKpa(delta),
    verdict: ra.pass ? 'pass' : 'fail',
    drivers,
    riskFlags,
    trailHighlights: trailLines(ra),
    site: summarizeSiteDetail(site),
  };
}

export function rankPortfolioSites(sites, { metric = 'deltaKPa', order = 'desc', limit = 5, passOnly, failOnly } = {}) {
  let pool = assessedSites(sites);
  if (passOnly) pool = pool.filter((s) => s.reserveAssessment.pass);
  if (failOnly) pool = pool.filter((s) => !s.reserveAssessment.pass);

  const field =
    metric === 'constructionYear'
      ? (s) => s.constructionYear
      : (s) => s.reserveAssessment?.deltaKPa;

  const dir = order === 'asc' ? 1 : -1;
  const ranked = [...pool]
    .sort((a, b) => {
      const av = field(a) ?? (order === 'asc' ? Infinity : -Infinity);
      const bv = field(b) ?? (order === 'asc' ? Infinity : -Infinity);
      return (av - bv) * dir;
    })
    .slice(0, Math.min(Math.max(limit, 1), 15))
    .map(summarizeSite);

  return {
    metric,
    order,
    limit: ranked.length,
    passOnly: Boolean(passOnly),
    failOnly: Boolean(failOnly),
    sites: ranked,
  };
}
