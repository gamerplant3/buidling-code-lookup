'use client';

import { formatKpa } from '@/lib/formatNumbers';

export default function SiteList({ sites, selectedId, onSelect }) {
  if (!sites.length) {
    return <p className="status-bar">No sites match the current filter.</p>;
  }

  return (
    <ul className="site-list">
      {sites.map((site) => {
        const pass = site.reserveAssessment?.pass;
        const badge =
          pass === true ? (
            <span className="badge badge-pass">PASS</span>
          ) : pass === false ? (
            <span className="badge badge-fail">FAIL</span>
          ) : (
            <span className="badge badge-unknown">-</span>
          );

        return (
          <li
            key={site.id}
            className={site.id === selectedId ? 'active' : ''}
            onClick={() => onSelect?.(site.id)}
            onKeyDown={(e) => e.key === 'Enter' && onSelect?.(site.id)}
            role="button"
            tabIndex={0}
          >
            <strong>{site.name}</strong> {badge}
            <br />
            <span className="status-bar">
              {site.zoning} · {site.roadFrontageM}m frontage
              {site.reserveAssessment?.deltaKPa != null &&
                ` · Δ ${formatKpa(site.reserveAssessment.deltaKPa)} kPa`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
