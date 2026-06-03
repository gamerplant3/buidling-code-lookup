'use client';

import { isAssessmentStale } from '@/lib/climateVersion';
import { formatKpa, formatTrailLine } from '@/lib/formatNumbers';
import { splitAssessmentTrail } from '@/lib/trailSections';

const COMMENTARY_L_HELP = (
  <>
    <strong>Commentary L</strong> is non-mandatory guidance in the National Model Construction 
    Codes (bundled with NBC) about reliability when you change how an existing building is used 
    or loaded, for example adding solar PV on a roof that was designed decades ago.
    <br />
    <br />
    It discusses when the effective safety level on the current demand side may be raised or lowered
    based on structure type and performance history. It's not a substitute for a project-specific
    structural review.
  </>
);

export default function SiteDetail({
  site,
  climateVersion,
  onClose,
  onReassess,
  reassessLoading,
}) {
  if (!site) return null;

  const ra = site.reserveAssessment;
  const stale = isAssessmentStale(site, climateVersion);
  const { lookup, calc } = splitAssessmentTrail(ra);
  const lookupLines = lookup.map(formatTrailLine).filter(Boolean);
  const calcLines = calc.map(formatTrailLine).filter(Boolean);
  const caseLabel =
    ra?.assessmentCase?.label || 'Flat roof - uniform load sample';
  const caseDims = ra?.assessmentCase
    ? `L × W = ${ra.assessmentCase.roofLM} m × ${ra.assessmentCase.roofWM} m, slope ${ra.assessmentCase.roofSlopeDeg}°, Ca = ${ra.assessmentCase.ca}`
    : 'L × W = 14 m × 9.5 m, slope 0°, Ca = 1';

  return (
    <div className="panel detail-overlay">
      <div className="form-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{site.name}</h2>
        <div className="form-row">
          {onReassess && (
            <button
              type="button"
              className="btn"
              disabled={reassessLoading}
              onClick={() => onReassess(site)}
            >
              {reassessLoading ? 'Assessing…' : 'Assess Now'}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <p className="status-bar">
        {site.address} · {site.zoning} · built {site.constructionYear}
        {site.elevationM != null && ` · ${site.elevationM} m elev.`}
      </p>
      {stale && (
        <p className="status-bar" style={{ color: 'var(--fail)' }}>
          Assessment is stale - results below may show old Ss values. Click “Assess all sites”.
        </p>
      )}
      {ra ? (
        <>
          <p>
            <strong>Reserve:</strong>{' '}
            {ra.pass ? (
              <span className="badge badge-pass">PASS - proceed to detailed review</span>
            ) : (
              <span className="badge badge-fail">FAIL - no reserve for PV</span>
            )}{' '}
            (Δ {formatKpa(ra.deltaKPa)} kPa)
          </p>

          <p className="assessment-case-banner">
            <strong>Sample calculation</strong> - {caseLabel}
            <br />
            <span className="status-bar">{caseDims} · {ra.assessmentCase?.standard || 'NBC 2015 §4.1.6.2'}</span>
          </p>

          <section className="trail-section">
            <h3 className="trail-section-title">Climate &amp; code lookup</h3>
            <ul className="trail trail-lookup">
              {lookupLines.map((line, i) => (
                <li key={`l-${i}`}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="trail-section">
            <h3 className="trail-section-title">Specified snow &amp; reserve (sample)</h3>
            <ul className="trail trail-calc">
              {calcLines.map((line, i) => (
                <li key={`c-${i}`}>{line}</li>
              ))}
            </ul>
          </section>

          {(ra.sourceRefs?.length > 0 || calc.some((l) => String(l).includes('Commentary L'))) && (
            <details className="trail-help">
              <summary>What is Commentary L?</summary>
              <p className="status-bar">{COMMENTARY_L_HELP}</p>
            </details>
          )}

          {ra.sourceRefs?.length > 0 && (
            <p className="source-refs status-bar">
              <strong>Sources:</strong>{' '}
              {ra.sourceRefs.map((s) => s.label).join(' · ')}
            </p>
          )}

          <p className="status-bar disclaimer">{ra.disclaimer}</p>
        </>
      ) : (
        <p className="status-bar">Not assessed yet. Click “Assess".</p>
      )}
    </div>
  );
}
