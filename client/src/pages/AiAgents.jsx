// import React, { useState, useEffect, useMemo } from 'react';
// import { industries, processAreas, scenarios, implementations } from '../data/journeyData';
// import '../assets/css/journey.css';

// // ── Arrow SVG ──────────────────────────────────────────────────────
// const ArrowRight = ({ size = 13 }) => (
//   <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
//     <path d="M5 12h14M12 5l7 7-7 7"/>
//   </svg>
// );

// const ChevronLeft = () => (
//   <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
//     <path d="M15 18l-6-6 6-6"/>
//   </svg>
// );

// // ── PHASE 1: Industry Selection ────────────────────────────────────
// const IndustryGrid = ({ onSelect }) => (
//   <>
//     <div className="journey-section-title">Select an Industry</div>
//     <div className="journey-section-sub">
//       Choose your line of business to explore AI solutions relevant to your clients and operations.
//     </div>
//     <div className="industry-grid">
//       {industries.map(ind => (
//         <div
//           key={ind.id}
//           className="industry-tile"
//           onClick={() => onSelect(ind)}
//           role="button"
//           tabIndex={0}
//           onKeyDown={e => e.key === 'Enter' && onSelect(ind)}
//           aria-label={`Select ${ind.label}`}
//         >
//           <div className="industry-tile-icon">{ind.icon}</div>
//           <div>
//             <div className="industry-tile-label">{ind.label}</div>
//             <div className="industry-tile-sublabel">{ind.sublabel}</div>
//           </div>
//           <div className="industry-tile-arrow">
//             <ArrowRight />
//           </div>
//         </div>
//       ))}
//     </div>
//   </>
// );

import React, { useState, useEffect, useMemo } from 'react';
import { industries, processAreas, horizontalProcessAreas, horizontalCenterArea, scenarios } from '../data/journeyData';
import '../assets/css/journey.css';
import { SkeletonJourneySolutions } from '../components/Skeleton';
import AppIcon from '../components/AppIcon';
import { BUSINESS_AREAS } from '../data/useCaseTaxonomy';
import { getPageUrl, isPlainLeftClick } from '../utils/navigation';

// ── Lucide aliases for arrow / nav icons ────────────────────────────
const ArrowRight  = ({ size = 13 }) => <AppIcon name="ArrowRight"  size={size} strokeWidth={2} />;
const ChevronLeft = ()              => <AppIcon name="ChevronLeft" size={14}   strokeWidth={2} />;
const ALL_LOB_PROCESS = { id: 'all-lob', label: 'Business Area Agents' };
//const NETWORK_BUSINESS_AREA_ORDER = ['consumer-banking', 'wealth-management', 'credit-card-lending', 'risk-compliance-control', 'customer-service', 'workforce-productivity'];
const NETWORK_BUSINESS_AREA_ORDER = [
  'consumer-banking',
  'wealth-management',
  'credit-card-lending',
  'workforce-productivity',
  'risk-compliance-control',
  'customer-service'
];
const NETWORK_POINT_LAYOUT = [
  { x: 200, y: 70 },   // Consumer Banking

  { x: 330, y: 120 },  // Wealth Management

  { x: 340, y: 300 },  // Credit Card

  { x: 200, y: 350 },  // Workforce

  { x: 60, y: 300 },   // Risk

  { x: 60, y: 120 },   // Customer Service
];
//const NETWORK_FLOAT_CLASSES = ['float-anim-1', 'float-anim-2', 'float-anim-3', 'float-anim-2', 'float-anim-1'];
const NETWORK_FLOAT_CLASSES = [
  'float-anim-1',
  'float-anim-2',
  'float-anim-3',
  'float-anim-2',
  'float-anim-1',
  'float-anim-3'
];

const getDisplayStatus = (uc) => {
  const s = (uc.status || '').toLowerCase();
  if (s === 'live') return { label: 'Available', cls: 'available' };
  if (s === 'beta' || s === 'demo') return { label: 'Pilot', cls: 'pilot' };
  return { label: 'In Development', cls: 'in-development' };
};

const getConfidentiality = (idx) => (idx % 2 === 0 ? 'confidential' : 'internal');

const getScenarioMappedIds = (industryId) => {
  const src = scenarios[industryId] || scenarios.default || {};
  return new Set(
    Object.values(src)
      .flatMap((list) => (Array.isArray(list) ? list : []))
      .flatMap((scenario) => (Array.isArray(scenario.solutions) ? scenario.solutions : []))
  );
};

const getBusinessAreaRelevantAgents = (industryId, allUseCases) => {
  const mappedIds = getScenarioMappedIds(industryId);
  return allUseCases.filter((uc) => {
    if (uc.title === 'QualiVerse AI') return false;
    return mappedIds.has(uc.id);
  });
};

const getScopedBusinessAreaUseCases = (industryIds, allUseCases) => {
  const scopedById = new Map();
  (industryIds || []).forEach((industryId) => {
    getBusinessAreaRelevantAgents(industryId, allUseCases).forEach((uc) => {
      if (uc.title === 'QualiVerse AI') return;
      scopedById.set(uc.id, uc);
    });
  });
  return Array.from(scopedById.values());
};

