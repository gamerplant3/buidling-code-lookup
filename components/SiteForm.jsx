'use client';

import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const EMPTY = {
  name: '',
  address: '',
  lat: '',
  lng: '',
  constructionYear: 1990,
  locationKey: '',
  zoning: 'commercial',
  roadFrontageM: 30,
  replaceBallastedWithAdhered: false,
  isWoodStructure: false,
  satisfactoryPerformance: false,
  roofWeightExistingKPa: 0.35,
  roofWeightNewKPa: 0.22,
};

export default function SiteForm({ onSave, climateCities }) {
  const [form, setForm] = useState(EMPTY);
  const [geocodeQ, setGeocodeQ] = useState('');
  const [geocodeResults, setGeocodeResults] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (form.address && !geocodeQ) setGeocodeQ(form.address);
  }, [form.address, geocodeQ]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function runGeocode() {
    if (!geocodeQ || geocodeQ.length < 3) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(geocodeQ)}`);
      const data = await res.json();
      setGeocodeResults(data.results || []);
    } finally {
      setBusy(false);
    }
  }

  function pickGeocode(r) {
    update('address', r.label || r.name);
    update('lat', r.lat);
    update('lng', r.lng);
    setGeocodeResults([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const site = {
      id: uuidv4(),
      ...form,
      lat: form.lat === '' ? null : Number(form.lat),
      lng: form.lng === '' ? null : Number(form.lng),
      constructionYear: Number(form.constructionYear),
      roadFrontageM: Number(form.roadFrontageM),
      roofWeightExistingKPa: Number(form.roofWeightExistingKPa),
      roofWeightNewKPa: Number(form.roofWeightNewKPa),
    };
    await onSave?.(site);
    setForm(EMPTY);
    setGeocodeResults([]);
  }

  return (
    <div className="panel">
      <h2>Add site</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={form.name} onChange={(e) => update('name', e.target.value)} required />
        </label>
        <label>
          Address / city
          <input value={form.address} onChange={(e) => update('address', e.target.value)} />
        </label>
        <div className="form-row">
          <input
            placeholder="Geocode search (Canada)"
            value={geocodeQ}
            onChange={(e) => setGeocodeQ(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={runGeocode}>
            Geocode
          </button>
        </div>
        {geocodeResults.length > 0 && (
          <ul className="site-list" style={{ maxHeight: 100 }}>
            {geocodeResults.map((r) => (
              <li key={r.id}>
                <button type="button" className="btn btn-secondary" style={{ width: '100%', textAlign: 'left' }} onClick={() => pickGeocode(r)}>
                  {r.label} ({r.lat?.toFixed(3)}, {r.lng?.toFixed(3)})
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="form-row">
          <label style={{ flex: 1 }}>
            Lat
            <input value={form.lat} onChange={(e) => update('lat', e.target.value)} />
          </label>
          <label style={{ flex: 1 }}>
            Lng
            <input value={form.lng} onChange={(e) => update('lng', e.target.value)} />
          </label>
        </div>
        <label>
          Climate city (Table C-2)
          <select value={form.locationKey} onChange={(e) => update('locationKey', e.target.value)}>
            <option value="">Auto (nearest)</option>
            {(climateCities || []).map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Construction year
          <input
            type="number"
            value={form.constructionYear}
            onChange={(e) => update('constructionYear', e.target.value)}
          />
        </label>
        <label>
          Zoning
          <select value={form.zoning} onChange={(e) => update('zoning', e.target.value)}>
            <option value="commercial">commercial</option>
            <option value="industrial">industrial</option>
            <option value="residential">residential</option>
            <option value="mixed">mixed</option>
          </select>
        </label>
        <label>
          Road frontage (m)
          <input
            type="number"
            value={form.roadFrontageM}
            onChange={(e) => update('roadFrontageM', e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.replaceBallastedWithAdhered}
            onChange={(e) => update('replaceBallastedWithAdhered', e.target.checked)}
          />{' '}
          Replace ballasted with adhered roof
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.isWoodStructure}
            onChange={(e) => update('isWoodStructure', e.target.checked)}
          />{' '}
          Wood / high-risk structure
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.satisfactoryPerformance}
            onChange={(e) => update('satisfactoryPerformance', e.target.checked)}
          />{' '}
          Satisfactory performance record
        </label>
        <button type="submit" className="btn">
          Save site (assess on next run)
        </button>
      </form>
    </div>
  );
}
