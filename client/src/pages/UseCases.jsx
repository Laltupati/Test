import React, { useState, useEffect, useMemo } from 'react';
import Banner from '../components/Banner';
import UseCaseCard from '../components/UseCaseCard';
import ToolDetailsSheet from '../components/ToolDetailsSheet';
import { SkeletonUseCaseCards } from '../components/Skeleton';

const DOMAIN_LABELS = {
  'banking-finance': 'Banking and Finance',
  'hr':              'HR and Talent',
  'technology':      'Technology',
  'insurance':       'Insurance',
  'healthcare':      'Healthcare',
};

/* Human-readable labels for slugs */
const TECH_LABELS = {
  'agent-ai': 'Agent AI',
  'rag':      'RAG',
  'ml':       'ML',
  'dl':       'DL',
};

const CAP_LABELS = {
  'content-generation':  'Content Generation',
  'text-summarization':  'Text Summarization',
  'classification':      'Classification',
  'qa-systems':          'Q&A Systems',
  'document-analysis':   'Document Analysis',
};

const STATUS_LABELS = {
  'Live': 'Live',
  'Beta': 'Beta',
  'Demo': 'Demo',
  'Coming Soon': 'Coming Soon'
};

const UseCases = ({ initialDomain = null, onBack }) => {
  const [useCases, setUseCases]         = useState([]);
  const [search, setSearch]             = useState('');
  const [selectedTool, setSelectedTool] = useState(null);
  const [activeTech, setActiveTech]     = useState([]);
  const [activeCap, setActiveCap]       = useState([]);
  const [activeStatus, setActiveStatus] = useState([]);
  const [isLoading, setIsLoading]       = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [initialDomain]);

  useEffect(() => {
    fetch('/api/use-cases')
      .then(res => res.json())
      .then(data => { setUseCases(data); setIsLoading(false); })
      .catch(err => { console.error('Error fetching use cases:', err); setIsLoading(false); });
  }, []);

  /* ── Derive domain agents & available filter options ── */
  const domainAgents = useMemo(() => {
    if (!initialDomain) return useCases;
    return useCases.filter(uc => uc.domain.includes(initialDomain));
  }, [useCases, initialDomain]);

  const availableTech = useMemo(() => {
    const set = new Set();
    domainAgents.forEach(uc => uc.technologies.forEach(t => set.add(t)));
    return [...set];
  }, [domainAgents]);

  const availableCap = useMemo(() => {
    const set = new Set();
    domainAgents.forEach(uc => uc.capabilities.forEach(c => set.add(c)));
    return [...set];
  }, [domainAgents]);

  const availableStatus = useMemo(() => {
    const set = new Set();
    domainAgents.forEach(uc => {
      if (uc.status) set.add(uc.status);
    });
    return [...set];
  }, [domainAgents]);

  /* ── Toggle pill helpers ── */
  const togglePill = (val, list, setList) => {
    setList(prev =>
      prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
    );
  };

  /* ── Filter logic ── */
  const filteredCases = domainAgents.filter(uc => {
    // Search
    if (
      search &&
      !uc.title.toLowerCase().includes(search.toLowerCase()) &&
      !uc.description.toLowerCase().includes(search.toLowerCase())
    ) return false;

    // No filters selected → show all
    if (activeTech.length === 0 && activeCap.length === 0 && activeStatus.length === 0) return true;

    // Match any selected tech within the tech group
    const matchesTech = activeTech.length === 0 || activeTech.some(t => uc.technologies.includes(t));
    // Match any selected capability within the capability group
    const matchesCap  = activeCap.length  === 0 || activeCap.some(c => uc.capabilities.includes(c));
    // Match any selected status within the status group
    const matchesStatus = activeStatus.length === 0 || activeStatus.includes(uc.status);

    // Require matches across groups when both are selected
    return matchesTech && matchesCap && matchesStatus;
  });

  const domainLabel  = initialDomain ? DOMAIN_LABELS[initialDomain] : null;
  const hasFilters   = activeTech.length > 0 || activeCap.length > 0 || activeStatus.length > 0;
  const bannerStats = [
    { val: String(domainAgents.length), em: '', lbl: 'Solutions' },
    { val: String(availableTech.length), em: '', lbl: 'Tech Stacks' },
    { val: String(availableCap.length), em: '', lbl: 'Capabilities' },
  ];

  return (
    <div className="page active" id="page-usecases">
      <Banner
        title="Agentic AI Use Cases"
        centeredTitle
      />
      {/* ══ TOP BAR: Back + Search ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '16px 0 0',
      }}>

        {/* Back button */}
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '9px 16px',
              background: 'var(--surface-1)',
              border: '1px solid var(--border)',
              borderRadius: '7px',
              color: 'var(--text-secondary)',
              fontSize: '12px', fontWeight: '700',
              fontFamily: 'var(--font)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'border-color 0.18s, color 0.18s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--kpmg-blue-light)';
              e.currentTarget.style.color = 'var(--kpmg-blue)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            All Domains
          </button>
        )}

        {/* Breadcrumb label */}
        {domainLabel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>›</span>
            <span style={{
              fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)',
              background: 'rgba(0, 48, 135, 0.08)',
              border: '1px solid rgba(0, 48, 135, 0.18)',
              borderRadius: '5px', padding: '4px 12px',
            }}>{domainLabel}</span>
          </div>
        )}

        {/* Search */}
        <div className="search-wrap" style={{ flex: 1 }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder={`Search ${domainLabel || 'all'} solutions…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ══ DOMAIN-SPECIFIC FILTER PILLS ══ */}
      {(availableTech.length > 0 || availableCap.length > 0 || availableStatus.length > 0) && (
        <div className="filter-bar">

          {/* Technology pills */}
          {availableTech.length > 0 && (
            <div className="filter-row">
              <span className="filter-label">Technology</span>
              {availableTech.map(t => (
                <button
                  key={t}
                  className={`filter-btn${activeTech.includes(t) ? ' filter-btn--on' : ''}`}
                  onClick={() => togglePill(t, activeTech, setActiveTech)}
                >
                  {TECH_LABELS[t] || t}
                </button>
              ))}
            </div>
          )}

          {/* Capability pills */}
          {availableCap.length > 0 && (
            <div className="filter-row">
              <span className="filter-label">Capabilities</span>
              {availableCap.map(c => (
                <button
                  key={c}
                  className={`filter-btn${activeCap.includes(c) ? ' filter-btn--on' : ''}`}
                  onClick={() => togglePill(c, activeCap, setActiveCap)}
                >
                  {CAP_LABELS[c] || c}
                </button>
              ))}
            </div>
          )}

          {/* Clear filters */}
          {hasFilters && (
            <button className="filter-clear" onClick={() => { setActiveTech([]); setActiveCap([]); setActiveStatus([]); }}>
              ✕ Clear filters
            </button>
          )}
        </div>
      )}

      {/* ══ CARDS GRID ══ */}
      {isLoading ? (
        <SkeletonUseCaseCards count={8} />
      ) : (
      <div style={{ padding: '20px 0 40px' }}>
        <div className="grid">
          {filteredCases.length > 0
            ? filteredCases.map(uc => (
                <UseCaseCard key={uc.id} uc={uc} onInfoClick={(info) => setSelectedTool(info)} />
              ))
            : (
              <div style={{
                gridColumn: '1/-1', textAlign: 'center',
                padding: '60px 20px', color: 'var(--text-muted)',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  No solutions found
                </div>
                <div style={{ fontSize: '13px' }}>Try adjusting your search or filters.</div>
              </div>
            )
          }
        </div>
      </div>
      )}

      <ToolDetailsSheet
        toolId={selectedTool?.id ?? selectedTool}
        tutorialUrl={selectedTool?.tutorialUrl}
        output={selectedTool?.output}
        tools={selectedTool?.tools}
        onClose={() => setSelectedTool(null)}
      />
    </div>
  );
};

export default UseCases;
