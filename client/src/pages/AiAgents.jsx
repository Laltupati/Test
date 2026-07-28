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
//           style={{ '--tile-accent': ind.color }}
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

// // ── PHASE 2: Process Area Selection ───────────────────────────────
// const ProcessGrid = ({ industry, onSelect, scenarioMap }) => {
//   const getCount = (processId) => {
//     const src = scenarioMap[industry.id] || scenarioMap['default'];
//     return (src?.[processId] || []).length;
//   };

//   return (
//     <>
//       <div className="journey-section-title">{industry.label}</div>
//       <div className="journey-section-sub">
//         Select a process area to explore role-based scenarios and AI solutions.
//       </div>
//       <div className="process-grid">
//         {processAreas.map(proc => {
//           const count = getCount(proc.id);
//           return (
//             <div
//               key={proc.id}
//               className="process-card"
//               onClick={() => onSelect(proc)}
//               role="button"
//               tabIndex={0}
//               onKeyDown={e => e.key === 'Enter' && onSelect(proc)}
//               aria-label={`Select ${proc.label}`}
//             >
//               <div className="process-card-icon-wrap">{proc.icon}</div>
//               <div className="process-card-label">{proc.label}</div>
//               <div className="process-card-desc">{proc.description}</div>
//               <div className="process-card-footer">
//                 <span className="process-card-count">
//                   {count} scenario{count !== 1 ? 's' : ''}
//                 </span>
//                 <button className="process-card-cta" type="button">
//                   Explore <ArrowRight size={12} />
//                 </button>
//               </div>
//             </div>
//           );
//         })}
//       </div>
//     </>
//   );
// };

// // ── PHASE 3: Journey Map & Solution Discovery ──────────────────────
// const JourneyMap = ({ industry, process, allUseCases, onBack }) => {
//   const [activeScenario, setActiveScenario] = useState(null);

//   const scenarioList = useMemo(() => {
//     const src = scenarios[industry.id] || scenarios['default'];
//     return src?.[process.id] || [];
//   }, [industry.id, process.id]);

//   // Auto-select first scenario
//   useEffect(() => {
//     if (scenarioList.length > 0) setActiveScenario(scenarioList[0]);
//   }, [scenarioList]);

//   const activeSolutions = useMemo(() => {
//     if (!activeScenario) return [];
//     return (activeScenario.solutions || [])
//       .map(id => allUseCases.find(uc => uc.id === id))
//       .filter(Boolean);
//   }, [activeScenario, allUseCases]);

//   if (scenarioList.length === 0) {
//     return (
//       <div className="journey-empty">
//         <div className="journey-empty-icon">🔍</div>
//         <div className="journey-empty-title">No scenarios mapped yet</div>
//         <div className="journey-empty-sub">
//           Scenarios for this combination are coming soon.
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="journey-map-wrap">
//       <div className="journey-section-title">{process.label}</div>
//       <div className="journey-section-sub">
//         Select a scenario below to discover AI solutions relevant to that role and use case.
//       </div>

//       {/* Scenario strip */}
//       <div className="scenario-strip">
//         {scenarioList.map(sc => (
//           <button
//             key={sc.id}
//             className={`scenario-chip ${activeScenario?.id === sc.id ? 'active' : ''}`}
//             onClick={() => setActiveScenario(sc)}
//             type="button"
//           >
//             {sc.label}
//             {activeScenario?.id !== sc.id && (
//               <span className="scenario-chip-role">{sc.role}</span>
//             )}
//           </button>
//         ))}
//       </div>

//       {/* Scenario detail pane */}
//       {activeScenario && (
//         <div className="scenario-pane" key={activeScenario.id}>
//           <div className="scenario-pane-header">
//             <div>
//               <div className="scenario-pane-role-badge">👤 {activeScenario.role}</div>
//             </div>
//             <div className="scenario-pane-info">
//               <h3>{activeScenario.label}</h3>
//               <p>{activeScenario.description}</p>
//             </div>
//           </div>

