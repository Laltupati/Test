import React, { useState, useEffect } from 'react';
import AppIcon from '../components/AppIcon';
import { getPageUrl, isPlainLeftClick } from '../utils/navigation';
import { SkeletonUseCaseCards } from '../components/Skeleton';
import '../assets/css/allusecases.css';

/* Map the tags object keys to readable labels for card footer */
const LOO_LABELS = {
  'customer-service-ops': 'Customer & Operations',
  'corporate-services': 'Corporate Services',
  'risk-services': 'Risk Services',
  'technology-solutions': 'Technology Solutions',
  'pmo': 'PMO',
  'data-generation': 'Data generation',
  'resume-creator': 'Resume creator',
  'text-to-sql': 'Text to SQL Generation',
  'cv-screener': 'CV Screener'
};

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

/* Filter options matching Image 2 */
const TECH_OPTIONS = [
  { id: 'agent-ai', label: 'Agent AI' },
  { id: 'ml', label: 'ML' },
  { id: 'rag', label: 'RAG' },
  { id: 'dl', label: 'DL' }
];

const CAP_OPTIONS = [
  { id: 'document-analysis', label: 'Document Analysis' },
  { id: 'classification', label: 'Classification' },
  { id: 'qa-systems', label: 'Q&A Systems' },
  { id: 'text-summarization', label: 'Text Summarization' },
  { id: 'content-generation', label: 'Content Generation' }
];

