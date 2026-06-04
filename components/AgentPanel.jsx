'use client';

import { useRef, useState } from 'react';
import { extractDiligenceSnapshot } from '@/lib/agent/diligenceSnapshot';
import { AGENT_ROLE_LABEL } from '@/lib/agent/agentMeta';

const EXAMPLES = [
  'Assess a 1985 industrial warehouse at 100 King St W, Toronto for rooftop solar. Flat ballasted roof.',
  'Commercial sites with roof reserve pass and at least 30m frontage',
  'Which portfolio sites use IDW climate and fail reserve? Explain the highest-risk one.',
  'Can we put solar on a 1990 commercial building near Leamington ON? Wood deck, no performance history.',
];

function renderInlineMarkdown(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={j}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

function renderLineWithSiteLinks(line, sites, onSelectSite) {
  if (!sites?.length || !onSelectSite) return renderInlineMarkdown(line);

  const sorted = [...sites].filter((s) => s.name).sort((a, b) => b.name.length - a.name.length);
  let segments = [{ type: 'text', value: line }];

  for (const site of sorted) {
    const next = [];
    for (const seg of segments) {
      if (seg.type !== 'text') {
        next.push(seg);
        continue;
      }
      let rest = seg.value;
      while (rest) {
        const idx = rest.indexOf(site.name);
        if (idx === -1) {
          next.push({ type: 'text', value: rest });
          break;
        }
        if (idx > 0) next.push({ type: 'text', value: rest.slice(0, idx) });
        next.push({ type: 'site', site });
        rest = rest.slice(idx + site.name.length);
      }
    }
    segments = next;
  }

  return segments.map((seg, i) =>
    seg.type === 'site' ? (
      <button
        key={`${seg.site.id}-${i}`}
        type="button"
        className="agent-site-link"
        onClick={() => onSelectSite(seg.site.id)}
      >
        {seg.site.name}
      </button>
    ) : (
      <span key={i}>{renderInlineMarkdown(seg.value)}</span>
    )
  );
}

function AgentMarkdown({ text, sites, onSelectSite }) {
  if (!text) return null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <div className="agent-markdown">
      {lines.map((line, i) => {
        const isHeading = /^#{1,3}\s/.test(line) || /^\*\*[^*]+\*\*:?\s*$/.test(line);
        const content = renderLineWithSiteLinks(line, sites, onSelectSite);
        if (isHeading) {
          return (
            <p key={i} className="agent-md-heading">
              {content}
            </p>
          );
        }
        return (
          <p key={i} className="agent-md-line">
            {content}
          </p>
        );
      })}
    </div>
  );
}

