/** Stakeholder summary CSV from assessed portfolio sites. */

import { formatKpa } from '@/lib/formatNumbers';

function csvCell(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(values) {
  return values.map(csvCell).join(',');
}

export function buildAssessmentCsv(sites) {
  const headers = [
    'Site name',
    'Address',
    'Province (climate)',
    'Construction year',
    'Design code (historic)',
    'Climate station',
    'Ss (kPa)',
    'Sr (kPa)',
    'Climate method',
    'Reserve pass',
    'Delta reserve (kPa)',
    'Historic factored snow (kPa)',
    'Current demand total (kPa)',
    'Zoning',
    'Road frontage (m)',
    'Assessed at',
  ];

  const lines = [row(headers)];

  for (const site of sites) {
    const ra = site.reserveAssessment;
    if (!ra) continue;

    const province =
      site.locationKey?.split('_').pop()?.toUpperCase() ||
      site.address?.match(/,\s*([A-Z]{2})\s*$/)?.[1] ||
      '';

    lines.push(
      row([
        site.name,
        site.address,
        province,
        site.constructionYear,
        ra.originalDesignCode,
        ra.climateLocation,
        ra.ssKPa != null ? formatKpa(ra.ssKPa) : '',
        ra.srKPa != null ? formatKpa(ra.srKPa) : '',
        ra.climateMethod || (ra.climateInterpolated ? 'interpolated' : 'exact'),
        ra.pass ? 'PASS' : 'FAIL',
        formatKpa(ra.deltaKPa),
        formatKpa(ra.factoredHistoricKPa),
        formatKpa(ra.totalActualDemandKPa),
        site.zoning,
        site.roadFrontageM,
        site.assessedAt || '',
      ])
    );
  }

  return lines.join('\r\n');
}

export function downloadAssessmentCsv(sites, filenamePrefix = 'roof-reserve-summary') {
  const assessed = sites.filter((s) => s.reserveAssessment);
  if (!assessed.length) {
    throw new Error('No assessed sites - run “Assess all sites” first.');
  }
  const csv = buildAssessmentCsv(assessed);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