//           <div className="scenario-pane-solutions-title">
//             Relevant AI Solutions ({activeSolutions.length})
//           </div>

//           {activeSolutions.length > 0 ? (
//             <div className="journey-solutions-grid">
//               {activeSolutions.map(uc => (
//                 <div key={uc.id} className="journey-solution-card">
//                   <div className="journey-sol-top">
//                     <div className="journey-sol-title">{uc.title}</div>
//                     <span className={`journey-sol-status ${uc.statusClass}`}>
//                       {uc.status}
//                     </span>
//                   </div>
//                   <div className="journey-sol-desc">{uc.description}</div>
//                   <div className="journey-sol-actions">
//                     <button
//                       className="journey-sol-launch"
//                       disabled={uc.status === 'Coming Soon'}
//                       onClick={() => {
//                         if (uc.launchUrl && uc.launchUrl !== '#' && uc.status !== 'Coming Soon') {
//                           window.open(uc.launchUrl, '_blank');
//                         }
//                       }}
//                     >
//                       {uc.status === 'Coming Soon' ? 'Coming Soon' : 'Launch →'}
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           ) : (
//             <div className="journey-empty" style={{ padding: '24px 0' }}>
//               <div className="journey-empty-sub">
//                 No solutions are currently linked to this scenario.
//               </div>
//             </div>
//           )}
//         </div>
//       )}

//       {/* Reference Implementations */}
//       <div className="impl-section">
//         <div className="impl-section-label">Reference Implementations</div>
//         <div className="impl-grid">
//           {implementations.map(impl => (
//             <div
//               key={impl.id}
//               className="impl-card"
//               style={{ '--impl-accent': impl.accent }}
//             >
//               <div className="impl-card-head">
//                 <div className="impl-card-icon">{impl.icon}</div>
//                 <div>
//                   <div className="impl-card-client">{impl.client}</div>
//                   <div className="impl-card-sector">{impl.sector}</div>
//                 </div>
//               </div>
//               <div className="impl-card-desc">{impl.description}</div>
//               <div className="impl-card-tags">
//                 {impl.tags.map(tag => (
//                   <span key={tag} className="impl-card-tag">{tag}</span>
//                 ))}
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// };

// // ── MAIN COMPONENT ─────────────────────────────────────────────────
// const AiAgents = () => {
//   const [phase, setPhase] = useState(1);
//   const [selectedIndustry, setSelectedIndustry] = useState(null);
//   const [selectedProcess, setSelectedProcess] = useState(null);
//   const [useCases, setUseCases] = useState([]);

//   // Fetch use cases from the backend API for linking solutions
//   useEffect(() => {
//     fetch('/api/use-cases')
//       .then(res => res.json())
//       .then(data => setUseCases(Array.isArray(data) ? data : []))
//       .catch(err => console.error('Error fetching use cases:', err));
//   }, []);

//   const handleSelectIndustry = (ind) => {
//     setSelectedIndustry(ind);
//     setSelectedProcess(null);
//     setPhase(2);
//     window.scrollTo({ top: 0, behavior: 'smooth' });
//   };

//   const handleSelectProcess = (proc) => {
//     setSelectedProcess(proc);
//     setPhase(3);
//     window.scrollTo({ top: 0, behavior: 'smooth' });
//   };

//   const handleGoHome   = () => { setPhase(1); setSelectedIndustry(null); setSelectedProcess(null); };
//   const handleGoPhase2 = () => { setPhase(2); setSelectedProcess(null); };

//   return (
//     <div className="journey-page">

//       {/* ── Hero Banner ── */}
//       <div className="journey-hero">
//         <div className="journey-hero-inner">
//           <div className="journey-eyebrow">
//             <span className="journey-eyebrow-dot" />
//             Business Journey Explorer
//           </div>
//           <h1>
//             Discover AI Solutions <span>for Your Business</span>
//           </h1>
//           <p>
//             Navigate by industry and process area to find the right AI tools for your team and clients.
//             Designed for business teams and client-accompanied engagements.
//           </p>
//           <div className="journey-hero-tags">
//             <span className="journey-hero-tag">🏢 Business Teams</span>
//             <span className="journey-hero-tag">🤝 Client Engagements</span>
//             <span className="journey-hero-tag">📍 Lines of Business → Processes</span>
//           </div>
//         </div>
//       </div>

//       {/* ── Breadcrumb (Phases 2 & 3) ── */}
//       {phase > 1 && (
//         <div className="journey-breadcrumb">
//           <div className="journey-breadcrumb-item">
//             <button className="journey-breadcrumb-link" onClick={handleGoHome} type="button">
//               All Industries
//             </button>
//           </div>
//           {selectedIndustry && (
//             <div className="journey-breadcrumb-item">
//               <span className="journey-breadcrumb-sep">›</span>
//               {phase === 2 ? (
//                 <span className="journey-breadcrumb-current">{selectedIndustry.label}</span>
//               ) : (
//                 <button className="journey-breadcrumb-link" onClick={handleGoPhase2} type="button">
//                   {selectedIndustry.label}
//                 </button>
//               )}
//             </div>
//           )}
//           {selectedProcess && phase === 3 && (
//             <div className="journey-breadcrumb-item">
//               <span className="journey-breadcrumb-sep">›</span>
//               <span className="journey-breadcrumb-current">{selectedProcess.label}</span>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ── Body ── */}
//       <div className="journey-body">

//         {/* Back button for Phases 2 & 3 */}
//         {phase > 1 && (
//           <button
//             className="journey-back-btn"
//             type="button"
//             onClick={phase === 2 ? handleGoHome : handleGoPhase2}
//           >
//             <ChevronLeft />
//             {phase === 2 ? 'All Industries' : selectedIndustry?.label}
//           </button>
//         )}

//         {/* Phase rendering */}
//         {phase === 1 && (
//           <IndustryGrid onSelect={handleSelectIndustry} />
//         )}

//         {phase === 2 && selectedIndustry && (
//           <ProcessGrid
//             industry={selectedIndustry}
//             onSelect={handleSelectProcess}
//             scenarioMap={scenarios}
//           />
//         )}

//         {phase === 3 && selectedIndustry && selectedProcess && (
//           <JourneyMap
//             industry={selectedIndustry}
//             process={selectedProcess}
//             allUseCases={useCases}
//             onBack={handleGoPhase2}
//           />
//         )}

//       </div>
//     </div>
//   );
// };

// export default AiAgents;

import React, { useState, useEffect, useMemo } from 'react';
import { industries, processAreas, horizontalProcessAreas, horizontalCenterArea, scenarios } from '../data/journeyData';
import '../assets/css/journey.css';
import { SkeletonJourneySolutions } from '../components/Skeleton';
import AppIcon from '../components/AppIcon';
import ToolDetailsSheet from '../components/ToolDetailsSheet';

// ── Lucide aliases for arrow / nav icons ────────────────────────────
const ArrowRight  = ({ size = 13 }) => <AppIcon name="ArrowRight"  size={size} strokeWidth={2} />;
const ChevronLeft = ()              => <AppIcon name="ChevronLeft" size={14}   strokeWidth={2} />;

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
        <div className="journey-section-title" style={{ textAlign: 'center' }}>{industry.label}</div>
        <div className="journey-section-sub" style={{ textAlign: 'center' }}>
          Select a process area to explore role-based scenarios and AI solutions.
        </div>
        <div className="circular-process-wrapper">
          <div className="circular-process-container">
            {/* Center Circle */}
            <div className="process-center-circle" style={{ color: industry.color }}>
              <div className="process-center-content">{industry.label}</div>
            </div>
            {/* 4 Quadrants */}
            {processAreas.map(proc => {
              const count = getCount(proc.id);
              const quadrantClass = getQuadrantClass(proc.id);
              return (
                <div
                  key={proc.id}
                  className={`process-quadrant ${quadrantClass}`}
                  onClick={() => onSelect(proc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onSelect(proc)}
                  aria-label={`Select ${proc.label}`}
                  style={{ '--industry-color': industry.color }}
                >
                  <div className="quadrant-content">
                    <div className="quadrant-icon-wrap" style={{ color: industry.color }}>
                      <AppIcon name={proc.icon} size={28} strokeWidth={1.5} />
                    </div>
                    <div className="quadrant-label">{proc.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
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
const JourneyMap = ({ industry, process, allUseCases }) => {
  const [activeScenario, setActiveScenario] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);

  const scenarioList = useMemo(() => {
    const src = scenarios[industry.id] || scenarios['default'];
    return src?.[process.id] || [];
  }, [industry.id, process.id]);

  // Auto-select first scenario
  useEffect(() => {
    if (scenarioList.length > 0) setActiveScenario(scenarioList[0]);
  }, [scenarioList]);

  const activeSolutions = useMemo(() => {
    if (!activeScenario) return [];

    return (activeScenario.solutions || [])
      .map(id => allUseCases.find(uc => uc.id === id))
      .filter(Boolean);
  }, [activeScenario, allUseCases]);

  if (scenarioList.length === 0) {
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
      <div className="journey-section-title">{process.label}</div>

      <div className="journey-section-sub">
        Select a scenario below to discover AI solutions relevant to that role and use case.
      </div>

      {/* Scenario strip */}
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

      {/* Scenario detail pane */}
      {activeScenario && (
        <div className="scenario-pane" key={activeScenario.id}>
          <div className="scenario-pane-header">
            <div className="scenario-pane-info">
              <h3>{activeScenario.label}</h3>
              <p>{activeScenario.description}</p>
            </div>
          </div>

          <div className="scenario-pane-solutions-title">
            Relevant AI Solutions ({activeSolutions.length})
          </div>

          {activeSolutions.length > 0 ? (
            <div className="journey-solutions-grid">
              {activeSolutions.map(uc => {
                const processTagList = (uc.tags || {})[process.id] || [];
                return (
                <div key={uc.id} className="journey-solution-card" style={{ '--dc': uc.color }}>
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
                      <button
                        className="btn-i"
                        type="button"
                        style={{ flex: 3, padding: '8px 12px', width: 'auto' }}
                        onClick={() => setSelectedTool({ id: uc.id, tutorialUrl: uc.tutorialUrl, output: uc.output, tools: uc.tools })}
                      >
                        Info
                      </button>
                      <button
                        className="journey-sol-launch"
                        disabled={uc.status === 'Coming Soon'}
                        style={{ flex: 7 }}
                        onClick={() => {
                          if (
                            uc.launchUrl &&
                            uc.launchUrl !== '#' &&
                            uc.status !== 'Coming Soon'
                          ) {
                            window.open(uc.launchUrl, '_blank');
                          }
                        }}
                      >
                        {uc.status === 'Coming Soon' ? 'Coming Soon' : (
                          <>Launch <span className="journey-sol-launch-arrow">→</span></>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
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

// ── MAIN COMPONENT ─────────────────────────────────────────────────
const AiAgents = () => {
  const [phase, setPhase] = useState(1);

  const [selectedParentIndustry, setSelectedParentIndustry] = useState(null);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [selectedProcess, setSelectedProcess] = useState(null);

  const [useCases, setUseCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch use cases from the backend API for linking solutions
  useEffect(() => {
    fetch('/api/use-cases')
      .then(res => res.json())
      .then(data => { setUseCases(Array.isArray(data) ? data : []); setIsLoading(false); })
      .catch(err => { console.error('Error fetching use cases:', err); setIsLoading(false); });
  }, []);

  // Phase 1: show top-level groups OR children of the selected parent
  const industriesToShow = selectedParentIndustry
    ? selectedParentIndustry.children
    : industries;


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
    // Leaf node (no children) — go straight to process areas
    setSelectedIndustry(ind);
    setSelectedProcess(null);
    setPhase(2);
    window.history.pushState({ phase: 2, parentIndustry: selectedParentIndustry, industry: ind, process: null }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Called when user clicks a sub-industry chip directly on a group card
  const handleSelectChild = (parentGroup, child) => {
    setSelectedParentIndustry(parentGroup);
    setSelectedIndustry(child);
    setSelectedProcess(null);
    setPhase(2);
    window.history.pushState({ phase: 2, parentIndustry: parentGroup, industry: child, process: null }, '');
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
    setSelectedParentIndustry(null);
    setSelectedIndustry(null);
    setSelectedProcess(null);
    window.history.pushState({ phase: 1, parentIndustry: null, industry: null, process: null }, '');
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
    setPhase(2);
    setSelectedProcess(null);
    window.history.pushState({ phase: 2, parentIndustry: selectedParentIndustry, industry: selectedIndustry, process: null }, '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Browser history integration ──────────────────────────────
  useEffect(() => {
    // Set initial state so we have a valid object on first pop
    window.history.replaceState({ 
      phase: 1, 
      parentIndustry: null, 
      industry: null, 
      process: null 
    }, '');

    const handlePopState = (e) => {
      const s = e.state;
      if (s) {
        setPhase(s.phase || 1);
        setSelectedParentIndustry(s.parentIndustry || null);
        setSelectedIndustry(s.industry || null);
        setSelectedProcess(s.process || null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleBack = () => {
    // Simply go back in browser history (which triggers popstate)
    // instead of bloating the history stack with forward pushes.
    window.history.back();
  };

  return (
    <div className="journey-page">

      {/* ── Hero Banner — only on phase 1 home screen ── */}
      {phase === 1 && !selectedParentIndustry && (
        <div className="journey-hero">
          <div className="journey-hero-inner">
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
        </div>
      )}

      {/* ── Breadcrumb ── */}
      {(selectedParentIndustry || selectedIndustry || selectedProcess) && (
        <div className="journey-breadcrumb">
          {/* All Industries — always clickable when we're deeper than home */}
          <div className="journey-breadcrumb-item">
            <button
              className="journey-breadcrumb-link"
              onClick={handleGoHome}
              type="button"
            >
              All Industries
            </button>
          </div>

          {/* Selected child industry (e.g. "Banking") — skip parent grouping */}
          {selectedIndustry && (
            <div className="journey-breadcrumb-item">
              <span className="journey-breadcrumb-sep">›</span>

              {phase === 3 ? (
                <button
                  className="journey-breadcrumb-link"
                  onClick={handleGoPhase2}
                  type="button"
                >
                  {selectedIndustry.label}
                </button>
              ) : (
                <span className="journey-breadcrumb-current">
                  {selectedIndustry.label}
                </span>
              )}
            </div>
          )}

          {/* Process area — only on phase 3 */}
          {selectedProcess && phase === 3 && (
            <div className="journey-breadcrumb-item">
              <span className="journey-breadcrumb-sep">›</span>

              <span className="journey-breadcrumb-current">
                {selectedProcess.label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <div className="journey-body">


        {/* Phase 1: Main industries with sub-industry chips */}
        {phase === 1 && (
          <CircularIndustryLayout
            items={industriesToShow}
            selectedParentIndustry={selectedParentIndustry}
            onSelect={handleSelectIndustry}
            onSelectChild={handleSelectChild}
          />
        )}

        {/* Phase 2: Process areas */}
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
          />
          )
        )}

      </div>

      {/* ── KPMG Disclaimer Footer — only on phase 1 home screen ── */}
      {phase === 1 && !selectedParentIndustry && (
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
