import React, { useState, useEffect, useRef } from 'react';
import AppIcon from '../components/AppIcon';
import { getPageUrl, isPlainLeftClick } from '../utils/navigation';
import '../assets/css/usecase3.css';

const UseCase3 = ({ onNavigateToAllUseCases, onNavigateToDetail }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchWrapperRef = useRef(null);

  // Close dropdown when clicking anywhere outside the search wrapper
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target)) {
        setIsSearchFocused(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [stats, setStats] = useState({ useCases: 0, aiAgents: 0, businessAreas: 6, linesOfOffering: 9 });

  const [domainCounts, setDomainCounts] = useState({});
  const [allUseCases, setAllUseCases] = useState([]);
  const [selectedTool, setSelectedTool] = useState(null);

  useEffect(() => {
    // Fetch actual use cases to populate the counts for each business area card and the hero stats
    fetch('/api/use-cases')
      .then(res => res.json())
      .then(data => {
        setStats({
          useCases: 10,
          aiAgents: 10,
          businessAreas: 6,
          linesOfOffering: 9
        });

        const excelLobs = {
          'banking-finance': ['financial-outlook-generator', 'kpmg-agenda-creator', 'advisor-intelligence', 'bank-complaint-automation'],
          'am': ['financial-outlook-generator', 'augmented-insights-discovery'],
          'prod': [],
          'healthcare': [],
          'technology': [],
          'horizontal': ['proscreener', 'natural-language-data-querying', 'resume-creator', 'synthdataforge', 'pro-manager']
        };
        const counts = {};
        Object.keys(excelLobs).forEach(domId => {
          counts[domId] = excelLobs[domId].length;
        });
        setDomainCounts(counts);
        setAllUseCases(data);
      })
      .catch(err => console.error("Error fetching use cases:", err));
  }, []);

  const domains = [
    { id: 'banking-finance', label: 'Financial Services', desc: 'Banking, capital markets and insurance', icon: 'Landmark', matchIds: ['banking-finance', 'financial-services', 'banking', 'cap-market', 'insurance'] },
    { id: 'am', label: 'Asset Management / Private Equity', desc: 'Fund management, deal analytics and portfolio AI', icon: 'Briefcase', matchIds: ['am', 'am-pe', 'am-pe-sub'] },
    { id: 'prod', label: 'Products', desc: 'Consumer, retail, life sciences and manufacturing', icon: 'ShoppingBag', matchIds: ['prod', 'products', 'consumer-retail', 'life-sciences', 'industrial-manufacturing', 'enrc'] },
    { id: 'healthcare', label: 'Infrastructure, Government & Healthcare', desc: 'Healthcare, public sector and infrastructure', icon: 'HeartPulse', matchIds: ['healthcare', 'infrastructure-governance-healthcare', 'sled', 'federal'] },
    { id: 'technology', label: 'Technology, Media & Telecommunications', desc: 'All the TMT and digital services sectors', icon: 'Radio', matchIds: ['technology', 'tmt', 'tmt-sub'] },
    { id: 'horizontal', label: 'Horizontal', desc: 'Reusable AI capabilities across every industry', icon: 'GitMerge', matchIds: ['horizontal', 'hr', 'pmo', 'cv-screener', 'text-to-sql', 'data-generation'] }
  ];

  const popularUseCases = [
    { id: 'bank-complaint', label: 'Bank Complaint Automation', desc: 'Automates classification and routing of customer complaints using NLP', isAvailable: true },
    { id: 'agenda-creator', label: 'KPMG Agenda Creator', desc: 'Automatically draft flow and agenda of meeting agendas tailored to client engagement context', isAvailable: true },
    { id: 'resume-creator', label: 'Resume Creator', desc: 'Generate tailored, professional CVs from structured intake data in minutes', isAvailable: true },
    { id: 'pro-manager', label: 'Pro-Manager', desc: 'AI assistant project management solution for engagement delivery teams', isAvailable: true }
  ];

  // Map pill labels to domain IDs or tool IDs for navigation
  const pillNavMap = {
    'Banking': { type: 'domain', id: 'banking-finance' },
    'Financial Services': { type: 'domain', id: 'banking-finance' },
    'Resume Creator': { type: 'tool', id: 'resume-creator' },
    'Pro-Manager': { type: 'tool', id: 'pro-manager' },
    'Horizontal': { type: 'domain', id: 'horizontal' },
    'Agenda Creator': { type: 'tool', id: 'agenda-creator' },
    'Risk': { type: 'domain', id: 'banking-finance' },
  };

  const handlePillClick = (label) => {
    setSearchQuery(label);
    // Keep focus on the input so the dropdown stays open with search results
    const input = document.querySelector('.uc3-search-input-box input');
    if (input) input.focus();
  };

  // Derive search results dynamically
  const getSearchResults = () => {
    if (!searchQuery) return null;
    const query = searchQuery.toLowerCase();
    
    // 1. Match Domains (Lines of Business)
    const matchedDomains = domains.filter(d => 
      d.label.toLowerCase().includes(query) || d.desc.toLowerCase().includes(query)
    );
    
    // 2. Match Sub-LOBs
    let matchedSubLobs = [];
    domains.forEach(d => {
      const subLobs = d.desc.replace(/ and /g, ', ').split(', ').map(s => s.trim());
      subLobs.forEach(subLob => {
        if (subLob) {
          const cleanSubLob = subLob.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          if (cleanSubLob.toLowerCase().includes(query)) {
            matchedSubLobs.push({
              label: cleanSubLob,
              parentLabel: d.label,
              domainId: d.id,
              icon: 'GitBranch'
            });
          }
        }
      });
    });
    // Deduplicate sub-lobs
    matchedSubLobs = matchedSubLobs.filter((v,i,a)=>a.findIndex(t=>(t.label === v.label))===i);
    
    // 3. Match Use Cases
    const matchedUseCases = allUseCases.filter(uc => 
      uc.title.toLowerCase().includes(query) || 
      (uc.description && uc.description.toLowerCase().includes(query)) ||
      (uc.domainLabel && uc.domainLabel.toLowerCase().includes(query))
    );

    return {
      domains: matchedDomains.slice(0, 2),
      subLobs: matchedSubLobs.slice(0, 2),
      useCases: matchedUseCases.slice(0, 3),
      totalCount: matchedDomains.length + matchedSubLobs.length + matchedUseCases.length
    };
  };

  const searchResults = getSearchResults();

  const renderHeroView = () => (
    <>
      {/* ── HERO SECTION ── */}
      <section className="uc3-hero">
        <div className="uc3-hero-content">
          <div className="uc3-hero-left">
            <div className="uc3-eyebrow">
              <AppIcon name="Zap" size={14} fill="currentColor" />
              AI USE CASE EXPLORER
            </div>
            <h1 className="uc3-title">Discover AI Use Cases<br/><span className="uc3-title-highlight">Across KPMG</span></h1>
            <p className="uc3-subtitle">
              Explore AI solutions mapped to your business area and identify<br/>the right use cases for your team.
            </p>

            <div ref={searchWrapperRef} className={`uc3-search-wrapper ${isSearchFocused || searchQuery ? 'active' : ''}`}>
              <div className="uc3-search-input-box">
                <AppIcon name="Search" size={20} className="uc3-search-icon" />
                <input 
                  type="text" 
                  placeholder="Search by business area, use case, offering or business problem"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  // Removed onBlur so clicking the scrollbar or outside doesn't prematurely close it
                />
                {(isSearchFocused || searchQuery) && (
                  <button 
                    className="uc3-search-clear-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }}
                    aria-label="Close search"
                  >
                    <AppIcon name="X" size={14} />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {(isSearchFocused || searchQuery) && (
                <>
                  <div className="uc3-mega-dropdown">
                    {!searchQuery ? (
                      <div className="uc3-mega-content">
                        <div className="uc3-dropdown-section">
                          <div className="uc3-dropdown-title">
                            <AppIcon name="Clock" size={14} /> RECENT
                          </div>
                          <div className="uc3-dropdown-pills">
                            <div className="uc3-dropdown-pill" onClick={(e) => { e.preventDefault(); handlePillClick('Financial Services'); }}><AppIcon name="Clock" size={12} /> Financial Services</div>
                            <div className="uc3-dropdown-pill" onClick={(e) => { e.preventDefault(); handlePillClick('Resume Creator'); }}><AppIcon name="Clock" size={12} /> Resume Creator</div>
                            <div className="uc3-dropdown-pill" onClick={(e) => { e.preventDefault(); handlePillClick('Risk'); }}><AppIcon name="Clock" size={12} /> Risk</div>
                          </div>
                        </div>
                        
                        <div className="uc3-dropdown-section">
                          <div className="uc3-dropdown-title">
                            <AppIcon name="MousePointer2" size={14} /> TRY SEARCHING FOR
                          </div>
                          <div className="uc3-dropdown-pills">
                            <div className="uc3-dropdown-pill" onClick={(e) => { e.preventDefault(); handlePillClick('Banking'); }}>Banking</div>
                            <div className="uc3-dropdown-pill" onClick={(e) => { e.preventDefault(); handlePillClick('Financial Services'); }}>Financial Services</div>
                            <div className="uc3-dropdown-pill" onClick={(e) => { e.preventDefault(); handlePillClick('Resume Creator'); }}>Resume Creator</div>
                            <div className="uc3-dropdown-pill" onClick={(e) => { e.preventDefault(); handlePillClick('Pro-Manager'); }}>Pro-Manager</div>
                            <div className="uc3-dropdown-pill" onClick={(e) => { e.preventDefault(); handlePillClick('Horizontal'); }}>Horizontal</div>
                            <div className="uc3-dropdown-pill" onClick={(e) => { e.preventDefault(); handlePillClick('Agenda Creator'); }}>Agenda Creator</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="uc3-mega-content uc3-search-results-content">
                        {/* Lines of Business */}
                        {searchResults.domains.length > 0 && (
                          <div className="uc3-dropdown-section">
                            <div className="uc3-dropdown-title">
                              <AppIcon name="LayoutGrid" size={14} /> LINES OF BUSINESS
                            </div>
                            <div className="uc3-results-list">
                              {searchResults.domains.map(d => (
                                <div key={d.id} className="uc3-result-item" onMouseDown={(e) => { 
                                  e.preventDefault(); 
                                  if (onNavigateToAllUseCases) onNavigateToAllUseCases(d.id);
                                  setIsSearchFocused(false);
                                  setTimeout(() => {
                                    const domainSection = document.querySelector('.uc3-domain-grid');
                                    if (domainSection) domainSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }, 100);
                                }}>
                                  <div className="uc3-result-icon-wrapper lob-bg">
                                    <AppIcon name={d.icon || 'Landmark'} size={16} />
                                  </div>
                                  <div className="uc3-result-text">
                                    <div className="uc3-result-label">{d.label}</div>
                                    <div className="uc3-result-sublabel">{d.label}</div>
                                  </div>
                                  <div className="uc3-result-badge lob-badge">LOB &rarr;</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Sub-LOBs */}
                        {searchResults.subLobs.length > 0 && (
                          <div className="uc3-dropdown-section">
                            <div className="uc3-dropdown-title">
                              <AppIcon name="GitBranch" size={14} /> SUB-LOBS
                            </div>
                            <div className="uc3-results-list">
                              {searchResults.subLobs.map((sl, idx) => (
                                <div key={idx} className="uc3-result-item" onMouseDown={(e) => { 
                                  e.preventDefault(); 
                                  if (onNavigateToAllUseCases) onNavigateToAllUseCases(sl.domainId);
                                  setIsSearchFocused(false);
                                  setTimeout(() => {
                                    const domainSection = document.querySelector('.uc3-domain-grid');
                                    if (domainSection) domainSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }, 100);
                                }}>
                                  <div className="uc3-result-icon-wrapper sublob-bg">
                                    <AppIcon name={sl.icon || 'GitBranch'} size={16} />
                                  </div>
                                  <div className="uc3-result-text">
                                    <div className="uc3-result-label">{sl.label}</div>
                                    <div className="uc3-result-sublabel">{sl.parentLabel} &gt; {sl.label}</div>
                                  </div>
                                  <div className="uc3-result-badge sublob-badge">Sub-LOB &rarr;</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Use Cases */}
                        {searchResults.useCases.length > 0 && (
                          <div className="uc3-dropdown-section">
                            <div className="uc3-dropdown-title">
                              <AppIcon name="Tag" size={14} /> USE CASES
                            </div>
                            <div className="uc3-results-list">
                              {searchResults.useCases.map(uc => (
                                <div key={uc.id} className="uc3-result-item" onMouseDown={(e) => { 
                                  e.preventDefault(); 
                                  if (onNavigateToDetail) onNavigateToDetail(uc.id);
                                  setIsSearchFocused(false);
                                }}>
                                  <div className="uc3-result-icon-wrapper usecase-bg">
                                    <AppIcon name={uc.icon || "FileText"} size={16} />
                                  </div>
                                  <div className="uc3-result-text">
                                    <div className="uc3-result-label">{uc.title}</div>
                                    <div className="uc3-result-sublabel">{uc.domainLabel || "Horizontal"} &gt; {uc.title}</div>
                                  </div>
                                  <div className="uc3-result-badge usecase-badge">Use Case &rarr;</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="uc3-search-footer">
                          <span>{searchResults.totalCount} results</span>
                          <span className="uc3-search-hints">&uarr;&darr; select &middot; Esc</span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Quick Filters */}
            {!isSearchFocused && !searchQuery && (
              <div className="uc3-quick-filters">
                <span className="uc3-try-label">Try:</span>
                <div className="uc3-filter-chip" onClick={() => handlePillClick('Banking')}>Banking</div>
                <div className="uc3-filter-chip" onClick={() => handlePillClick('Resume Creator')}>Resume Creator</div>
                <div className="uc3-filter-chip" onClick={() => handlePillClick('Pro-Manager')}>Pro-Manager</div>
                <div className="uc3-filter-chip" onClick={() => handlePillClick('Augmented Insights')}>Augmented Insights</div>
              </div>
            )}
          </div>

          <div className="uc3-hero-right">
            {/* Network Graphic */}
            <div className="uc3-network-graphic">
               {/* SVG Lines connecting nodes */}
               <svg className="uc3-network-lines" viewBox="0 0 400 400">
                  <line x1="200" y1="200" x2="80" y2="120" />
                  <line x1="200" y1="200" x2="320" y2="120" />
                  <line x1="200" y1="200" x2="360" y2="240" />
                  <line x1="200" y1="200" x2="240" y2="340" />
                  <line x1="200" y1="200" x2="60" y2="240" />
               </svg>

               {/* Center Node */}
               <div className="uc3-node center pulse-animation">
                 <div className="uc3-node-inner"></div>
               </div>
               
               {/* Surrounding Nodes */}
               <div className="uc3-node node-1 float-anim-1"></div>
               <div className="uc3-node node-2 float-anim-2"></div>
               <div className="uc3-node node-3 float-anim-3"></div>
               <div className="uc3-node node-4 float-anim-1"></div>
               <div className="uc3-node node-5 float-anim-2"></div>

               {/* Floating Tag */}
               <div className="uc3-floating-tag tag-left float-anim-3">
                  <span className="tag-label">HORIZONTAL AI</span>
                  <span className="tag-value">{stats.aiAgents} AI Agents</span>
               </div>
               <div className="uc3-floating-tag tag-right float-anim-1">
                  <span className="tag-label">FINANCIAL SERVICES</span>
                  <span className="tag-value">{domainCounts['banking-finance'] || 0} Use Cases</span>
               </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="uc3-stats-bar">
          <div className="uc3-stat">
            <div className="uc3-stat-icon-wrapper">
              <AppIcon name="BarChart2" size={24} className="uc3-stat-icon" />
            </div>
            <div className="uc3-stat-text">
              <div className="uc3-stat-val">{stats.useCases}+</div>
              <div className="uc3-stat-label">Use Cases</div>
            </div>
          </div>
          <div className="uc3-stat">
            <div className="uc3-stat-icon-wrapper">
              <AppIcon name="Bot" size={24} className="uc3-stat-icon" />
            </div>
            <div className="uc3-stat-text">
              <div className="uc3-stat-val">{stats.aiAgents}+</div>
              <div className="uc3-stat-label">AI Applications</div>
            </div>
          </div>
          <div className="uc3-stat">
            <div className="uc3-stat-icon-wrapper">
              <AppIcon name="Building2" size={24} className="uc3-stat-icon" />
            </div>
            <div className="uc3-stat-text">
              <div className="uc3-stat-val">{stats.businessAreas}</div>
              <div className="uc3-stat-label">Business Areas</div>
            </div>
          </div>
          <div className="uc3-stat">
            <div className="uc3-stat-icon-wrapper">
              <AppIcon name="Layers" size={24} className="uc3-stat-icon" />
            </div>
            <div className="uc3-stat-text">
              <div className="uc3-stat-val">{stats.linesOfOffering}</div>
              <div className="uc3-stat-label">Lines of Offering</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── EXPLORE SECTION ── */}
      <section className="uc3-section uc3-explore-section">
        <div className="uc3-section-header">
          <h2>Explore by Business Area</h2>
          <p>Choose a business area to instantly see all matching AI use cases.</p>
        </div>

        <div className="uc3-domain-grid">
          {domains.map(domain => (
            <a
              href={getPageUrl('allusecases', { domain: domain.id })}
              className="uc3-domain-card"
              key={domain.id}
              onClick={(e) => {
                if (isPlainLeftClick(e)) {
                  e.preventDefault();
                  onNavigateToAllUseCases && onNavigateToAllUseCases(domain.id);
                }
              }}
              style={{ display: 'block', cursor: 'pointer' }}
            >
              <div className="uc3-domain-icon">
                <AppIcon name={domain.icon} size={24} />
              </div>
              <h3 className="uc3-domain-title">{domain.label}</h3>
              <p className="uc3-domain-desc">{domain.desc}</p>
              
              <div className="uc3-domain-footer">
                <span className="uc3-domain-count">{domainCounts[domain.id] || 0} use cases</span>
                <span className="uc3-domain-link">Explore →</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── POPULAR SECTION ── */}
      <section className="uc3-section uc3-popular-section">
        <div className="uc3-section-header flex-between">
          <div>
            <h2>Popular AI Use Cases</h2>
            <p>Frequently viewed and highly rated use cases.</p>
          </div>
          <a
            href={getPageUrl('allusecases')}
            className="uc3-view-all"
            onClick={(e) => {
              if (isPlainLeftClick(e)) {
                e.preventDefault();
                if (onNavigateToAllUseCases) onNavigateToAllUseCases('all');
              }
            }}
          >
            View all →
          </a>
        </div>

        <div className="uc3-popular-grid">
          {popularUseCases.map(uc => (
            <a
              href={getPageUrl('usecasedetail', { id: uc.id })}
              className="uc3-popular-card"
              key={uc.id}
              onClick={(e) => {
                if (isPlainLeftClick(e)) {
                  e.preventDefault();
                  onNavigateToDetail && onNavigateToDetail(uc.id);
                }
              }}
              style={{ display: 'block', cursor: 'pointer' }}
            >
              {uc.isAvailable && (
                <div className="uc3-badge available">
                  <span className="dot"></span> Available
                </div>
              )}
              <h3 className="uc3-popular-title">{uc.label}</h3>
              <p className="uc3-popular-desc">{uc.desc}</p>
              <div className="uc3-popular-footer">
                <span className="uc3-view-details">View details →</span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </>
  );

  return (
    <div className="uc3-container">
      {renderHeroView()}
      
      {/* ── FOOTER ── */}
      <footer className="uc3-footer">
        <div className="uc3-footer-left">
          <img src="/kpmg-logo.png" alt="KPMG" style={{ height: '24px' }} />
          <span>© 2026 KPMG International</span>
        </div>
        <div className="uc3-footer-links">
          <a href="#">Privacy policy</a>
          <a href="#">Terms of use</a>
          <a href="#">Support</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default UseCase3;
