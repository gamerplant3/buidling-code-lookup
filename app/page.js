'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MapView from '@/components/MapView';
import GlobeMini from '@/components/GlobeMini';
import AgentPanel from '@/components/AgentPanel';
import CollapsibleRail from '@/components/CollapsibleRail';
import SiteForm from '@/components/SiteForm';
import SiteList from '@/components/SiteList';
import SiteDetail from '@/components/SiteDetail';
import { buildSiteFromDiligence } from '@/lib/agent/diligenceSnapshot';
import { AGENT_SIDEBAR_TITLE } from '@/lib/agent/agentMeta';
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
  const [selectedId, setSelectedId] = useState(null);
  const [climateCities, setClimateCities] = useState([]);
  const [status, setStatus] = useState('Loading…');
  const [agentLoading, setAgentLoading] = useState(false);
  const [assessLoading, setAssessLoading] = useState(false);
  const [reassessId, setReassessId] = useState(null);
  const [climateVersion, setClimateVersion] = useState(null);
  const [staleAssessments, setStaleAssessments] = useState(false);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [rightRailOpen, setRightRailOpen] = useState(true);
  const [mapFocus, setMapFocus] = useState(null);
  const [agentModel, setAgentModel] = useState(null);

  const initDemo = useCallback(async () => {
    const res = await fetch('/api/demo-sites');
    if (!res.ok) throw new Error('Could not load demo portfolio');
    const demo = await res.json();
    await saveAllSites(demo);
    setAllSites(demo);
    setSelectedId(null);
    setFilterPlan(null);
    setStaleAssessments(true);
    setStatus(`Loaded demo portfolio (${demo.length} sites). Click “Assess all sites”.`);
  }, []);

  useEffect(() => {
    fetch('/api/agent/config')
      .then((r) => r.json())
      .then((d) => setAgentModel(d.model))
      .catch(() => setAgentModel('command-r-08-2024'));
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

  function handleAgentResult(turn) {
    if (turn.applyPortfolioFilter && turn.filterPlan) {
      setFilterPlan(turn.filterPlan);
      const { matched: m } = applyFilterPlan(allSites, turn.filterPlan);
      setStatus(`Agent filter — ${m} of ${allSites.length} sites match.`);
    } else if (turn.applyPortfolioFilter && turn.matchedSiteIds?.length) {
      setStatus(`Agent found ${turn.matchedSiteIds.length} matching site(s).`);
    }
    if (turn.mapFocus) {
      setMapFocus(turn.mapFocus);
      setSelectedId(null);
    }
    if (turn.siteToAdd) {
      void handleSaveSite(turn.siteToAdd).then(() => {
        setSelectedId(turn.siteToAdd.id);
        setStatus(`Added ${turn.siteToAdd.name} to portfolio.`);
      });
      return;
    }
    if (!turn.mapFocus) {
      const highlight = turn.highlightSiteIds?.[0] || turn.matchedSiteIds?.[0];
      if (highlight) setSelectedId(highlight);
    }
  }

  async function handleAddDiligenceSite(snapshot) {
    const site = buildSiteFromDiligence(snapshot);
    await handleSaveSite(site);
    setSelectedId(site.id);
    setMapFocus({ lat: site.lat, lng: site.lng, label: site.name });
    setStatus(`Added ${site.name} to portfolio.`);
  }

  function handleClearAgentFilters() {
    setFilterPlan(null);
    setStatus(`Showing all ${allSites.length} sites.`);
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

  const layoutClass = [
    'layout',
    leftRailOpen ? '' : 'layout--left-collapsed',
    rightRailOpen ? '' : 'layout--right-collapsed',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClass}>
      <header className="header">
        <div className="header-title-row">
          <h1>Building Code Lookup</h1>
          <span className="header-tagline">
            Roof snow reserve screening (NBC 2015) · AI agent (Cohere{' '}
            {agentModel || '…'})
          </span>
        </div>
        {staleAssessments && (
          <p className="status-bar header-stale" style={{ color: 'var(--fail)' }}>
            Assessments are out of date - run “Assess all” or re-assess individual sites.
          </p>
        )}
      </header>

      <CollapsibleRail
        side="left"
        title="Portfolio"
        open={leftRailOpen}
        onToggle={() => setLeftRailOpen((v) => !v)}
      >
        <div className="panel portfolio-panel">
          <h2>
            Sites {matched}/{allSites.length}
          </h2>
          {filterPlan && (
            <p className="status-bar portfolio-filter-hint">
              Filtered ·{' '}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearAgentFilters}
              >
                All
              </button>
            </p>
          )}
          <div className="portfolio-actions">
            <button
              type="button"
              className="btn btn-sm"
              disabled={assessLoading || !!reassessId || agentLoading}
              onClick={handleAssessAll}
            >
              {assessLoading ? '…' : 'Assess'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={assessLoading}
              onClick={handleExportCsv}
            >
              CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => exportSitesJson(allSites)}
            >
              JSON
            </button>
            <label className="btn btn-secondary btn-sm portfolio-file-btn">
              Import
              <input type="file" accept=".json" hidden onChange={handleImport} />
            </label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={initDemo}>
              Reset
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={!selectedId}
              onClick={handleDeleteSelected}
            >
              Delete
            </button>
          </div>
          <p className="status-bar portfolio-status">{status}</p>
          <SiteList sites={visibleSites} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        <SiteForm
          climateCities={climateCities}
          onSave={handleSaveSite}
          onUpdate={handleUpdateSite}
          editSite={selectedSite}
        />
      </CollapsibleRail>

      <main className="main">
        <MapView
          sites={visibleSites}
          selectedId={selectedId}
          onSelectSite={setSelectedId}
          mapFocus={mapFocus}
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

      <CollapsibleRail
        side="right"
        title={AGENT_SIDEBAR_TITLE}
        open={rightRailOpen}
        onToggle={() => setRightRailOpen((v) => !v)}
      >
        <AgentPanel
          sites={allSites}
          loading={agentLoading}
          onLoadingChange={setAgentLoading}
          onAgentResult={handleAgentResult}
          onClearFilters={handleClearAgentFilters}
          onSelectSite={setSelectedId}
          onAddDiligenceSite={handleAddDiligenceSite}
          onMapFocus={setMapFocus}
        />
      </CollapsibleRail>
    </div>
  );
}