const AllUseCases = ({ initialDomain, onBack, onNavigateToDetail }) => {
  const [allUseCases, setAllUseCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDomainId, setSelectedDomainId] = useState(initialDomain || 'all');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [filters, setFilters] = useState({
    subLobs: [],
    linesOfOffering: [],
    statuses: [],
    tech: [],
    capabilities: []
  });

  const toggleFilter = (category, value) => {
    setFilters(prev => {
      const current = prev[category] || [];
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
      tech: [],
      capabilities: []
    });
  };

  const totalActiveFilters =
    (filters.subLobs?.length || 0) +
    (filters.linesOfOffering?.length || 0) +
    (filters.statuses?.length || 0) +
    (filters.tech?.length || 0) +
    (filters.capabilities?.length || 0);

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

  const domains = [
    { id: 'all', label: 'All', matchIds: ['all'] },
    { id: 'banking-finance', label: 'Financial Services', matchIds: ['banking-finance', 'financial-services', 'banking', 'cap-market', 'insurance'] },
    { id: 'am', label: 'Asset Management / Private Equity', matchIds: ['am', 'am-pe', 'am-pe-sub'] },
    { id: 'prod', label: 'Products', matchIds: ['prod', 'products', 'consumer-retail', 'life-sciences', 'industrial-manufacturing', 'enrc'] },
    { id: 'healthcare', label: 'Infrastructure, Governance & Healthcare', matchIds: ['healthcare', 'infrastructure-governance-healthcare', 'sled', 'federal'] },
    { id: 'technology', label: 'Technology, Media & Telecommunications', matchIds: ['technology', 'tmt', 'tmt-sub'] },
    { id: 'horizontal', label: 'Horizontal', matchIds: ['horizontal', 'hr', 'pmo', 'cv-screener', 'text-to-sql', 'data-generation'] }
  ];

  /* Dynamically derive Sub-LOB options based on the selected LOB tab */
  const subLobsOptions = React.useMemo(() => {
    if (selectedDomainId === 'all') {
      return [
        'Banking', 'Capital Markets', 'Insurance',
        'Asset Management / Private Equity (AM/PE)',
        'Consumer & Retail', 'Life Sciences', 'Industrial Manufacturing',
        'ENRC', 'Healthcare', 'SLED', 'Federal',
        'Technology, Media & Telecommunications (TMT)'
      ];
    }
    if (selectedDomainId === 'banking-finance') {
      return ['Banking', 'Capital Markets', 'Insurance'];
    }
    if (selectedDomainId === 'am') {
      return ['Asset Management / Private Equity (AM/PE)'];
    }
    if (selectedDomainId === 'prod') {
      return ['Consumer & Retail', 'Life Sciences', 'Industrial Manufacturing', 'ENRC'];
    }
    if (selectedDomainId === 'healthcare') {
      return ['Healthcare', 'SLED', 'Federal'];
    }
    if (selectedDomainId === 'technology') {
      return ['Technology, Media & Telecommunications (TMT)'];
    }
    // Horizontal has no Sub-LOBs
    return [];
  }, [selectedDomainId]);

  /* Dynamically derive Line of Offering options based on the selected LOB tab */
  const looOptions = React.useMemo(() => {
    if (selectedDomainId === 'horizontal') {
      return [
        'CV Screener', 'Text to SQL Generation',
        'Resume creator', 'Data generation', 'PMO'
      ];
    }
    if (selectedDomainId === 'all') {
      return [
        'Corporate Services', 'Customer & Operations',
        'Risk Services', 'Technology Solutions',
        'CV Screener', 'Text to SQL Generation',
        'Resume creator', 'Data generation', 'PMO'
      ];
    }
    // All other standard LOBs use the 4 core offerings
    return [
      'Corporate Services', 'Customer & Operations',
      'Risk Services', 'Technology Solutions'
    ];
  }, [selectedDomainId]);

  const statusOptions = ['Available', 'Pilot', 'In Development'];

  const techOptions = [
    { id: 'agent-ai', label: 'Agent AI' },
    { id: 'ml', label: 'ML' },
    { id: 'rag', label: 'RAG' },
    { id: 'dl', label: 'DL' }
  ];

  const capOptions = [
    { id: 'document-analysis', label: 'Document Analysis' },
    { id: 'classification', label: 'Classification' },
    { id: 'qa-systems', label: 'Q&A Systems' },
    { id: 'text-summarization', label: 'Text Summarization' },
    { id: 'content-generation', label: 'Content Generation' }
  ];

  /* Strict taxonomy mapping from the Excel specification for Use Case 3 workflow */
  const EXCEL_TAXONOMY = {
    lobs: {
      'banking-finance': ['financial-outlook-generator', 'kpmg-agenda-creator', 'advisor-intelligence', 'bank-complaint-automation'],
      'am': ['financial-outlook-generator', 'augmented-insights-discovery'],
      'prod': [],
      'healthcare': [],
      'technology': [],
      'horizontal': ['proscreener', 'natural-language-data-querying', 'resume-creator', 'synthdataforge', 'pro-manager']
    },
    looTags: {
      'financial-outlook-generator': ['Corporate Services'],
      'kpmg-agenda-creator': ['Corporate Services'],
      'advisor-intelligence': ['Corporate Services'],
      'bank-complaint-automation': ['Customer & Operations'],
      'augmented-insights-discovery': ['Corporate Services'],
      'proscreener': ['CV Screener'],
      'natural-language-data-querying': ['Text to SQL Generation'],
      'resume-creator': ['Resume creator'],
      'synthdataforge': ['Data generation'],
      'pro-manager': ['PMO']
    },
    subLobs: {
      'financial-outlook-generator': ['Banking', 'Capital Markets', 'Insurance', 'Asset Management / Private Equity (AM/PE)'],
      'kpmg-agenda-creator': ['Banking', 'Capital Markets', 'Insurance'],
      'advisor-intelligence': ['Banking', 'Capital Markets', 'Insurance'],
      'bank-complaint-automation': ['Banking', 'Capital Markets', 'Insurance'],
      'augmented-insights-discovery': ['Asset Management / Private Equity (AM/PE)'],
      'proscreener': [],
      'natural-language-data-querying': [],
      'resume-creator': [],
      'synthdataforge': [],
      'pro-manager': []
    }
  };

  /* Get the LOO tag labels for a use case from EXCEL_TAXONOMY */
  const getTagLabels = (uc) => {
    return EXCEL_TAXONOMY.looTags[uc.id] || [];
  };

  /* Check if a use case matches a sub-LOB filter */
  const matchesSubLob = (uc, selectedSubLobs) => {
    const ucSubLobs = EXCEL_TAXONOMY.subLobs[uc.id] || [];
    return selectedSubLobs.some(selected =>
      ucSubLobs.some(sub => sub.toLowerCase().includes(selected.toLowerCase().replace(' (am/pe)', '').replace(' (tmt)', '')))
    );
  };

  /* Check if a use case matches a Line of Offering filter */
  const matchesLoo = (uc, selectedLoo) => {
    const ucLooTags = EXCEL_TAXONOMY.looTags[uc.id] || [];
    return selectedLoo.some(loo => ucLooTags.includes(loo));
  };

  // Apply filters strictly according to EXCEL_TAXONOMY and active filters
  const filteredCases = allUseCases.filter(uc => {
    // 0. Only include use cases defined in EXCEL_TAXONOMY
    if (!EXCEL_TAXONOMY.looTags[uc.id]) return false;

    // 1. Domain / LOB Filter
    if (selectedDomainId !== 'all') {
      const activeDomainObj = domains.find(d => d.id === selectedDomainId || (d.matchIds && d.matchIds.includes(selectedDomainId)));
      const lobKey = activeDomainObj ? activeDomainObj.id : selectedDomainId;
      const allowedIds = EXCEL_TAXONOMY.lobs[lobKey] || [];
      if (!allowedIds.includes(uc.id)) return false;
    }
    // 2. Status Filter
    if (filters.statuses && filters.statuses.length > 0) {
      const { label } = getDisplayStatus(uc);
      if (!filters.statuses.includes(label)) return false;
    }
    // 3. Sub-LOB Filter
    if (filters.subLobs && filters.subLobs.length > 0) {
      if (!matchesSubLob(uc, filters.subLobs)) return false;
    }
    // 4. Line of Offering Filter
    if (filters.linesOfOffering && filters.linesOfOffering.length > 0) {
      if (!matchesLoo(uc, filters.linesOfOffering)) return false;
    }
    // 5. Tech Filter
    if (filters.tech && filters.tech.length > 0) {
      if (!uc.technologies || !filters.tech.some(t => uc.technologies.includes(t))) return false;
    }
    // 6. Capability Filter
    if (filters.capabilities && filters.capabilities.length > 0) {
      if (!uc.capabilities || !filters.capabilities.some(c => uc.capabilities.includes(c))) return false;
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
              if (!EXCEL_TAXONOMY.looTags[uc.id]) return false;
              if (domain.id !== 'all') {
                const allowedIds = EXCEL_TAXONOMY.lobs[domain.id] || [];
                if (!allowedIds.includes(uc.id)) return false;
              }
              return true;
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
            <AppIcon name="Filter" size={14} />
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
                {subLobsOptions.map(sl => {
                  const isActive = (filters.subLobs || []).includes(sl);
                  return (
                    <label key={sl} className="auc-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleFilter('subLobs', sl)}
                      />
                      <span>{sl}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* LINE OF OFFERING column */}
            {looOptions.length > 0 && (
              <div className="auc-filter-col">
                <div className="auc-filter-col-title">LINE OF OFFERING</div>
                {looOptions.map(loo => {
                  const isActive = (filters.linesOfOffering || []).includes(loo);
                  return (
                    <label key={loo} className="auc-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleFilter('linesOfOffering', loo)}
                      />
                      <span>{loo}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* STATUS column */}
            <div className="auc-filter-col">
              <div className="auc-filter-col-title">STATUS</div>
              {statusOptions.map(st => {
                const isActive = (filters.statuses || []).includes(st);
                return (
                  <label key={st} className="auc-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleFilter('statuses', st)}
                    />
                    <span>{st}</span>
                  </label>
                );
              })}
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
                    <img src={uc.image} alt={uc.title} />
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
