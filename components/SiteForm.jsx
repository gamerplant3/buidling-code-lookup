'use client';

import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import CollapsiblePanel from '@/components/CollapsiblePanel';
const EMPTY = {
  name: '',
  address: '',
  lat: '',
  lng: '',
  elevationM: '',
  constructionYear: 1990,
  locationKey: '',
  zoning: 'commercial',
  roadFrontageM: 30,
  replaceBallastedWithAdhered: false,
  isWoodStructure: false,
  satisfactoryPerformance: false,
  roofWeightExistingKPa: 0.35,
  roofWeightNewKPa: 0.22,
  roofLM: 14,
  roofWM: 9.5,
  roofSlopeDeg: 0,
  roofSlippery: false,
  importance: 'normal',
  cwReduction: 'none',
};

function siteToForm(site) {
  if (!site) return EMPTY;
  return {
    ...EMPTY,
    ...site,
    lat: site.lat ?? '',
    lng: site.lng ?? '',
    elevationM: site.elevationM ?? '',
  };
}

export default function SiteForm({ onSave, onUpdate, climateCities, editSite }) {
  const [form, setForm] = useState(EMPTY);
  const editing = Boolean(editSite?.id);
  const [geocodeQ, setGeocodeQ] = useState('');
  const [geocodeResults, setGeocodeResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [geoHint, setGeoHint] = useState('');

  useEffect(() => {
    if (editSite?.id) setForm(siteToForm(editSite));
  }, [editSite?.id]);

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

  async function pickGeocode(r) {
    const lat = r.lat;
    const lng = r.lng;
    setForm((f) => ({
      ...f,
      address: r.label || r.name,
      lat,
      lng,
    }));
    setGeocodeResults([]);
    setGeoHint('Looking up climate, zoning, elevation…');

    try {
      const res = await fetch(
        `/api/site-enrich?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
      );
      if (!res.ok) {
        setGeoHint('Enrichment failed — enter fields manually.');
        return;
      }
      const { patch, hints } = await res.json();
      setForm((f) => {
        const next = { ...f, ...patch };
        if (!patch.locationKey) delete next.locationKey;
        return next;
      });
      setGeoHint(hints?.length ? hints.join(' · ') : 'Saved coordinates — assess for snow loads.');
    } catch {
      setGeoHint('Enrichment failed — enter fields manually.');
    }
  }

  function buildSitePayload() {
    return {
      id: editing ? editSite.id : uuidv4(),
      ...form,
      lat: form.lat === '' ? null : Number(form.lat),
      lng: form.lng === '' ? null : Number(form.lng),
      elevationM:
        form.elevationM === '' || form.elevationM == null
          ? undefined
          : Number(form.elevationM),
      constructionYear: Number(form.constructionYear),
      roadFrontageM: Number(form.roadFrontageM),
      roofWeightExistingKPa: Number(form.roofWeightExistingKPa),
      roofWeightNewKPa: Number(form.roofWeightNewKPa),
      roofLM: Number(form.roofLM),
      roofWM: Number(form.roofWM),
      roofSlopeDeg: Number(form.roofSlopeDeg),
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const site = buildSitePayload();
    if (editing) {
      await onUpdate?.(site);
    } else {
      await onSave?.(site);
      setForm(EMPTY);
    }
    setGeocodeResults([]);
    setGeoHint('');
  }

  return (
    <CollapsiblePanel
      title={editing ? `Edit site - ${editSite.name}` : 'Add site'}
      defaultOpen={false}
      openWhen={editing}
    >
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
        {geoHint && <p className="status-bar">{geoHint}</p>}
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
          <select
            value={form.locationKey}
            onChange={(e) => {
              const key = e.target.value;
              const row = (climateCities || []).find((c) => c.key === key);
              if (row) {
                setForm((f) => ({
                  ...f,
                  locationKey: key,
                  lat: row.lat,
                  lng: row.lng,
                }));
              } else {
                update('locationKey', key);
              }
            }}
          >
            <option value="">Auto (nearest)</option>
            {(climateCities || []).map((c) => (
              <option
                key={`${c.key}-${c.province}-${c.lat}-${c.lng}`}
                value={c.key}
              >
                {c.name}{c.province ? `, ${c.province}` : ''}
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
        <p className="status-bar" style={{ gridColumn: '1 / -1', margin: 0 }}>
          Roof sample (NBC 2015 flat / uniform, Ca = 1)
        </p>
        <div className="form-row">
          <label style={{ flex: 1 }}>
            Length L (m)
            <input
              type="number"
              step="0.5"
              value={form.roofLM}
              onChange={(e) => update('roofLM', e.target.value)}
            />
          </label>
          <label style={{ flex: 1 }}>
            Width W (m)
            <input
              type="number"
              step="0.5"
              value={form.roofWM}
              onChange={(e) => update('roofWM', e.target.value)}
            />
          </label>
        </div>
        <label>
          Roof slope (degrees)
          <input
            type="number"
            step="1"
            value={form.roofSlopeDeg}
            onChange={(e) => update('roofSlopeDeg', e.target.value)}
          />
        </label>
        <label>
          Snow exposure factor Cw (reduces ground snow on roof)
          <select value={form.cwReduction} onChange={(e) => update('cwReduction', e.target.value)}>
            <option value="none">None (default open terrain)</option>
            <option value="rural">Rural / sheltered</option>
            <option value="exposed_treeline">Exposed treeline</option>
          </select>
        </label>
        <label>
          Building importance (snow Is factor)
          <select value={form.importance} onChange={(e) => update('importance', e.target.value)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="post_disaster">Post-disaster</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.roofSlippery}
            onChange={(e) => update('roofSlippery', e.target.checked)}
          />{' '}
          Slippery roof surface (Cs)
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
          {editing ? 'Update site & re-assess' : 'Save site (assess on save)'}
        </button>
        {editing && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setForm(EMPTY);
              setGeoHint('');
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
    </CollapsiblePanel>
  );
}
