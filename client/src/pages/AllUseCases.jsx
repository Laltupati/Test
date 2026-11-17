import React, { useState, useEffect } from 'react';
import AppIcon from '../components/AppIcon';
import { getPageUrl, isPlainLeftClick } from '../utils/navigation';
import { SkeletonUseCaseCards } from '../components/Skeleton';
import {
  DOMAIN_TABS,
  USE_CASE_TAXONOMY,
  getAllowedUseCaseIdsForDomain,
  getLineOfOfferingOptions,
  getSubLobOptions
} from '../data/useCaseTaxonomy';
import '../assets/css/allusecases.css';

/* Map server status to display status */
const getDisplayStatus = (uc) => {
  const s = (uc.status || '').toLowerCase();
  if (s === 'live') return { label: 'Available', cls: 'available' };
  if (s === 'beta' || s === 'demo') return { label: 'Pilot', cls: 'pilot' };
  return { label: 'In Development', cls: 'in-development' };
};

/* Derive confidentiality — even index = confidential, odd = internal (mock) */
const getConfidentiality = (uc, idx) => {
  return idx % 2 === 0 ? 'confidential' : 'internal';
};

const AllUseCases = ({ initialDomain, onBack, onNavigateToDetail }) => {
  const [allUseCases, setAllUseCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDomainId, setSelectedDomainId] = useState(initialDomain || 'all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState({
    subLobs: [],
    linesOfOffering: [],
    statuses: [],
    aiPoweredOnly: false
  });

  const toggleFilter = (category, value) => {
    setFilters(prev => {
      const current = prev[category];
      if (current.includes(value)) {
        return { ...prev, [category]: current.filter(v => v !== value) };
      } else {
        return { ...prev, [category]: [...current, value] };
      }
    });
  };

  const clearAllFilters = () => {
    setFilters({
      subLobs: [],
      linesOfOffering: [],
      statuses: [],
      aiPoweredOnly: false
    });
  };

  const totalActiveFilters =
    (filters.subLobs?.length || 0) +
    (filters.linesOfOffering?.length || 0) +
    (filters.statuses?.length || 0);

  const hasActiveFilters = totalActiveFilters > 0;

  // Sync initialDomain if it changes
  useEffect(() => {
    if (initialDomain) {
      setSelectedDomainId(initialDomain);
    }
  }, [initialDomain]);

  // Scroll to top when page opens
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetch('/api/use-cases')
      .then(res => res.json())
      .then(data => { setAllUseCases(data); setIsLoading(false); })
      .catch(err => { console.error("Error fetching use cases:", err); setIsLoading(false); });
  }, []);

  const domains = DOMAIN_TABS;


  const normalizedDomainId = React.useMemo(() => {
    const matchedDomain = domains.find(
      d => d.id === selectedDomainId || (d.matchIds && d.matchIds.includes(selectedDomainId))
    );
    return matchedDomain ? matchedDomain.id : selectedDomainId;
  }, [domains, selectedDomainId]);

  /* Dynamically derive Sub-LOB options based on the selected LOB tab */
  const subLobsOptions = React.useMemo(() => {
    return getSubLobOptions(normalizedDomainId);
  }, [normalizedDomainId]);

  /* Dynamically derive Line of Offering options based on the selected LOB tab */
  const looOptions = React.useMemo(() => {
    return getLineOfOfferingOptions(normalizedDomainId);
  }, [normalizedDomainId]);

  const statusOptions = ['Available', 'Pilot', 'In Development'];

  /* Get the LOO tag labels for a use case from shared taxonomy */
  const getTagLabels = (uc) => {
    return USE_CASE_TAXONOMY.looTags[uc.id] || [];
  };

  /* Check if a use case matches a sub-LOB filter */
  const matchesSubLob = (uc, selectedSubLobs) => {
    const ucSubLobs = USE_CASE_TAXONOMY.subLobs[uc.id] || [];
    return selectedSubLobs.some(selected =>
      ucSubLobs.some(sub => sub.toLowerCase() === selected.toLowerCase())
    );
  };

  /* Check if a use case matches a Line of Offering filter */
  const matchesLoo = (uc, selectedLoo) => {
    const ucLooTags = USE_CASE_TAXONOMY.looTags[uc.id] || [];
    return selectedLoo.some(loo => ucLooTags.includes(loo));
  };

  // Apply filters strictly according to shared taxonomy and active filters
  const filteredCases = allUseCases.filter(uc => {

    if (uc.title === 'QualiVerse AI') return false;

    // 0. Only include use cases defined in taxonomy
    if (!USE_CASE_TAXONOMY.looTags[uc.id]) return false;

    // 1. Domain / LOB Filter
    if (normalizedDomainId !== 'all') {
      const allowedIds = getAllowedUseCaseIdsForDomain(normalizedDomainId);
      if (!allowedIds.includes(uc.id)) return false;
    }
    // 2. Status Filter
    if (filters.statuses.length > 0) {
      const { label } = getDisplayStatus(uc);
      if (!filters.statuses.includes(label)) return false;
    }
    // 3. Sub-LOB Filter
    if (filters.subLobs.length > 0) {
      if (!matchesSubLob(uc, filters.subLobs)) return false;
    }
    // 4. Line of Offering Filter
    if (filters.linesOfOffering.length > 0) {
      if (!matchesLoo(uc, filters.linesOfOffering)) return false;
    }

    return true;
  });

  return (
    <div className="auc-container">

      {/* ─── Top Bar: Breadcrumb + Domain Tabs ─── */}
      <div className="auc-topbar">
        {/* Breadcrumb */}
        <div className="auc-header">
          <a
            href={getPageUrl('usecase3')}
            className="auc-back-btn"
            onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); onBack && onBack(); } }}
          >
            <AppIcon name="ChevronLeft" size={14} /> Home
          </a>
          <AppIcon name="ChevronRight" size={12} className="auc-breadcrumb-sep" />
          <span className="auc-breadcrumb-current">All Use Cases</span>
        </div>

        <div className="auc-topbar-divider"></div>

        {/* Domain Tabs */}
        <div className="auc-tabs-container">
          {domains.map(domain => {
            // Calculate count for this specific domain based on the loaded use cases
            const domainCount = allUseCases.filter(uc => {
              return uc.title !== 'QualiVerse AI' && getAllowedUseCaseIdsForDomain(domain.id).includes(uc.id);
            }).length;

            return (
              <a
                key={domain.id}
                href={getPageUrl('allusecases', { domain: domain.id })}
                className={`auc-tab ${
                  selectedDomainId === domain.id || (domain.matchIds && domain.matchIds.includes(selectedDomainId))
                    ? 'active'
                    : ''
                }`}
                onClick={(e) => {
                  if (isPlainLeftClick(e)) {
                    e.preventDefault();
                    setSelectedDomainId(domain.id);
                    clearAllFilters();
                  }
                }}
              >
                {domain.label}
                {domainCount > 0 && (
                  <span className="auc-tab-count">{domainCount}</span>
                )}
              </a>
            );
          })}
        </div>
      </div>

      {/* ─── Collapsible Filter Panel ─── */}
      <div className="auc-filter-panel">
        <div className="auc-filter-bar">
          <button
            type="button"
            className="auc-filter-toggle"
            onClick={() => setFiltersOpen(prev => !prev)}
          >
            <AppIcon name="SlidersHorizontal" size={16} />
            Filters
            {totalActiveFilters > 0 && (
              <span className="auc-filter-count-badge">{totalActiveFilters}</span>
            )}
            <AppIcon name={filtersOpen ? 'ChevronUp' : 'ChevronDown'} size={12} />
          </button>

          {/* Applied filter chips + Clear all on the right */}
          {totalActiveFilters > 0 && (
            <div className="auc-filter-bar-right">
              <div className="auc-applied-chips">
                {(filters.subLobs || []).map(sl => (
                  <span key={`sl-${sl}`} className="auc-filter-chip">
                    {sl}
                    <button type="button" className="auc-chip-remove" onClick={() => toggleFilter('subLobs', sl)}>×</button>
                  </span>
                ))}
                {(filters.linesOfOffering || []).map(loo => (
                  <span key={`loo-${loo}`} className="auc-filter-chip">
                    {loo}
                    <button type="button" className="auc-chip-remove" onClick={() => toggleFilter('linesOfOffering', loo)}>×</button>
                  </span>
                ))}
                {(filters.statuses || []).map(st => (
                  <span key={`st-${st}`} className="auc-filter-chip">
                    {st}
                    <button type="button" className="auc-chip-remove" onClick={() => toggleFilter('statuses', st)}>×</button>
                  </span>
                ))}
              </div>
              <button type="button" className="auc-clear-all-btn" onClick={clearAllFilters}>
                Clear all
              </button>
            </div>
          )}
        </div>

        {filtersOpen && (
          <div className="auc-filter-grid">
            {/* SUB-LOB column */}
            {subLobsOptions.length > 0 && (
              <div className="auc-filter-col">
                <div className="auc-filter-col-title">SUB-LOB</div>
                {subLobsOptions.map(sl => (
                  <label key={sl} className="auc-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.subLobs.includes(sl)}
                      onChange={() => toggleFilter('subLobs', sl)}
                    />
                    <span>{sl}</span>
                  </label>
                ))}
              </div>
            )}

            {/* LINE OF OFFERING column */}
            {looOptions.length > 0 && (
              <div className="auc-filter-col">
                <div className="auc-filter-col-title">LINE OF OFFERING</div>
                {looOptions.map(loo => (
                  <label key={loo} className="auc-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={filters.linesOfOffering.includes(loo)}
                      onChange={() => toggleFilter('linesOfOffering', loo)}
                    />
                    <span>{loo}</span>
                  </label>
                ))}
              </div>
            )}

            {/* STATUS column */}
            <div className="auc-filter-col">
              <div className="auc-filter-col-title">STATUS</div>
              {statusOptions.map(st => (
                <label key={st} className="auc-filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(st)}
                    onChange={() => toggleFilter('statuses', st)}
                  />
                  <span>{st}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>


      {/* ─── Card Grid ─── */}
      {isLoading ? (
        <SkeletonUseCaseCards count={8} hideFilters={true} />
      ) : (
        <div className="auc-grid">
          {filteredCases.map((uc, idx) => {
            const { label: statusLabel, cls: statusClass } = getDisplayStatus(uc);
            const confType = getConfidentiality(uc, idx);
            const tagLabels = getTagLabels(uc);

            return (
              <a
                href={getPageUrl('usecasedetail', { id: uc.id })}
                className="auc-card"
                key={uc.id}
                onClick={(e) => {
                  if (isPlainLeftClick(e)) {
                    e.preventDefault();
                    onNavigateToDetail && onNavigateToDetail(uc.id);
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              >
                {/* Top: status pill (left) + confidentiality text (right) */}
                <div className="auc-card-header">
                  <div className={`auc-badge-status ${statusClass}`}>
                    <span className="dot"></span> {statusLabel}
                  </div>
                  <span className={`auc-badge-conf ${confType}`}>
                    <span className="dot"></span> {confType === 'confidential' ? 'Confidential' : 'Internal'}
                  </span>
                </div>

                {/* Image Thumbnail */}
                <div className="auc-card-image">
                  {uc.image ? (
                    <img src={uc.image} alt={uc.title} className={uc.title === 'QualiVerse AI' ? 'qualiverse-logo-image' : ''} />
                  ) : (
                    <div className="auc-card-image-placeholder" style={{ background: `linear-gradient(145deg, ${uc.color || '#003087'}33, ${uc.color || '#003087'}66)` }}>
                      <AppIcon name={uc.icon || 'FileText'} size={32} style={{ color: uc.color || '#003087' }} />
                    </div>
                  )}
                </div>

                <h3 className="auc-card-title">{uc.title}</h3>
                <p className="auc-card-desc">{uc.description}</p>

                <div className="auc-card-footer">
                  <div className="auc-card-tags">
                    {tagLabels.slice(0, 2).map(tag => (
                      <span key={tag} className="auc-card-tag">{tag}</span>
                    ))}
                  </div>
                  <span className="auc-view-details">
                    View details <AppIcon name="ArrowRight" size={13} />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AllUseCases;
