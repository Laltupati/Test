import React from 'react';
import Banner from '../components/Banner';
import { SkeletonCategoryPage } from '../components/Skeleton';
import '../assets/css/category.css';
import '../assets/css/landing.css';




const techStack = [
  { label: 'GenAI and Agentic AI' },
  { label: 'RAG' },
  { label: 'NLP' },
  { label: 'LLM' },
  { label: 'Computer Vision' },
  { label: 'Azure OpenAI' },
  { label: 'Document Intelligence' },
  { label: 'AI Search' },
];

const DOMAIN_META = {
  'banking-finance': {
    label: 'Banking and Finance',
    image: '/banking.jpg',
    accent: 'blue',
    type: 'industry',
    cluster: 'Financial Services',
  },
  'insurance': {
    label: 'Insurance',
    image: '/insurance.jpg',
    accent: 'purple',
    type: 'industry',
    cluster: 'Financial Services',
  },
  'hr': {
    label: 'HR and Talent',
    image: '/hr.avif',
    accent: 'lblue',
    type: 'internal',
    cluster: 'Talent and Corporate',
  },
  'technology': {
    label: 'Technology',
    image: '/tech.jpg',
    accent: 'teal',
    type: 'internal',
    cluster: 'Technology and Health',
  },
  'healthcare': {
    label: 'Healthcare',
    image: '/health_tech.avif',
    accent: 'violet',
    type: 'industry',
    cluster: 'Technology and Health',
  },
};

const CLUSTER_ORDER = [
  'Financial Services',
  'Talent and Corporate',
  'Technology and Health',
  'Other Domains',
];

