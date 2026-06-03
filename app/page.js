'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MapView from '@/components/MapView';
import GlobeMini from '@/components/GlobeMini';
import QueryBar from '@/components/QueryBar';
import SiteForm from '@/components/SiteForm';
import SiteList from '@/components/SiteList';
import SiteDetail from '@/components/SiteDetail';
import { applyFilterPlan } from '@/lib/applyFilters';
import { assessAllSites, assessSite } from '@/lib/assessSite';
import { downloadAssessmentCsv } from '@/lib/exportAssessmentCsv';
import {
  loadSites,
  saveAllSites,
  saveSite,
  deleteSite,
  exportSitesJson,
  importSitesFromFile,
} from '@/lib/sitesStore';
import { fetchClimateVersion, sitesNeedReassess } from '@/lib/climateVersion';
import {
  reconcileStoredSitesWithDemo,
  stripPortfolioAssessments,
} from '@/lib/demoSites';

export default function HomePage() {
  const [allSites, setAllSites] = useState([]);
  const [filterPlan, setFilterPlan] = useState(null);
  const [planExplanation, setPlanExplanation] = useState('');
  const [planError, setPlanError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [climateCities, setClimateCities] = useState([]);
  const [status, setStatus] = useState('Loading…');
  const [queryLoading, setQueryLoading] = useState(false);
  const [assessLoading, setAssessLoading] = useState(false);
  const [reassessId, setReassessId] = useState(null);
  const [climateVersion, setClimateVersion] = useState(null);
  const [staleAssessments, setStaleAssessments] = useState(false);

  const initDemo = useCallback(async () => {
    const res = await fetch('/api/demo-sites');
    if (!res.ok) throw new Error('Could not load demo portfolio');
    const demo = await res.json();
    await saveAllSites(demo);
    setAllSites(demo);
    setSelectedId(null);
    setStaleAssessments(true);
    setStatus(`Loaded demo portfolio (${demo.length} sites). Click “Assess all sites”.`);
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const climateRes = await fetch('/api/climate');
        const climate = await climateRes.json();
        setClimateCities(climate.locations || []);
        const version =
          climate.climateVersion ||
          `pcic-${climate.withSnowCount || 0}-${climate.locationCount || 0}`;
        setClimateVersion(version);

        let sites = await loadSites();
        let demoMetadataFixed = false;
        if (!sites.length) {
          await initDemo();
          sites = await loadSites();
        } else {
          const demoRes = await fetch('/api/demo-sites');
          if (demoRes.ok) {
            const demo = await demoRes.json();
            const { sites: reconciled, metadataChanged } =
              reconcileStoredSitesWithDemo(sites, demo);
            if (metadataChanged) {
              sites = reconciled;
              await saveAllSites(sites);
              demoMetadataFixed = true;
            }
          }
        }

        let stale = sitesNeedReassess(sites, version) || demoMetadataFixed;
        if (stale) {
          sites = stripPortfolioAssessments(sites);
          await saveAllSites(sites);
        }

        setAllSites(sites);
        setStaleAssessments(stale);
        setStatus(
          stale
            ? `Ready - ${sites.length} sites. Click “Assess all sites” (climate data updated).`
            : `Ready - ${sites.length} sites in local storage.`
        );
      } catch (e) {
        setStatus(`Boot error: ${e.message}`);
      }
    }
    boot();
  }, [initDemo]);

  const { sites: visibleSites, matched } = useMemo(() => {
    return applyFilterPlan(allSites, filterPlan);
  }, [allSites, filterPlan]);

  const selectedSite = visibleSites.find((s) => s.id === selectedId) ||
    allSites.find((s) => s.id === selectedId);

  async function handlePlan(plan, error, explanation) {
    setQueryLoading(false);
    setPlanError(error || '');
    setPlanExplanation(explanation || '');
    setFilterPlan(plan);
    if (plan && !error) {
      setStatus(`Filter applied - ${applyFilterPlan(allSites, plan).matched} of ${allSites.length} sites match.`);
    }
  }

  async function handleAssessAll() {
    setAssessLoading(true);
    setStatus('Running reserve assessments…');
    try {
      const updated = await assessAllSites(
        allSites,
        (done, total) => {
          setStatus(`Assessing ${done}/${total}…`);
        },
        climateCities
      );
      await saveAllSites(updated);
      setAllSites(updated);
      setStaleAssessments(false);
      setStatus(`Assessed ${updated.length} sites.`);
      if (filterPlan) {
        const { matched: m } = applyFilterPlan(updated, filterPlan);
        setStatus(`Assessed ${updated.length} sites - ${m} match current filter.`);
      }
    } catch (e) {
      setStatus(`Assessment failed: ${e.message}`);
    } finally {
      setAssessLoading(false);
    }
  }

  async function handleReassessSite(site) {
    if (!site?.id) return;
    setReassessId(site.id);
    setStatus(`Reassessing ${site.name}…`);
    try {
      const assessed = await assessSite(site, undefined, climateCities);
      await saveSite(assessed);
      const next = allSites.map((s) => (s.id === assessed.id ? assessed : s));
      setAllSites(next);
      setStaleAssessments(false);
      setStatus(`Reassessed ${assessed.name}.`);
    } catch (e) {
      setStatus(`Reassess failed: ${e.message}`);
    } finally {
      setReassessId(null);
    }
  }

  async function handleSaveSite(site) {
    const assessed = await assessSite(site, undefined, climateCities).catch(() => site);
    await saveSite(assessed);
    const next = [...allSites.filter((s) => s.id !== assessed.id), assessed];
    setAllSites(next);
    setStatus(`Saved ${assessed.name}.`);
  }

  async function handleUpdateSite(site) {
    const assessed = await assessSite(site, undefined, climateCities).catch(() => site);
    await saveSite(assessed);
    const next = allSites.map((s) => (s.id === assessed.id ? assessed : s));
    setAllSites(next);
    setStaleAssessments(false);
    setStatus(`Updated ${assessed.name}.`);
  }

  async function handleDeleteSelected() {
    if (!selectedId) return;
    await deleteSite(selectedId);
    const next = allSites.filter((s) => s.id !== selectedId);
    setAllSites(next);
    setSelectedId(null);
    setStatus('Site deleted.');
  }

  function handleExportCsv() {
    try {
      const scope = filterPlan ? visibleSites : allSites;
      downloadAssessmentCsv(scope);
      setStatus(`Exported CSV (${scope.filter((s) => s.reserveAssessment).length} assessed sites).`);
    } catch (e) {
      setStatus(e.message);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const imported = await importSitesFromFile(file);
    setAllSites(imported);
    setStatus(`Imported ${imported.length} sites.`);
  }

  return (
    <div className="layout">
      <header className="header">
        <h1>Building Code Lookup</h1>
        <p>Roof snow reserve screening (NBC) · AI portfolio filters</p>
        {staleAssessments && (
          <p className="status-bar" style={{ color: 'var(--fail)', marginTop: '0.5rem' }}>
            Assessments are out of date - run “Assess all” or re-assess individual sites.
          </p>
        )}
      </header>

      <aside className="sidebar">
        <QueryBar
          loading={queryLoading}
          setLoading={setQueryLoading}
          onPlan={handlePlan}
        />

        {planExplanation && (
          <p className="status-bar">
            <strong>AI:</strong> {planExplanation}
          </p>
        )}
        {planError && <p className="status-bar" style={{ color: 'var(--fail)' }}>{planError}</p>}
        {filterPlan && (
          <pre className="plan-json">{JSON.stringify(filterPlan, null, 2)}</pre>
        )}

        <div className="panel">
          <h2>Portfolio ({matched}/{allSites.length})</h2>
          <div className="form-row">
            <button
              type="button"
              className="btn"
              disabled={assessLoading || !!reassessId}
              onClick={handleAssessAll}
            >
              {assessLoading ? 'Assessing…' : 'Assess all sites'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={assessLoading}
              onClick={handleExportCsv}
            >
              Export CSV
            </button>
          </div>
          <div className="form-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportSitesJson(allSites)}
            >
              Export JSON
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              Import JSON
              <input type="file" accept=".json" hidden onChange={handleImport} />
            </label>
          </div>
          <div className="form-row">
            <button type="button" className="btn btn-secondary" onClick={initDemo}>
              Reset demo
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={!selectedId}
              onClick={handleDeleteSelected}
            >
              Delete
            </button>
          </div>
          <p className="status-bar">{status}</p>
          <SiteList sites={visibleSites} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <SiteForm
          climateCities={climateCities}
          onSave={handleSaveSite}
          onUpdate={handleUpdateSite}
          editSite={selectedSite}
        />
      </aside>

      <main className="main">
        <MapView
          sites={visibleSites}
          selectedId={selectedId}
          onSelectSite={setSelectedId}
        />
        <GlobeMini sites={visibleSites} />
        <SiteDetail
          site={selectedSite}
          climateVersion={climateVersion}
          reassessLoading={reassessId === selectedSite?.id}
          onReassess={handleReassessSite}
          onClose={() => setSelectedId(null)}
        />
      </main>
    </div>
  );
}
