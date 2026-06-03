'use client';

import { useState } from 'react';

const EXAMPLES = [
  'Sites with roof reserve for solar and commercial zoning with at least 30m road frontage',
  'Industrial sites that fail reserve assessment',
  'Commercial sites built after 1990 with reserve pass, sorted by highest delta',
];

export default function QueryBar({ onPlan, loading, setLoading }) {
  const [query, setQuery] = useState('');

  async function runSearch() {
    if (!query.trim()) return;
    setLoading?.(true);
    const res = await fetch('/api/query-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query.trim() }),
    });
    const data = await res.json();
    setLoading?.(false);
    if (!res.ok) {
      onPlan?.(null, data.error || 'Query failed');
      return;
    }
    onPlan?.(data.plan, null, data.plan?.explanation);
  }

  return (
    <div className="panel">
      <h2>AI search (Cohere)</h2>
      <textarea
        className="query-input"
        placeholder="Describe sites to find…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={3}
      />
      <div className="form-row" style={{ marginTop: '0.5rem' }}>
        <button type="button" className="btn" disabled={loading} onClick={runSearch}>
          {loading ? 'Thinking…' : 'Search'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => onPlan?.({ filters: [] }, null, 'Showing all sites')}
        >
          Clear filters
        </button>
      </div>
      <p className="status-bar" style={{ marginTop: '0.5rem' }}>
        Try:{' '}
        {EXAMPLES.map((ex, i) => (
          <button
            key={i}
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.7rem', margin: '0.15rem', padding: '0.2rem 0.4rem' }}
            onClick={() => setQuery(ex)}
          >
            Example {i + 1}
          </button>
        ))}
      </p>
    </div>
  );
}
