'use client';

export default function SiteDetail({ site, onClose }) {
  if (!site) return null;

  const ra = site.reserveAssessment;

  return (
    <div className="panel detail-overlay">
      <div className="form-row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{site.name}</h2>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="status-bar">
        {site.address} · {site.zoning} · built {site.constructionYear}
      </p>
      {ra ? (
        <>
          <p>
            <strong>Reserve:</strong>{' '}
            {ra.pass ? (
              <span className="badge badge-pass">PASS — proceed to detailed review</span>
            ) : (
              <span className="badge badge-fail">FAIL — no reserve for PV</span>
            )}{' '}
            (Δ {ra.deltaKPa} kPa)
          </p>
          <ul className="trail">
            {(ra.trail || []).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <p className="status-bar">{ra.disclaimer}</p>
        </>
      ) : (
        <p className="status-bar">Not assessed yet. Click “Assess all sites”.</p>
      )}
    </div>
  );
}