function ToolTraceStep({ step }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="agent-tool-step">
      <button type="button" className="agent-tool-step-header" onClick={() => setOpen(!open)}>
        <span className="collapsible-chevron" data-open={open ? '1' : '0'}>
          ▶
        </span>
        Step {step.step}
        {step.toolPlan ? ` — ${step.toolPlan.slice(0, 72)}${step.toolPlan.length > 72 ? '…' : ''}` : ''}
      </button>
      {open && (
        <div className="agent-tool-step-body">
          {step.calls.map((call, i) => (
            <details key={i} className="agent-tool-call">
              <summary>
                <code>{call.name}</code>
                {call.error && <span className="agent-tool-err"> — error</span>}
              </summary>
              <pre>{JSON.stringify({ args: call.args, result: call.result }, null, 2)}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentPanel({
  sites,
  loading,
  onLoadingChange,
  onAgentResult,
  onClearFilters,
  onSelectSite,
  onAddDiligenceSite,
  onMapFocus,
}) {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState([]);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const diligenceContextRef = useRef(null);

  async function sendMessage(text, opts = {}) {
    const message = (text ?? input).trim();
    if (!message || loading) return;

    setError('');
    onLoadingChange?.(true);
    setInput('');

    const history = turns.flatMap((t) =>
      t.reply != null && t.reply !== ''
        ? [
            { role: 'user', content: t.user },
            { role: 'assistant', content: t.reply },
          ]
        : []
    );

    const turnId = Date.now();
    setTurns((prev) => [...prev, { id: turnId, user: message, pending: true }]);

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          sites,
          diligenceContext: diligenceContextRef.current,
          selectedLocation: opts.selectedLocation || null,
        }),
      });
      const data = await res.json();
      onLoadingChange?.(false);

      if (!res.ok) {
        setTurns((prev) =>
          prev.map((t) => (t.id === turnId ? { ...t, pending: false } : t))
        );
        setError(data.error || 'Agent request failed');
        return;
      }

      const diligenceSnapshot = extractDiligenceSnapshot(data.toolTrace);
      if (diligenceSnapshot) diligenceContextRef.current = diligenceSnapshot;

      const turn = {
        id: turnId,
        user: message,
        pending: false,
        reply: data.reply,
        toolTrace: data.toolTrace || [],
        filterPlan: data.filterPlan,
        matchedSiteIds: data.matchedSiteIds || [],
        highlightSiteIds: data.highlightSiteIds || [],
        mapFocus: data.mapFocus || null,
        geocodeCandidates: data.geocodeCandidates || null,
        siteToAdd: data.siteToAdd || null,
        offersPortfolioAdd: Boolean(data.offersPortfolioAdd),
        applyPortfolioFilter: Boolean(data.applyPortfolioFilter),
        diligenceSnapshot,
      };

      setTurns((prev) => prev.map((t) => (t.id === turnId ? turn : t)));
      onAgentResult?.(turn);

      if (data.siteToAdd) diligenceContextRef.current = null;

      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    } catch (e) {
      onLoadingChange?.(false);
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, pending: false } : t))
      );
      setError(e.message);
    }
  }

  function clearConversation() {
    setTurns([]);
    setError('');
    diligenceContextRef.current = null;
    onClearFilters?.();
  }

  function pickGeocodeOption(candidate, index) {
    onMapFocus?.({
      lat: candidate.lat,
      lng: candidate.lng,
      label: candidate.label,
    });
    sendMessage(
      `Use option ${index + 1}: ${candidate.label} (${Number(candidate.lat).toFixed(4)}, ${Number(candidate.lng).toFixed(4)})`,
      {
        selectedLocation: {
          lat: candidate.lat,
          lng: candidate.lng,
          label: candidate.label,
        },
      }
    );
  }

  return (
    <div className="agent-panel">
      <div className="agent-panel-toolbar">
        <button type="button" className="btn btn-secondary btn-sm" onClick={clearConversation}>
          Clear
        </button>
      </div>

      <div className="agent-thread" ref={scrollRef}>
        {turns.length === 0 && !loading && (
          <div className="agent-bubble agent-bubble-assistant agent-empty">
            <span className="agent-role">{AGENT_ROLE_LABEL}</span>
            Waiting…
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="agent-turn">
            <div className="agent-bubble agent-bubble-user">
              <span className="agent-role">You</span>
              {turn.user}
            </div>
            {turn.toolTrace?.length > 0 && (
              <details className="agent-tools">
                <summary>
                  {turn.toolTrace.length} tool step{turn.toolTrace.length === 1 ? '' : 's'}
                </summary>
                {turn.toolTrace.map((step) => (
                  <ToolTraceStep key={step.step} step={step} />
                ))}
              </details>
            )}
            {turn.geocodeCandidates?.length > 1 && (
              <div className="agent-geocode-pick">
                <p className="agent-geocode-pick-label">Pick a location:</p>
                {turn.geocodeCandidates.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className="btn btn-secondary btn-sm agent-geocode-option"
                    disabled={loading}
                    onClick={() => pickGeocodeOption(r, i)}
                  >
                    {i + 1}. {r.label}
                  </button>
                ))}
              </div>
            )}
            {turn.pending ? (
              <div className="agent-bubble agent-bubble-assistant agent-loading">
                <span className="agent-role">{AGENT_ROLE_LABEL}</span>
                Running tools…
              </div>
            ) : (
              turn.reply != null && (
                <div className="agent-bubble agent-bubble-assistant">
                  <span className="agent-role">{AGENT_ROLE_LABEL}</span>
                  <AgentMarkdown text={turn.reply} sites={sites} onSelectSite={onSelectSite} />
                  {turn.applyPortfolioFilter && turn.matchedSiteIds?.length > 0 && (
                    <p className="agent-meta">
                      Portfolio filter: {turn.matchedSiteIds.length} site
                      {turn.matchedSiteIds.length === 1 ? '' : 's'} matched
                    </p>
                  )}
                  {turn.offersPortfolioAdd && !turn.siteToAdd && (
                    <div className="agent-turn-actions">
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={loading}
                        onClick={() => onAddDiligenceSite?.(turn.diligenceSnapshot)}
                      >
                        Yes, add to portfolio
                      </button>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {error && <p className="status-bar" style={{ color: 'var(--fail)' }}>{error}</p>}

      <textarea
        className="agent-input"
        placeholder="Address diligence or portfolio question…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={2}
        disabled={loading}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        }}
      />
      <div className="agent-footer">
        <p className="agent-examples">
          Examples:{' '}
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              className="btn btn-secondary agent-example-btn"
              disabled={loading}
              onClick={() => sendMessage(ex)}
            >
              {i + 1}
            </button>
          ))}
        </p>
        <button
          type="button"
          className="btn btn-sm"
          disabled={loading || !input.trim()}
          onClick={() => sendMessage()}
        >
          {loading ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
