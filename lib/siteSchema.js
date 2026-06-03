/**
 * Site fields exposed to Cohere for NL → filter translation.
 * Keep in sync with SiteForm and applyFilters.
 */
export const SITE_FILTER_FIELDS = [
  { field: 'reserveAssessment.pass', type: 'boolean', description: 'True if site has reserve roof capacity for solar (PV)' },
  { field: 'reserveAssessment.deltaKPa', type: 'number', description: 'Reserve margin in kPa when pass is true' },
  { field: 'name', type: 'string', description: 'Site display name' },
  { field: 'address', type: 'string', description: 'Street or city address' },
  { field: 'zoning', type: 'string', description: 'Zoning class e.g. commercial, industrial, residential' },
  { field: 'roadFrontageM', type: 'number', description: 'Road frontage in metres' },
  { field: 'constructionYear', type: 'number', description: 'Year building was constructed' },
  { field: 'locationKey', type: 'string', description: 'Table C-2 station key e.g. london_on, toronto_city_hall_on' },
  { field: 'isWoodStructure', type: 'boolean', description: 'Wood structure (Commentary L high risk)' },
  { field: 'satisfactoryPerformance', type: 'boolean', description: 'Record of satisfactory performance' },
  { field: 'replaceBallastedWithAdhered', type: 'boolean', description: 'Plan to replace ballasted roof with adhered' },
  { field: 'climateInterpolated', type: 'boolean', description: 'True if Ss/Sr used IDW (not exact Table C-2 station)' },
  {
    field: 'climateMethod',
    type: 'string',
    description: 'Climate lookup: exact, nearest, or idw (after assess)',
  },
  {
    field: 'reserveAssessment.climateMethod',
    type: 'string',
    description: 'Same as climateMethod on latest assessment',
  },
];

export const FILTER_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains'];

export function filterSchemaPrompt() {
  return JSON.stringify(
    {
      allowedFields: SITE_FILTER_FIELDS.map((f) => f.field),
      allowedOps: FILTER_OPS,
      outputShape: {
        filters: [{ field: 'string', op: 'string', value: 'any' }],
        sort: { field: 'string', dir: 'asc|desc' },
        explanation: 'string - brief plain English summary',
      },
    },
    null,
    2
  );
}