const FsBusinessAreaGrid = ({ items, allUseCases, onSelect }) => {
  const getUseCaseCount = (industryId) => {
    return getBusinessAreaRelevantAgents(industryId, allUseCases).length;
  };

  return (
    <section className="journey-explore-section journey-section journey-explore-section-parity">
      <div className="journey-section-header journey-section-header-parity" style={{ textAlign: 'left' }}>
        <h2 className="journey-section-title">Explore by Business Area</h2>
        <p className="journey-section-sub">
          Select a business area to continue to line-of-business journeys.
        </p>

      </div>

      {items.length > 0 ? (
        <div className="industry-grid journey-domain-grid journey-domain-grid-parity">
          {items.map((ind) => {
            const useCaseCount = getUseCaseCount(ind.id);
            return (
              <div
                key={ind.id}
                className="industry-tile journey-domain-card journey-domain-card-parity is-leaf"
                onClick={() => onSelect(ind)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(ind)}
                aria-label={`Select ${ind.label}`}
              >
                <div className="industry-tile-header">
                  <div className="industry-tile-icon">
                    <AppIcon name={ind.icon} size={22} strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="industry-tile-label">{ind.label}</div>
                    <div className="industry-tile-sublabel">{ind.sublabel}</div>
                  </div>
                  <div className="industry-tile-arrow"><ArrowRight /></div>
                </div>

                <div className="industry-tile-desc">{ind.description}</div>

                <div className="industry-tile-chips">
                  <span className="industry-sub-chip">{useCaseCount} use case{useCaseCount !== 1 ? 's' : ''}</span>
                  <span className="journey-domain-link">Explore →</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="journey-explore-empty">No business areas found for your search.</div>
      )}
    </section>
  );
};

const PopularUseCasesSection = ({ popularUseCases, activeBusinessAreaId, activeBusinessAreaLabel, onNavigateToDetail }) => {
  return (
    <section className="journey-popular-section">
      <div className="journey-section-header journey-popular-header">
        <div>
          <h2>Popular AI Use Cases</h2>
          <p>
            Frequently viewed and highly rated use cases
            {activeBusinessAreaLabel ? ` for ${activeBusinessAreaLabel}` : ''}.
          </p>
        </div>
      </div>

      {popularUseCases.length > 0 ? (
        <div className="journey-popular-grid">
          {popularUseCases.map((uc) => (
            <a
              href={getPageUrl('usecasedetail', { id: uc.id, source: 'aiagents', area: activeBusinessAreaId || undefined })}
              className="journey-popular-card"
              key={uc.id}
              onClick={(e) => {
                if (isPlainLeftClick(e)) {
                  e.preventDefault();
                  onNavigateToDetail && onNavigateToDetail(uc.id, 'aiagents', { source: 'aiagents', businessAreaId: activeBusinessAreaId || null });
                }
              }}
              style={{ display: 'block', cursor: 'pointer' }}
            >
              {uc.isAvailable && (
                <div className="journey-badge available">
                  <span className="dot"></span> Available
                </div>
              )}
              <h3 className="journey-popular-title">{uc.label}</h3>
              <p className="journey-popular-desc">{uc.desc}</p>
              <div className="journey-popular-footer">
                <span className="journey-view-details">View details →</span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="journey-empty-state">
          <p>No popular use cases are available for this business area yet.</p>
        </div>
      )}
    </section>
  );
};

// ── PHASE 1: Circular Industry Layout ──────────────────────────────────────
const CircularIndustryLayout = ({ items, selectedParentIndustry, onSelect, onSelectChild }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  const radius = 240; // Distance of nodes from center
  const defaultCenterText = selectedParentIndustry ? selectedParentIndustry.label : 'Select an Industry';

  const descriptions = {
    'financial-services': 'Transform financial operations with AI-driven insights across banking, capital markets, and insurance.',
    'am-pe': 'Optimize asset management and private equity with intelligent portfolio and risk analysis.',
    'products': 'Accelerate product lifecycles and supply chains across retail, life sciences, and manufacturing.',
    'tmt': 'Drive innovation in technology, media, and telecommunications with advanced AI agents.',
    'infrastructure-governance-healthcare': 'Empower public sector and healthcare infrastructure with smart, compliant operational tools.',
    'horizontal': 'Cross-cutting AI tools applicable across all lines of business — from talent acquisition and project management to data generation and SQL automation.',
  };

  const handleNodeClick = (index) => {
    if (activeIndex === index) {
      setActiveIndex(null);
    } else {
      setActiveIndex(index);
    }
  };

  const activeInd = activeIndex !== null ? items[activeIndex] : null;


  return (
    <div className="circular-layout-wrapper">
      <div className="journey-section-title" style={{ textAlign: 'center', marginBottom: 50, fontSize: 24 }}>
        {selectedParentIndustry ? selectedParentIndustry.label : 'Explore AI Solutions by Industry'}
      </div>

      <div className={`circular-industry-section ${activeInd ? 'has-selection' : ''}`}>
        {/* Circular Diagram — starts centered, shifts left on selection */}
        <div className="circular-layout-container">
          {/* Center Node */}
          <div className="circular-center">
            <div className="circular-center-default">
              <h2>{activeInd ? activeInd.label : defaultCenterText}</h2>
            </div>
          </div>

          {/* Outer Nodes */}
          {items.map((ind, index) => {
            const angle = (index / items.length) * 2 * Math.PI - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const isActive = activeIndex === index;

            return (
              <div
                key={ind.id}
                className={`circular-node ${isActive ? 'active' : ''}`}
                style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                onClick={() => handleNodeClick(index)}
              >
                <div className="circular-node-icon" style={{ color: isActive ? 'white' : ind.color, backgroundColor: isActive ? ind.color : 'white' }}>
                  <AppIcon name={ind.icon} size={28} strokeWidth={1.5} />
                </div>
                <div className={`circular-node-label ${isActive ? 'active-label' : ''}`} style={{ color: isActive ? ind.color : undefined }}>
                  {ind.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Side Panel — slides in from right on selection */}
        <div
          className={`circular-side-panel ${activeInd ? 'panel-visible' : 'panel-hidden'}`}
          style={{ borderLeftColor: activeInd ? activeInd.color : '#00A3A1' }}
        >
          {activeInd ? (
            <div className="side-panel-content">
              <h3 style={{ color: activeInd.color }}>{activeInd.label}</h3>
              <p className="side-panel-desc">{descriptions[activeInd.id] || activeInd.description}</p>

              {activeInd.children && activeInd.children.length > 0 && (
                <div className="side-panel-options">
                  <ul className="side-panel-list">
                    {activeInd.children.map(child => (
                      <li key={child.id}>
                        <strong>{child.label}:</strong> {child.description}
                        <div>
                          <button
                            className="side-panel-explore-btn"
                            style={{ backgroundColor: activeInd.color }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectChild(activeInd, child);
                            }}
                          >
                            Explore <ArrowRight size={12} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(!activeInd.children || activeInd.children.length === 0) && (
                <button
                  className="side-panel-explore-btn main-explore"
                  style={{ backgroundColor: activeInd.color }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(activeInd);
                  }}
                >
                  Explore <ArrowRight size={12} />
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ── PHASE 2: Process Area Selection ───────────────────────────────
const ProcessGrid = ({ industry, onSelect, scenarioMap }) => {
  const isHorizontal = industry.id === 'horizontal';

  const getCount = (processId) => {
    const src = scenarioMap[industry.id] || scenarioMap['default'];
    return (src?.[processId] || []).length;
  };

  const getQuadrantClass = (procId) => {
    switch (procId) {
      case 'customer-service-ops': return 'quadrant-tl';
      case 'corporate-services': return 'quadrant-tr';
      case 'technology-solutions': return 'quadrant-bl';
      case 'risk-services': return 'quadrant-br';
      default: return 'quadrant-default';
    }
  };

  if (!isHorizontal) {
    return (
      <>
        <div className="journey-section-title" style={{ textAlign: 'center' }}>Explore by Line of Business</div>
        <div className="journey-section-sub" style={{ textAlign: 'center' }}>
          {industry.label}: choose a line of business to explore role-based scenarios and AI solutions.
        </div>
        <div className="process-grid">
          {processAreas.map((proc) => {
            const count = getCount(proc.id);
            return (
              <div
                key={proc.id}
                className="process-card"
                onClick={() => onSelect(proc)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelect(proc)}
                aria-label={`Select ${proc.label}`}
              >
                <div className="process-card-icon-wrap" style={{ color: industry.color }}>
                  <AppIcon name={proc.icon} size={26} strokeWidth={1.5} />
                </div>
                <div className="process-card-label">{proc.label}</div>
                <div className="process-card-desc">{proc.description}</div>
                <div className="process-card-footer">
                  <span className="process-card-count">{count} scenario{count !== 1 ? 's' : ''}</span>
                  <button className="process-card-cta" type="button">
                    Explore <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  // 5-cut Horizontal layout
  const SLICE_ANGLES = [-90, -18, 54, 126, 198];
  
  return (
    <>
      <div className="journey-section-title" style={{ textAlign: 'center' }}>{industry.label}</div>
      <div className="journey-section-sub" style={{ textAlign: 'center' }}>
        Select a tool to explore role-based scenarios and AI solutions.
      </div>
      <div className="circular-process-wrapper">
        <div className="circular-process-container is-5-slice">
          
          {/* Slices layer */}
          <div className="process-slices-layer">
            {/* 5 lines separating the slices */}
            {[...Array(5)].map((_, i) => (
               <div 
                 key={`divider-${i}`}
                 className="slice-divider"
                 style={{ transform: `rotate(${-54 + i * 72}deg)` }}
               />
            ))}

            {/* Render all 5 horizontal tools (4 outer + PMO) as pie slices */}
            {horizontalProcessAreas.concat([horizontalCenterArea]).map((proc, idx) => {
              const angle = SLICE_ANGLES[idx];
              return (
                <div 
                  key={proc.id}
                  className="process-slice"
                  onClick={() => onSelect(proc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onSelect(proc)}
                  style={{ 
                    '--industry-color': industry.color,
                    transform: `rotate(${angle}deg)` 
                  }}
                >
                  <div 
                    className="process-slice-content"
                    style={{ transform: `translate(-50%, -50%) rotate(${-angle}deg)` }}
                  >
                    <div className="quadrant-icon-wrap" style={{ color: industry.color, marginBottom: 8 }}>
                      <AppIcon name={proc.icon} size={24} strokeWidth={1.5} />
                    </div>
                    <div className="quadrant-label" style={{ fontSize: 13, fontWeight: 700, color: industry.color }}>
                      {proc.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center Circle stays completely inert for Horizontal, just as a label */}
          <div className="process-center-circle" style={{ color: industry.color, zIndex: 10 }}>
            <div className="process-center-content" style={{ fontWeight: 700 }}>{industry.label}</div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── PHASE 3: Journey Map & Solution Discovery ──────────────────────
const JourneyMap = ({ industry, process, allUseCases, onNavigateToDetail, businessAreaIds = [] }) => {
  const [activeScenario, setActiveScenario] = useState(null);
  const isAllLob = process?.id === 'all-lob';

  const scenarioList = useMemo(() => {
    const src = scenarios[industry.id] || scenarios['default'] || {};
    if (isAllLob) {
      return processAreas.flatMap((proc) => src?.[proc.id] || []);
    }
    return src?.[process.id] || [];
  }, [industry.id, process.id, isAllLob]);

  // Auto-select first scenario
  useEffect(() => {
    if (scenarioList.length > 0) setActiveScenario(scenarioList[0]);
  }, [scenarioList]);

  const activeSolutions = useMemo(() => {
    if (isAllLob) {
      if (industry.id === 'all') {
        return getScopedBusinessAreaUseCases(businessAreaIds, allUseCases);
      }
      return getBusinessAreaRelevantAgents(industry.id, allUseCases);
    }

    if (!activeScenario) return [];

    return (activeScenario.solutions || [])
      .map(id => allUseCases.find(uc => uc.id === id))
      .filter(Boolean);
  }, [isAllLob, scenarioList, activeScenario, allUseCases]);

  if (!isAllLob && scenarioList.length === 0) {
    return (
      <div className="journey-empty">
        <div className="journey-empty-icon">🔍</div>

        <div className="journey-empty-title">No scenarios mapped yet</div>

        <div className="journey-empty-sub">
          Scenarios for this combination are coming soon.
        </div>
      </div>
    );
  }

  return (
    <div className="journey-map-wrap">
      <div className="journey-section-title">{isAllLob ? `${industry.label} Agents` : process.label}</div>

      <div className="journey-section-sub">
        {isAllLob
          ? (industry.id === 'all'
            ? 'Showing AI agents mapped across all business areas.'
            : 'Showing only the AI agents mapped to this selected business area across lines of business.')
          : 'Select a scenario below to discover AI solutions relevant to that role and use case.'}
      </div>

      {/* Scenario strip */}
      {!isAllLob && (
        <div className="scenario-strip">
          {scenarioList.map(sc => (
            <button
              key={sc.id}
              className={`scenario-chip ${activeScenario?.id === sc.id ? 'active' : ''}`}
              onClick={() => setActiveScenario(sc)}
              type="button"
            >
              {sc.label}

              {activeScenario?.id !== sc.id && (
                <span className="scenario-chip-role">{sc.role}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Scenario detail pane */}
      {(isAllLob || activeScenario) && (
        <div className={isAllLob ? 'scenario-pane journey-auc-pane' : 'scenario-pane'} key={isAllLob ? 'all-lob-pane' : activeScenario.id}>
          {!isAllLob && (
            <div className="scenario-pane-header">
              <div className="scenario-pane-info">
                <h3>{activeScenario.label}</h3>
                <p>{activeScenario.description}</p>
              </div>
            </div>
          )}
          {!isAllLob && (
            <div className="scenario-pane-solutions-title">
              {`Relevant AI Solutions (${activeSolutions.length})`}
            </div>
          )}

          {activeSolutions.length > 0 ? (
            <div className={isAllLob ? 'journey-auc-grid' : 'journey-solutions-grid'}>
              {activeSolutions.map((uc, idx) => {
                const processTagList = process.id === 'all-lob' ? [] : ((uc.tags || {})[process.id] || []);
                const { label: statusLabel, cls: statusClass } = getDisplayStatus(uc);
                const confType = getConfidentiality(idx);

                if (isAllLob) {
                  return (
                    <a
                      href={getPageUrl('usecasedetail', { id: uc.id, source: 'aiagents', area: industry.id })}
                      key={uc.id}
                      className="journey-auc-card"
                      onClick={(e) => {
                        if (isPlainLeftClick(e)) {
                          e.preventDefault();
                          onNavigateToDetail && onNavigateToDetail(uc.id, 'aiagents', { source: 'aiagents', businessAreaId: industry.id });
                        }
                      }}
                      style={{ display: 'block', cursor: 'pointer' }}
                    >
                      <div className="journey-auc-card-header">
                        <div className={`journey-auc-badge-status ${statusClass}`}>
                          <span className="dot"></span> {statusLabel}
                        </div>
                        <div className={`journey-auc-confidentiality ${confType}`}>{confType}</div>
                      </div>

                      <div className="journey-auc-card-image">
                        {uc.image ? (
                          <img src={uc.image} alt={uc.title} className={uc.title === 'QualiVerse AI' ? 'qualiverse-logo-image' : ''} />
                        ) : (
                          <div className="journey-auc-card-image-placeholder" style={{ background: `linear-gradient(145deg, ${uc.color || '#003087'}33, ${uc.color || '#003087'}66)` }}>
                            <AppIcon name={uc.icon} size={40} strokeWidth={1.35} style={{ color: uc.color || '#003087' }} />
                          </div>
                        )}
                      </div>

                      <h3 className="journey-auc-card-title">{uc.title}</h3>
                      <p className="journey-auc-card-desc">{uc.description}</p>

                      <div className="journey-auc-card-footer">
                        <div className="journey-auc-card-tags">
                          {(uc.offerings || []).slice(0, 2).map((tag) => (
                            <span key={tag} className="journey-auc-card-tag">{tag}</span>
                          ))}
                        </div>
                        <div className="journey-auc-actions">
                          <span className="journey-auc-view">View details</span>
                        </div>
                      </div>
                    </a>
                  );
                }

                return (
                <a
                  href={getPageUrl('usecasedetail', { id: uc.id, source: 'aiagents', area: industry.id })}
                  key={uc.id}
                  className="journey-solution-card"
                  style={{ '--dc': uc.color, display: 'block', cursor: 'pointer' }}
                  onClick={(e) => {
                    if (isPlainLeftClick(e)) {
                      e.preventDefault();
                      onNavigateToDetail && onNavigateToDetail(uc.id, 'aiagents', { source: 'aiagents', businessAreaId: industry.id });
                    }
                  }}
                >
                  <div className="card-vis">
                    <div 
                      className="vis-bg" 
                      style={{ 
                        backgroundImage: uc.image 
                          ? `url("${uc.image}")` 
                          : `linear-gradient(145deg, ${uc.color}33, ${uc.color}66)`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                      }}
                    >
                      {!uc.image && (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: uc.color || '#003087' }}>
                          <AppIcon name={uc.icon} size={52} strokeWidth={1.25} />
                        </div>
                      )}
                    </div>
                    {!uc.image && (
                      <div className="card-icon">
                        <AppIcon name={uc.icon} size={28} strokeWidth={1.5} style={{ color: uc.color || '#003087' }} />
                      </div>
                    )}
                  </div>
                  <div className="journey-sol-content">
                    <div className="journey-sol-top">
                      <div className="journey-sol-title">{uc.title}</div>

                      <span className={`journey-sol-status ${uc.statusClass}`}>
                        {uc.status}
                      </span>
                    </div>

                    <div className="journey-sol-desc">{uc.description}</div>

                    {/* Offering tags for this process area */}
                    {processTagList.length > 0 && (
                      <div className="journey-sol-tags">
                        {processTagList.map(tag => (
                          <span key={tag} className="journey-sol-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="journey-sol-footer">
                    <div className="journey-sol-actions">
                      <span className="journey-sol-launch" style={{ flex: 7 }}>
                        View details <span className="journey-sol-launch-arrow">→</span>
                      </span>
                    </div>
                  </div>
                </a>
                ); })}
            </div>
          ) : (
            <div className="journey-empty" style={{ padding: '24px 0' }}>
              <div className="journey-empty-sub">
                No solutions are currently linked to this scenario.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────
const AiAgents = ({ onNavigateToDetail, initialBusinessAreaId }) => {
  const financialServicesParent = useMemo(
    () => industries.find((ind) => ind.id === 'financial-services') || null,
    []
  );

  const [phase, setPhase] = useState(1);

  const [selectedParentIndustry, setSelectedParentIndustry] = useState(financialServicesParent);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);

  const [useCases, setUseCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [businessAreaSearch, setBusinessAreaSearch] = useState('');
  const ALL_BUSINESS_AREAS_FILTER = useMemo(() => ({ id: 'all', label: 'All Business Areas' }), []);

  // Fetch use cases from the backend API for linking solutions
  useEffect(() => {
    fetch('/api/use-cases')
      .then(res => res.json())
      .then(data => { setUseCases(Array.isArray(data) ? data : []); setIsLoading(false); })
      .catch(err => { console.error('Error fetching use cases:', err); setIsLoading(false); });
  }, []);

  // Phase 1: show top-level groups OR children of the selected parent
  const industriesToShow = selectedParentIndustry?.children || [];

  useEffect(() => {
    if (!initialBusinessAreaId) return;
    if (initialBusinessAreaId === ALL_BUSINESS_AREAS_FILTER.id) {
      setSelectedIndustry(ALL_BUSINESS_AREAS_FILTER);
      setSelectedProcess(ALL_LOB_PROCESS);
      setPhase(3);
      return;
    }
    const targetIndustry = industriesToShow.find((ind) => ind.id === initialBusinessAreaId);
    if (!targetIndustry) return;

    setSelectedIndustry(targetIndustry);
    setSelectedProcess(ALL_LOB_PROCESS);
    setPhase(3);
  }, [ALL_BUSINESS_AREAS_FILTER, initialBusinessAreaId, industriesToShow]);

  const filteredIndustriesToShow = useMemo(() => {
    const q = businessAreaSearch.trim().toLowerCase();
    if (!q) return industriesToShow;
    return industriesToShow.filter((ind) => {
      return (
        ind.label.toLowerCase().includes(q) ||
        (ind.sublabel || '').toLowerCase().includes(q) ||
        (ind.description || '').toLowerCase().includes(q)
      );
    });
  }, [industriesToShow, businessAreaSearch]);

  const searchSuggestions = useMemo(() => {
  const q = businessAreaSearch.trim().toLowerCase();

  if (!q) return [];

  return industriesToShow.filter((ind) =>
    ind.label.toLowerCase().includes(q) ||
    (ind.sublabel || '').toLowerCase().includes(q)
  );
}, [businessAreaSearch, industriesToShow]);

  const activeBusinessAreaIds = useMemo(() => {
    if (selectedIndustry?.id) return [selectedIndustry.id];
    return industriesToShow.map((ind) => ind.id);
  }, [selectedIndustry, industriesToShow]);

  const networkBusinessAreas = useMemo(() => {
    const byId = new Map((industriesToShow || []).map((ind) => [ind.id, ind]));
    return NETWORK_BUSINESS_AREA_ORDER
      .map((id) => byId.get(id))
      .filter(Boolean);
  }, [industriesToShow]);

  const networkUseCaseCountByArea = useMemo(() => {
    const counts = {};
    networkBusinessAreas.forEach((area) => {
      counts[area.id] = getBusinessAreaRelevantAgents(area.id, useCases).length;
    });
    return counts;
  }, [networkBusinessAreas, useCases]);

  const totalUseCasesForFilteredAreas = useMemo(() => {
    const visibleAreaIds = filteredIndustriesToShow.map((ind) => ind.id);
    return getScopedBusinessAreaUseCases(visibleAreaIds, useCases).length;
  }, [filteredIndustriesToShow, useCases]);

  const heroStatCounts = useMemo(() => {
    const journeyBusinessAreaIds = industriesToShow.map((ind) => ind.id);
    const journeyUseCases = getScopedBusinessAreaUseCases(journeyBusinessAreaIds, useCases);

    return {
      useCases: journeyUseCases.length,
      aiApplications: journeyUseCases.length,
      businessAreas: journeyBusinessAreaIds.length,
    };
  }, [industriesToShow, useCases]);

  const scopedBusinessAreaUseCases = useMemo(() => {
    return getScopedBusinessAreaUseCases(activeBusinessAreaIds, useCases);
  }, [activeBusinessAreaIds, useCases]);

  const popularUseCases = useMemo(() => {
    return [...scopedBusinessAreaUseCases]
      .filter((uc) => (uc.launches || 0) > 0)
      .sort((a, b) => (b.launches || 0) - (a.launches || 0))
      .slice(0, 4)
      .map((uc) => ({
        id: uc.id,
        label: uc.title,
        desc: uc.description,
        launches: uc.launches || 0,
        isAvailable: uc.status !== 'Coming Soon',
      }));
  }, [scopedBusinessAreaUseCases]);

  const ALL_BUSINESS_AREA_TAB = useMemo(() => ({ id: 'all', label: 'All' }), []);

  const businessAreaTabs = useMemo(
    () => [ALL_BUSINESS_AREA_TAB, ...industriesToShow],
    [ALL_BUSINESS_AREA_TAB, industriesToShow]
  );

  const businessAreaUseCaseCountByTab = useMemo(() => {
    const counts = {};
    counts[ALL_BUSINESS_AREA_TAB.id] = getScopedBusinessAreaUseCases(industriesToShow.map((ind) => ind.id), useCases).length;
    industriesToShow.forEach((area) => {
      counts[area.id] = getBusinessAreaRelevantAgents(area.id, useCases).length;
    });
    return counts;
  }, [ALL_BUSINESS_AREA_TAB.id, industriesToShow, useCases]);

  const handleSelectBusinessAreaTab = (area) => {
    if (area.id === ALL_BUSINESS_AREA_TAB.id) {
      setSelectedIndustry(ALL_BUSINESS_AREAS_FILTER);
      setSelectedProcess(ALL_LOB_PROCESS);
      setPhase(3);
      window.history.pushState({ phase: 3, parentIndustry: selectedParentIndustry, industry: ALL_BUSINESS_AREAS_FILTER, process: ALL_LOB_PROCESS }, '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSelectedIndustry(area);
    setSelectedProcess(ALL_LOB_PROCESS);
    setPhase(3);
    window.history.pushState({ phase: 3, parentIndustry: selectedParentIndustry, industry: area, process: ALL_LOB_PROCESS }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const handleSelectIndustry = (ind) => {
    // Clicking the card header — if group has children, show sub-industry list
    if (ind.children && ind.children.length > 0) {
      setSelectedParentIndustry(ind);
      setSelectedIndustry(null);
      setSelectedProcess(null);
      setPhase(1);
      window.history.pushState({ phase: 1, parentIndustry: ind, industry: null, process: null }, '');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Leaf node (no children) — go straight to agents (skip LoB selection page)
    setSelectedIndustry(ind);
    setSelectedProcess(ALL_LOB_PROCESS);
    setPhase(3);
    window.history.pushState({ phase: 3, parentIndustry: selectedParentIndustry, industry: ind, process: ALL_LOB_PROCESS }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Called when user clicks a sub-industry chip directly on a group card
  const handleSelectChild = (parentGroup, child) => {
    setSelectedParentIndustry(parentGroup);
    setSelectedIndustry(child);
    setSelectedProcess(ALL_LOB_PROCESS);
    setPhase(3);
    window.history.pushState({ phase: 3, parentIndustry: parentGroup, industry: child, process: ALL_LOB_PROCESS }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectProcess = (proc) => {
    setSelectedProcess(proc);
    setPhase(3);
    window.history.pushState({ phase: 3, parentIndustry: selectedParentIndustry, industry: selectedIndustry, process: proc }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setPhase(1);
    setSelectedParentIndustry(financialServicesParent);
    setSelectedIndustry(null);
    setSelectedProcess(null);
    window.history.pushState({ phase: 1, parentIndustry: financialServicesParent, industry: null, process: null }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoParent = () => {
    setPhase(1);
    setSelectedIndustry(null);
    setSelectedProcess(null);
    window.history.pushState({ phase: 1, parentIndustry: selectedParentIndustry, industry: null, process: null }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoPhase2 = () => {
    setPhase(1);
    setSelectedIndustry(null);
    setSelectedProcess(null);
    window.history.pushState({ phase: 1, parentIndustry: selectedParentIndustry, industry: null, process: null }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Browser history integration ──────────────────────────────
  useEffect(() => {
    // Set initial state so we have a valid object on first pop
    window.history.replaceState({ 
      phase: 1, 
      parentIndustry: financialServicesParent,
      industry: null, 
      process: null 
    }, '');

    const handlePopState = (e) => {
      const s = e.state;
      if (s) {
        setPhase(s.phase || 1);
        setSelectedParentIndustry(s.parentIndustry || financialServicesParent);
        setSelectedIndustry(s.industry || null);
        setSelectedProcess(s.process || null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [financialServicesParent]);

  const handleBack = () => {
    // Simply go back in browser history (which triggers popstate)
    // instead of bloating the history stack with forward pushes.
    window.history.back();
  };

  return (
    <div className={`journey-page${selectedIndustry ? ' journey-page-business-area' : ''}`}>

      {/* ── Hero Banner ── */}
      {phase === 1 && !selectedIndustry && (
        <>
          <div className="journey-hero">
            <div className="journey-hero-inner">
              <div className="journey-hero-content">
                <div className="journey-hero-left">
                  <div className="journey-eyebrow">
                    <span className="journey-eyebrow-dot" />
                    Business Journey Explorer
                  </div>

                  <h1>
                    Discover AI Solutions <span>for Your Business</span>
                  </h1>

                  <p>
                    Navigate by industry and process area to find the right AI tools for your team and clients.
                    Designed for business teams and client-accompanied engagements.
                  </p>

                  <div className="journey-hero-search-wrap">

                    <div className="journey-hero-search-input-box">
                      <AppIcon name="Search" size={18} className="journey-hero-search-icon" />

                      <input
                        type="text"
                        value={businessAreaSearch}
                        onChange={(e) => setBusinessAreaSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && searchSuggestions.length > 0) {
                            handleSelectIndustry(searchSuggestions[0]);
                          }
                        }}
                        placeholder="Search by business area"
                        aria-label="Search business areas"
                      />

                      {businessAreaSearch && (
                        <button
                          type="button"
                          className="journey-hero-search-clear-btn"
                          onClick={() => setBusinessAreaSearch('')}
                          aria-label="Clear search"
                        >
                          <AppIcon name="X" size={14} />
                        </button>
                      )}
                    </div>

                    {businessAreaSearch.trim() &&
                      searchSuggestions.length > 0 && (
                        <div className="journey-search-dropdown">

                          <div className="journey-search-dropdown-header">
                            BUSINESS AREAS
                          </div>

                          {searchSuggestions.map((item) => (
                            <div
                              key={item.id}
                              className="journey-search-item"
                              onClick={() => handleSelectIndustry(item)}
                            >
                              <div className="journey-search-item-left">

                                <AppIcon
                                  name={item.icon}
                                  size={18}
                                  strokeWidth={1.75}
                                />

                                <div>
                                  <div className="journey-search-item-title">
                                    {item.label}
                                  </div>

                                  <div className="journey-search-item-subtitle">
                                    {item.sublabel}
                                  </div>
                                </div>

                              </div>

                              <span className="journey-search-pill">
                                Business Area →
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                  </div>

                  <div className="journey-hero-tags">
                    <span className="journey-hero-tag">
                      <AppIcon name="Building2" size={14} strokeWidth={1.75} /> Business Teams
                    </span>
                    <span className="journey-hero-tag">
                      <AppIcon name="Users" size={14} strokeWidth={1.75} /> Client Engagements
                    </span>
                    <span className="journey-hero-tag">
                      <AppIcon name="GitBranch" size={14} strokeWidth={1.75} /> Lines of Business → Processes
                    </span>
                  </div>
                </div>

                <div className="journey-hero-right journey-network-wrap" aria-hidden="true">
                  <div className="journey-network-graphic">
                    <svg className="journey-network-lines" viewBox="0 0 400 400" fill="none" aria-hidden="true">
                      {NETWORK_POINT_LAYOUT.slice(0, networkBusinessAreas.length).map((point, idx) => (
                        <line key={`center-${idx}`} x1="200" y1="200" x2={point.x} y2={point.y} />
                      ))}
                    </svg>

                    <div className="journey-node center pulse-animation"><div className="journey-node-inner"></div></div>

                    {networkBusinessAreas.map((area, idx) => {
                      const point = NETWORK_POINT_LAYOUT[idx];
                      const floatClass = NETWORK_FLOAT_CLASSES[idx] || 'float-anim-1';
                      if (!point) return null;
                      return (
                        <div
                          className="journey-network-point"
                          key={area.id}
                          style={{ top: `${point.y}px`, left: `${point.x}px` }}
                        >
                          <div className="journey-node journey-node-area"></div>
                          <div className={`journey-network-point-meta point-pos-${idx + 1} ${floatClass}`}>
                            <span className="journey-network-point-name">{area.label.toUpperCase()}</span>
                            <span className="journey-network-point-count">{networkUseCaseCountByArea[area.id] || 0} use cases</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="journey-stats-bar uc3-stats-bar">
                <div className="journey-stat uc3-stat">
                  <div className="journey-stat-icon-wrapper uc3-stat-icon-wrapper"><AppIcon name="BarChart2" size={24} className="journey-stat-icon uc3-stat-icon" /></div>
                  <div className="journey-stat-text uc3-stat-text">
                    <div className="journey-stat-val uc3-stat-val">{heroStatCounts.useCases}</div>
                    <div className="journey-stat-label uc3-stat-label">Use Cases</div>
                  </div>
                </div>
                <div className="journey-stat uc3-stat">
                  <div className="journey-stat-icon-wrapper uc3-stat-icon-wrapper"><AppIcon name="Bot" size={24} className="journey-stat-icon uc3-stat-icon" /></div>
                  <div className="journey-stat-text uc3-stat-text">
                    <div className="journey-stat-val uc3-stat-val">{heroStatCounts.aiApplications}</div>
                    <div className="journey-stat-label uc3-stat-label">AI Applications</div>
                  </div>
                </div>
                <div className="journey-stat uc3-stat">
                  <div className="journey-stat-icon-wrapper uc3-stat-icon-wrapper"><AppIcon name="Building2" size={24} className="journey-stat-icon uc3-stat-icon" /></div>
                  <div className="journey-stat-text uc3-stat-text">
                    <div className="journey-stat-val uc3-stat-val">{heroStatCounts.businessAreas}</div>
                    <div className="journey-stat-label uc3-stat-label">Business Areas</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Business Journey Topbar (Use Case parity) ── */}
      {selectedIndustry ? (
        <div className="journey-topbar">
          <div className="journey-breadcrumb">
            <div className="journey-breadcrumb-item">
              <button
                className="journey-breadcrumb-link"
                onClick={handleGoHome}
                type="button"
              >
                <ChevronLeft /> All Business Areas
              </button>
            </div>

            <div className="journey-breadcrumb-item">
              <span className="journey-breadcrumb-sep">›</span>

              <span className="journey-breadcrumb-current">
                {selectedIndustry.label}
              </span>
            </div>
          </div>

          <div className="journey-topbar-divider"></div>

          <div className="journey-tabs-container">
            {businessAreaTabs.map((area) => {
              const isActive = selectedIndustry?.id === area.id;
              const useCaseCount = businessAreaUseCaseCountByTab[area.id] || 0;
              return (
                <a
                  key={area.id}
                  href={getPageUrl('aiagents', { area: area.id })}
                  className={`journey-tab ${isActive ? 'active' : ''}`}
                  onClick={(e) => {
                    if (isPlainLeftClick(e)) {
                      e.preventDefault();
                      handleSelectBusinessAreaTab(area);
                    }
                  }}
                >
                  {area.label}
                  <span className="journey-tab-count">{useCaseCount}</span>
                </a>
              );
            })}
          </div>
        </div>
      ) : ((phase > 1 || selectedProcess) && (
        <div className="journey-breadcrumb">
          <div className="journey-breadcrumb-item">
            <button
              className="journey-breadcrumb-link"
              onClick={handleGoHome}
              type="button"
            >
              All Business Areas
            </button>
          </div>

          {selectedProcess && phase === 3 && (
            <div className="journey-breadcrumb-item">
              <span className="journey-breadcrumb-sep">›</span>
              <span className="journey-breadcrumb-current">{selectedProcess.label}</span>
            </div>
          )}
        </div>
      ))}

      {/* ── Body ── */}
      <div className={`journey-body${selectedIndustry ? ' journey-body-business-area' : ''}`}>


        {/* Phase 1: Financial Services business area cards */}
        {phase === 1 && (
          <FsBusinessAreaGrid
            items={filteredIndustriesToShow}
            allUseCases={useCases}
            onSelect={handleSelectIndustry}
          />
        )}

        {/* Phase 2: Process areas (kept for compatibility; currently skipped in FS flow) */}
        {phase === 2 && selectedIndustry && (
          <ProcessGrid
            industry={selectedIndustry}
            onSelect={handleSelectProcess}
            scenarioMap={scenarios}
          />
        )}

        {/* Phase 3: Scenarios and solutions */}
        {phase === 3 && selectedIndustry && selectedProcess && (
          isLoading ? (
            <div style={{ padding: '24px 0' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '14px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Loading Solutions…
              </div>
              <SkeletonJourneySolutions count={4} />
            </div>
          ) : (
          <JourneyMap
            industry={selectedIndustry}
            process={selectedProcess}
            allUseCases={useCases}
            onNavigateToDetail={onNavigateToDetail}
            businessAreaIds={industriesToShow.map((ind) => ind.id)}
          />
          )
        )}

        {!isLoading && phase === 1 && !selectedIndustry && (
          <PopularUseCasesSection
            popularUseCases={popularUseCases}
            activeBusinessAreaId={selectedIndustry?.id || null}
            activeBusinessAreaLabel={selectedIndustry?.label || null}
            onNavigateToDetail={onNavigateToDetail}
          />
        )}

      </div>

      {/* ── KPMG Disclaimer Footer — only on phase 1 home screen ── */}
      {phase === 1 && !selectedIndustry && (
        <div className="journey-footer-banner">
          <p className="journey-footer-info">
            For more information, visit us: <a href="#" className="journey-footer-link">KGS Home</a>
          </p>
          <p className="journey-footer-legal">
            © 2024 KPMG International Cooperative ("KPMG International"). A Swiss entity. Member firms of the KPMG network of independent firms are affiliated with KPMG International.
            KPMG International provides no client services. No member firm has any authority to obligate or bind KPMG International or any other member firm vis-à-vis third parties,
            nor does KPMG International have any such authority to obligate or bind any member firm. All rights reserved.
          </p>
        </div>
      )}
    </div>
  );
};

export default AiAgents;
