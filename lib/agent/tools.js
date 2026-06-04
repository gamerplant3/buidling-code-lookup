import { applyFilterPlan } from '@/lib/applyFilters';
import { normalizeFilterPlan } from '@/lib/siteSchema';
import { assessRoofReserve } from '@/lib/agent/assessServer';
import { editionForYear } from '@/lib/agent/codeEditions';
import { buildSiteFromDiligence, mergeDiligenceContext } from '@/lib/agent/diligenceSnapshot';
import { summarizeSite, summarizeSiteDetail } from '@/lib/agent/summarizeSite';
import { enrichSiteFromCoordinates } from '@/lib/siteEnrich';

const GEOLOCATOR = 'https://geolocator.nrcan.gc.ca/api/v1/search';

/** JSON Schema for portfolio filter values (Cohere strict_tools requires a type). */
const FILTER_VALUE_SCHEMA = {
  description: 'Filter comparison value (string, number, boolean, or string array for "in")',
  anyOf: [
    { type: 'string' },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'array', items: { type: 'string' } },
  ],
};

export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'geocode_address',
      description:
        'Geocode a Canadian address or place name to lat/lng candidates via NRCan Geolocator. Use before enrich_location or assess for new sites.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Address, city, or place name in Canada' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'enrich_location',
      description:
        'Climate snap/IDW hint, elevation, Toronto/Ottawa zoning, OSM frontage for coordinates. Call after geocode when assessing a new address.',
      parameters: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
        },
        required: ['lat', 'lng'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assess_roof_reserve',
      description:
        'Run NBC 2015 roof snow reserve screening (Python engine). NEVER estimate snow loads yourself - always use this tool. Requires lat/lng or locationKey.',
      parameters: {
        type: 'object',
        properties: {
          constructionYear: { type: 'number', description: 'Year built (for historic NBC edition factor)' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          locationKey: { type: 'string', description: 'Table C-2 station key when within 30 km snap' },
          elevationM: { type: 'number' },
          roofLM: { type: 'number', description: 'Characteristic roof length L (m), default 14' },
          roofWM: { type: 'number', description: 'Roof width W (m), default 9.5' },
          roofSlopeDeg: { type: 'number', description: 'Roof slope degrees, default 0 flat' },
          roofSlippery: { type: 'boolean' },
          importance: { type: 'string', enum: ['normal', 'post_disaster'] },
          cwReduction: { type: 'string', enum: ['none', 'rural', 'exposed_treeline'] },
          isWoodStructure: { type: 'boolean', description: 'Commentary L wood / high-risk flag' },
          satisfactoryPerformance: { type: 'boolean', description: 'Commentary L satisfactory performance' },
          replaceBallastedWithAdhered: {
            type: 'boolean',
            description: 'Use lighter adhered roof weight instead of existing ballasted',
          },
          roofWeightExistingKPa: { type: 'number', description: 'Existing roof dead load kPa, default 0.35' },
          roofWeightNewKPa: { type: 'number', description: 'New lighter roof kPa if replacing ballast, default 0.22' },
        },
        required: ['constructionYear'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_historic_edition',
      description: 'Historic NBC edition and snow load factor for a construction year (from code-editions.json).',
      parameters: {
        type: 'object',
        properties: {
          constructionYear: { type: 'number' },
        },
        required: ['constructionYear'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_portfolio',
      description:
        'Filter and sort sites in the loaded portfolio. Use ONLY when the user asks to filter, list, or search their portfolio. Set applyFilter true to update the map/site list UI.',
      parameters: {
        type: 'object',
        properties: {
          filters: {
            type: 'array',
            description: 'Filter clauses',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                op: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'] },
                value: FILTER_VALUE_SCHEMA,
              },
              required: ['field', 'op', 'value'],
            },
          },
          sort: {
            type: 'object',
            description: 'Optional sort (field required when sort is provided)',
            properties: {
              field: { type: 'string' },
              dir: { type: 'string', enum: ['asc', 'desc'] },
            },
            required: ['field'],
          },
          applyFilter: {
            type: 'boolean',
            description:
              'True only when the user explicitly asked to filter the portfolio view. False for background lookups.',
          },
        },
        required: ['filters'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_portfolio_site',
      description: 'Full assessment summary for one portfolio site by id (from search_portfolio or portfolio context).',
      parameters: {
        type: 'object',
        properties: {
          siteId: { type: 'string' },
        },
        required: ['siteId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_site_to_portfolio',
      description:
        'Add a completed new-address diligence result to the user portfolio. ONLY after the user explicitly confirms (yes / add / save to portfolio).',
      parameters: {
        type: 'object',
        properties: {
          confirmed: {
            type: 'boolean',
            description: 'Must be true - user explicitly asked to add the site',
          },
          name: { type: 'string', description: 'Optional display name override' },
        },
        required: ['confirmed'],
      },
    },
  },
];

function mapGeocodeFeatures(features, query) {
  return (Array.isArray(features) ? features : []).slice(0, 5).map((f, i) => {
    const props = f.properties || f;
    const coords = f.geometry?.coordinates || props.coordinates || [];
    const lng = coords[0] ?? props.longitude ?? props.lng ?? (f.lon != null ? Number(f.lon) : null);
    const lat = coords[1] ?? props.latitude ?? props.lat ?? (f.lat != null ? Number(f.lat) : null);
    return {
      id: props.id || f.place_id || i,
      name: props.name || props.label || f.display_name || query,
      label: props.label || props.name || f.display_name || query,
      lat: lat != null ? Number(lat) : null,
      lng: lng != null ? Number(lng) : null,
      province: props.province || props.admin1 || f.address?.state,
    };
  });
}

async function geocodeNrcan(query) {
  const url = new URL(GEOLOCATOR);
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('keys', 'geonames,nominatim');

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Geolocator HTTP ${res.status}`);

  const data = await res.json();
  const features = data?.features || data?.results || [];
  const results = mapGeocodeFeatures(features, query);
  return { found: results.length > 0, results, source: 'nrcan' };
}

async function geocodeNominatim(query) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'ca');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'building-code-lookup/0.1 (roof reserve screening)',
    },
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);

  const rows = await res.json();
  const results = mapGeocodeFeatures(rows, query).filter((r) => r.lat != null && r.lng != null);
  return { found: results.length > 0, results, source: 'nominatim' };
}

async function geocodeAddress(query) {
  try {
    return await geocodeNrcan(query);
  } catch {
    return geocodeNominatim(query);
  }
}

function trackDiligence(sideEffects, patch) {
  if (!sideEffects) return;
  sideEffects.lastDiligence = { ...(sideEffects.lastDiligence || {}), ...patch };
}

function setMapFocus(sideEffects, lat, lng, label) {
  if (!sideEffects || lat == null || lng == null) return;
  sideEffects.mapFocus = { lat: Number(lat), lng: Number(lng), label: label || null };
}

/** Trim large assess payloads for model context. */
function trimAssessment(assessment) {
  return {
    pass: assessment.pass,
    deltaKPa: assessment.deltaKPa,
    factoredHistoricKPa: assessment.factoredHistoricKPa,
    totalActualDemandKPa: assessment.totalActualDemandKPa,
    specifiedSnowCurrentKPa: assessment.specifiedSnowCurrentKPa,
    climateLocation: assessment.climateLocation,
    climateMethod: assessment.climateMethod,
    climateConfidence: assessment.climateConfidence,
    climateInterpolated: assessment.climateInterpolated,
    ssKPa: assessment.ssKPa,
    srKPa: assessment.srKPa,
    originalDesignCode: assessment.originalDesignCode,
    trailLookup: (assessment.trailLookup || []).slice(0, 4),
    trailCalc: (assessment.trailCalc || []).slice(0, 4),
  };
}

export async function executeAgentTool(name, args, ctx) {
  const { sites = [], sideEffects, diligenceContext } = ctx;

  switch (name) {
    case 'geocode_address': {
      const result = await geocodeAddress(String(args.query || ''));
      const results = (result.results || []).filter((r) => r.lat != null && r.lng != null);
      if (sideEffects) {
        if (results.length > 1) {
          sideEffects.geocodeCandidates = results;
          sideEffects.mapFocus = null;
        } else if (results.length === 1) {
          sideEffects.geocodeCandidates = null;
          const r = results[0];
          trackDiligence(sideEffects, { label: r.label, address: r.label, lat: r.lat, lng: r.lng });
          setMapFocus(sideEffects, r.lat, r.lng, r.label);
        }
      }
      return {
        ...result,
        results,
        found: results.length > 0,
        multiple: results.length > 1,
        ...(results.length > 1
          ? {
              uiShowsPicker: true,
              scoutNote:
                'UI shows location buttons. Do not list these results in prose. Do not ask to add to portfolio until user picks and assess completes.',
            }
          : {}),
      };
    }

    case 'enrich_location': {
      const lat = Number(args.lat);
      const lng = Number(args.lng);
      const result = await enrichSiteFromCoordinates(lat, lng);
      if (sideEffects) {
        trackDiligence(sideEffects, { lat, lng, ...(result.patch || {}) });
        setMapFocus(sideEffects, lat, lng, sideEffects.lastDiligence?.address);
      }
      return result;
    }

    case 'assess_roof_reserve': {
      const assessment = trimAssessment(await assessRoofReserve(args));
      if (sideEffects) {
        trackDiligence(sideEffects, {
          assessment,
          assessArgs: args,
          constructionYear: args.constructionYear,
          lat: args.lat,
          lng: args.lng,
        });
        setMapFocus(
          sideEffects,
          args.lat ?? sideEffects.lastDiligence?.lat,
          args.lng ?? sideEffects.lastDiligence?.lng,
          sideEffects.lastDiligence?.address
        );
      }
      return { assessment };
    }

    case 'get_historic_edition': {
      const edition = await editionForYear(args.constructionYear);
      return { edition };
    }

    case 'search_portfolio': {
      const plan = normalizeFilterPlan({
        filters: Array.isArray(args.filters) ? args.filters : [],
        sort: args.sort || undefined,
      });
      const { sites: matched, matched: count } = applyFilterPlan(sites, plan);
      if (sideEffects && args.applyFilter) {
        sideEffects.filterPlan = plan.filters.length ? plan : null;
        sideEffects.matchedSiteIds = matched.map((s) => s.id);
        sideEffects.applyPortfolioFilter = true;
      }
      return {
        matchedCount: count,
        totalCount: sites.length,
        sites: matched.map(summarizeSite),
      };
    }

    case 'get_portfolio_site': {
      const site = sites.find((s) => s.id === args.siteId);
      if (!site) return { error: `Site not found: ${args.siteId}` };
      if (sideEffects) sideEffects.highlightSiteIds = [site.id];
      return { site: summarizeSiteDetail(site) };
    }

    case 'add_site_to_portfolio': {
      if (!args.confirmed) {
        return { error: 'User must explicitly confirm before adding to portfolio.' };
      }
      const snap = mergeDiligenceContext(diligenceContext, sideEffects?.lastDiligence);
      if (!snap?.assessment) {
        return { error: 'No completed diligence assessment to add. Run assess_roof_reserve first.' };
      }
      if (args.name) snap.name = args.name;
      const site = buildSiteFromDiligence(snap);
      if (sideEffects) sideEffects.siteToAdd = site;
      return { added: true, siteId: site.id, name: site.name, address: site.address };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