const ArrowRight = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const CategoryPage = ({ onSelectDomain }) => {
  const [useCases, setUseCases] = React.useState([]);
  const [search, setSearch] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('http://localhost:3000/api/use-cases')
      .then(res => res.json())
      .then(data => { setUseCases(Array.isArray(data) ? data : []); setIsLoading(false); })
      .catch(err => { console.error('Error fetching use cases:', err); setIsLoading(false); });
  }, []);

  const domainList = React.useMemo(() => {
    if (useCases.length === 0) return [];
    const counts = {};
    useCases.forEach(uc => {
      (uc.domain || []).forEach((slug) => {
        counts[slug] = (counts[slug] || 0) + 1;
      });
    });

    return Object.keys(counts).map((slug) => {
      const meta = DOMAIN_META[slug] || {};
      const label = meta.label || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        slug,
        label,
        count: counts[slug],
        image: meta.image || '',
        accent: meta.accent || 'blue',
        type: meta.type || 'industry',
        cluster: meta.cluster || 'Other Domains',
      };
    }).sort((a, b) => a.label.localeCompare(b.label));
  }, [useCases]);

  const groups = React.useMemo(() => {
    const map = new Map();
    domainList.forEach((cat) => {
      const key = cat.cluster || 'Other Domains';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(cat);
    });

    const ordered = [];
    CLUSTER_ORDER.forEach((name) => {
      if (map.has(name)) ordered.push({ title: name, categories: map.get(name) });
    });
    Array.from(map.keys()).forEach((name) => {
      if (!CLUSTER_ORDER.includes(name)) {
        ordered.push({ title: name, categories: map.get(name) });
      }
    });
    return ordered;
  }, [domainList]);

  const totalSolutions = useCases.length;
  const totalDomains = domainList.length;
  const clusterCount = groups.length;
  const coverageAreas = totalDomains + clusterCount;

  return (
    <div className="category-page" style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── Animated background ── */}
      <div className="landing-bg">
        <div className="landing-bg-orb orb1" />
        <div className="landing-bg-orb orb2" />
        <div className="landing-bg-orb orb3" />
        <div className="landing-grid" />
      </div>

      {/* ── Hero ── */}
      {/* <section className="landing-hero landing-hero--split">
        <div className="landing-hero-grid">
          <div className="landing-hero-content">
            <div className="landing-eyebrow">
              ✦ &nbsp;KPMG AI Centre of Excellence
            </div>

            <h1 className="landing-hero-title">
              Intelligent AI Solutions<br />
              <span>Built for Every Team</span>
            </h1>

            <p className="landing-hero-sub">
              Explore and launch AI tools developed by the Centre of Excellence empowering every team across KPMG, powered by Azure OpenAI.
            </p>
          </div>

          <div className="landing-hero-panel">
            <div className="landing-hero-panel-title">At a glance</div>
            <div className="landing-stats landing-stats--panel">
              {[
                { val: String(totalSolutions), em: '+', lbl: 'Solutions Live' },
                { val: String(totalDomains), em: '', lbl: 'Domains Covered' },

              ].map((s, i) => (
                <div key={i} className="landing-stat">
                  <div className="landing-stat-val">{s.val}<em>{s.em}</em></div>
                  <div className="landing-stat-lbl">{s.lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section> */}

      {/* ── Hero ── */}
      <section className="category-hero-banner">
        <Banner
          stats={[
            { val: String(totalSolutions), em: '', lbl: 'Solutions' },
            { val: String(clusterCount), em: '', lbl: 'Services' },
            { val: String(totalDomains), em: '', lbl: 'Domains' },
          ]}
        />
      </section>

      <section className="landing-explore">
        <div className="landing-explore-inner">
          {/* Top Bar: Search */}
          <div className="landing-search-row">
            <div className="search-wrap" style={{ flex: 1, maxWidth: '400px', display: 'flex', alignItems: 'center', position: 'relative' }}>
              <svg style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input 
                className="search-input" 
                type="text" 
                placeholder="Search domains..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ 
                  width: '100%', padding: '10px 14px 10px 36px', 
                  borderRadius: '6px', border: '1px solid rgba(65, 120, 217, 0.4)', 
                  outline: 'none', fontSize: '14px', background: 'var(--surface-1)',
                  boxShadow: '0 0 12px rgba(65, 120, 217, 0.15)'
                }}
              />
            </div>
          </div>

          {/* ── Domain sections ── */}
          {isLoading ? (
            <SkeletonCategoryPage sections={2} tilesPerSection={4} />
          ) : (
          <>
          {groups.map((group) => {
            // Filter categories within the group by Search
            const filteredCategories = group.categories.filter(cat => {
              const matchesSearch = search === '' || cat.label.toLowerCase().includes(search.toLowerCase());
              return matchesSearch;
            });

            // Hide group entirely if no categories match
            if (filteredCategories.length === 0) return null;

            return (
              <div key={group.title} className="category-section" style={{ padding: '0 0 40px 0' }}>
                <div className="category-section-title">{group.title}</div>
                <div className="category-grid">
                  {filteredCategories.map((cat) => (
                    <div
                      key={cat.slug}
                      className="cat-tile"
                      data-accent={cat.accent}
                      onClick={() => onSelectDomain(cat.slug)}
                    >
                      {/* Background image */}
                      <div
                        className="cat-tile-bg"
                        style={{ backgroundImage: `url(${cat.image})` }}
                      />
                      {/* Overlay */}
                      <div className="cat-tile-overlay" />
                      {/* Content */}
                      <div className="cat-tile-content">
                        <div className="cat-tile-meta">
                          <span className="cat-tile-count">
                            {cat.count} solution{cat.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="cat-tile-name">{cat.label}</div>
                        <button className="cat-tile-btn">
                          See Solutions <ArrowRight />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {groups.every(group => 
            group.categories.filter(cat => 
              (search === '' || cat.label.toLowerCase().includes(search.toLowerCase()))
            ).length === 0
          ) && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                No domains found
              </div>
              <div style={{ fontSize: '13px' }}>Try adjusting your search or filters.</div>
            </div>
          )}
          </>
          )}





        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <span className="landing-footer-text">
            © {new Date().getFullYear()} KPMG
          </span>
          <span className="landing-footer-dot">·</span>
          <span className="landing-footer-text">AI Centre of Excellence</span>
        </div>
      </footer>
    </div>
  );
};

export default CategoryPage;