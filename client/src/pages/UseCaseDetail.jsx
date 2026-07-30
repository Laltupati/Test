import React, { useState, useEffect } from 'react';
import AppIcon from '../components/AppIcon';
import toolDetails from '../data/toolDetails';
import { getPageUrl, isPlainLeftClick } from '../utils/navigation';
import '../assets/css/usecasedetail.css';

/* Map tags keys to readable labels */
const LOO_LABELS = {
  'customer-service-ops': 'Customer & Operations',
  'corporate-services': 'Corporate Services',
  'risk-services': 'Risk Services',
  'technology-solutions': 'Technology Solutions'
};

/* Domain ID to label */
const DOMAIN_LABELS = {
  'banking-finance': 'Financial Services',
  'am': 'Asset Management / Private Equity',
  'prod': 'Products',
  'healthcare': 'Infrastructure, Governance & Healthcare',
  'technology': 'Technology, Media & Telecommunications',
  'horizontal': 'Horizontal',
  'hr': 'Human Resources',
  'insurance': 'Insurance'
};

/* Strict taxonomy breadcrumb mapping from the Excel specification */
const EXCEL_BREADCRUMBS = {
  'financial-outlook-generator': { domainId: 'banking-finance', domainLabel: 'Financial Services', looLabel: 'Corporate Services' },
  'kpmg-agenda-creator': { domainId: 'banking-finance', domainLabel: 'Financial Services', looLabel: 'Corporate Services' },
  'advisor-intelligence': { domainId: 'banking-finance', domainLabel: 'Financial Services', looLabel: 'Corporate Services' },
  'bank-complaint-automation': { domainId: 'banking-finance', domainLabel: 'Financial Services', looLabel: 'Customer & Operations' },
  'augmented-insights-discovery': { domainId: 'am', domainLabel: 'Asset Management / Private Equity', looLabel: 'Corporate Services' },
  'proscreener': { domainId: 'horizontal', domainLabel: 'Horizontal', looLabel: 'CV Screener' },
  'natural-language-data-querying': { domainId: 'horizontal', domainLabel: 'Horizontal', looLabel: 'Text to SQL Generation' },
  'resume-creator': { domainId: 'horizontal', domainLabel: 'Horizontal', looLabel: 'Resume creator' },
  'synthdataforge': { domainId: 'horizontal', domainLabel: 'Horizontal', looLabel: 'Data generation' },
  'pro-manager': { domainId: 'horizontal', domainLabel: 'Horizontal', looLabel: 'PMO' }
};

/* Mock enrichment data per use case (fields not in API) */
const ENRICHMENT = {
  'proscreener': {
    overview: 'Proscreener streamlines the hiring process by intelligently screening CVs against job requirements — automatically extracting key qualifications, ranking candidates by fit, and producing standardized shortlists. It reduces manual screening time from hours to minutes while maintaining consistency across all hiring decisions.',
    valueAmount: '$340K annually through reduced recruitment cycle time and improved candidate quality.',
    activeUsers: '950+', geos: 2,
    benefits: [
      'CV screening completed in under 2 minutes per candidate',
      'Bias-reduced scoring using structured evaluation criteria',
      'Automated ranking and shortlisting across multiple roles',
      'Supports PDF, DOCX, and structured resume formats'
    ],
    sponsor: 'Sarah Mitchell, Director — Human Capital',
    owner: 'Raj Patel',
    classification: 'internal',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US'],
    support: 'Self-Service',
    training: 'Available — Quick start guide',
    faqs: 6,
    releaseNotes: 'v2.1.0 — Feb 2025 · Multi-role batch screening',
    testimonial: { quote: 'We reduced our screening time by 80% while actually improving candidate quality.', author: 'Emily Chen', role: 'Talent Acquisition Lead, Advisory' },
    successStory: { title: 'Campus Recruitment Drive', text: 'Processed 3,200+ applications in 48 hours during fall campus recruitment, reducing team workload by 75%.' }
  },
  'natural-language-data-querying': {
    overview: 'Natural Language Data Querying converts plain English questions into optimized SQL queries, enabling business users to access enterprise data without technical SQL knowledge. It supports complex joins, aggregations, and filters while ensuring query safety and performance optimization.',
    valueAmount: '$280K annually through reduced dependency on data engineering teams for ad-hoc queries.',
    activeUsers: '1,200+', geos: 3,
    benefits: [
      'Natural language to SQL conversion in seconds',
      'Auto-optimized queries for large enterprise datasets',
      'Built-in guardrails prevent destructive operations',
      'Supports multiple database schemas and dialects'
    ],
    sponsor: 'Michael Torres, Partner — Data & Analytics',
    owner: 'Anita Sharma',
    classification: 'internal',
    licensing: 'Azure SQL License Required',
    geographies: ['UK', 'US', 'EU'],
    support: 'Self-Service',
    training: 'Available — Video walkthrough',
    faqs: 5,
    releaseNotes: 'v1.5.0 — Jan 2025 · Multi-schema support',
    testimonial: { quote: 'I can now pull reports that used to require a data engineer in minutes.', author: 'Tom Richards', role: 'Senior Analyst, Capital Markets' },
    successStory: { title: 'Quarterly Reporting Acceleration', text: 'Enabled 200+ analysts to self-serve data queries, reducing report generation backlog by 60%.' }
  },
  'bank-complaint-automation': {
    overview: 'Bank Complaint Automation uses AI to streamline the end-to-end complaints handling process for financial institutions. It classifies incoming complaints by type, severity, and regulation — then routes them to the appropriate team with recommended resolution actions and regulatory references.',
    valueAmount: '$620K annually through faster complaint resolution and reduced regulatory risk.',
    activeUsers: '2,100+', geos: 3,
    benefits: [
      'Complaint classification accuracy exceeding 94%',
      'Automatic routing based on regulatory requirements',
      'Resolution recommendations with regulatory citations',
      'Real-time dashboards for compliance teams'
    ],
    sponsor: 'Jonathan Webb, Partner — Risk & Compliance',
    owner: 'Maria Santos',
    classification: 'confidential',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US', 'EU'],
    support: 'Managed Service',
    training: 'Available — Quick start guide',
    faqs: 9,
    releaseNotes: 'v3.0.1 — Mar 2025 · Enhanced regulatory mapping',
    testimonial: { quote: 'Complaint resolution time dropped from 5 days to under 24 hours.', author: 'Rachel Cooper', role: 'Head of Operations, Banking' },
    successStory: { title: 'Regulatory Compliance Overhaul', text: 'Processed 15,000+ complaints in Q1 2025 with 98.2% accurate classification, eliminating 3 FTE equivalent manual effort.' }
  },
  'archi-made-easy': {
    overview: 'Archi-Made-Easy acts as a buddy for every technology architect — analyzing, comparing, and deciphering complex architectural diagrams using generative AI vision models. Upload any architecture diagram and get instant documentation, gap analysis, and improvement recommendations.',
    valueAmount: '$180K annually through accelerated architecture review cycles.',
    activeUsers: '320+', geos: 1,
    benefits: [
      'Architecture diagram analysis in under 60 seconds',
      'Automatic documentation generation from diagrams',
      'Side-by-side comparison of design alternatives',
      'Integration with enterprise architecture tools'
    ],
    sponsor: 'Kevin Park, Director — Technology Consulting',
    owner: 'Diana Walsh',
    classification: 'internal',
    licensing: 'No Additional License Required',
    geographies: ['US'],
    support: 'Self-Service',
    training: 'Available — Tutorial video',
    faqs: 4,
    releaseNotes: 'v1.0.0 — Dec 2024 · Initial release with vision analysis',
    testimonial: { quote: 'What took a full day of architecture review is now done in an hour.', author: 'Chris Yang', role: 'Enterprise Architect, TMT' },
    successStory: { title: 'Cloud Migration Assessment', text: 'Analyzed 45 architecture diagrams for a major cloud migration project, producing comprehensive documentation in 2 days instead of 3 weeks.' }
  },
  'resume-creator': {
    overview: 'Resume Creator generates polished, KPMG-branded Profile Slides from raw CV data. It extracts key qualifications, standardizes formatting, and produces client-ready proposal slides that maintain brand consistency across all engagement teams.',
    valueAmount: '$150K annually through eliminating manual resume formatting effort.',
    activeUsers: '1,400+', geos: 2,
    benefits: [
      'KPMG-branded profile slides in under 3 minutes',
      'Automatic extraction of key qualifications and skills',
      'Consistent formatting across all team members',
      'Supports multiple output formats (PPTX, DOCX)'
    ],
    sponsor: 'Laura Bennett, Director — People & Change',
    owner: 'Alex Kim',
    classification: 'internal',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US'],
    support: 'Self-Service',
    training: 'Available — Quick start guide',
    faqs: 7,
    releaseNotes: 'v2.3.0 — Feb 2025 · Multi-language CV support',
    testimonial: { quote: 'Our proposal team saves 2+ hours per engagement with standardized profiles.', author: 'Priya Nair', role: 'Manager, Proposal Services' },
    successStory: { title: 'Large Proposal Sprint', text: 'Generated 120+ KPMG profile slides for a major bid in 4 hours, compared to 3 days with manual formatting.' }
  },
  'tom-asset-comparisons': {
    overview: 'TOM Asset Comparisons provides security controls and role-based process flow comparison for Target Operating Model assessments. It analyzes multiple asset classes side-by-side, identifying gaps, overlaps, and optimization opportunities across complex organizational structures.',
    valueAmount: '$290K annually through faster TOM assessments and reduced consultant hours.',
    activeUsers: '450+', geos: 2,
    benefits: [
      'Side-by-side TOM comparison across asset classes',
      'Automated gap and overlap identification',
      'Role-based process flow visualization',
      'Export to structured Excel reports'
    ],
    sponsor: 'Gregory Stone, Partner — Risk Advisory',
    owner: 'Helen Chu',
    classification: 'confidential',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US'],
    support: 'Managed Service',
    training: 'Available — Workshop-based',
    faqs: 5,
    releaseNotes: 'v1.1.0 — Jan 2025 · Enhanced role mapping',
    testimonial: { quote: 'TOM assessments that took weeks now take days with consistent quality.', author: 'David Price', role: 'Director, Risk Advisory' },
    successStory: { title: 'Global Bank TOM Review', text: 'Completed a comprehensive TOM review across 8 business lines in 2 weeks, identifying 23 optimization opportunities.' }
  },
  'financial-outlook-generator': {
    overview: 'Financial Outlook Generator creates comprehensive financial and market outlook reports with AI-generated insights, trend analysis, and strategic recommendations. It processes structured data inputs and produces polished narratives suitable for client presentations and internal strategy sessions.',
    valueAmount: '$410K annually through accelerated report generation and improved insight quality.',
    activeUsers: '780+', geos: 3,
    benefits: [
      'Forward-looking financial narratives in minutes',
      'Trend analysis across multiple data sources',
      'Customizable templates for different audiences',
      'Integration with Excel data pipelines'
    ],
    sponsor: 'Andrew Walsh, Partner — Financial Advisory',
    owner: 'Sophie Chen',
    classification: 'internal',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US', 'EU'],
    support: 'Self-Service',
    training: 'Available — Quick start guide',
    faqs: 6,
    releaseNotes: 'v2.0.0 — Mar 2025 · Multi-market outlook support',
    testimonial: { quote: 'The quality of AI-generated financial narratives rivals our senior analysts.', author: 'Mark Thompson', role: 'Associate Director, Capital Markets' },
    successStory: { title: 'Quarterly Outlook Suite', text: 'Automated generation of 12 market outlook reports per quarter, freeing 160+ analyst hours for higher-value work.' }
  },
  'power-bi-publication-scoreboard': {
    overview: 'Power BI Publication Scoreboard tracks and visualizes content performance metrics for internal Power BI publications and marketing communications. It provides real-time dashboards showing usage, engagement, and adoption metrics across the organization.',
    valueAmount: '$120K annually through improved content strategy and resource allocation.',
    activeUsers: '600+', geos: 3,
    benefits: [
      'Real-time publication performance tracking',
      'Automated engagement scoring and ranking',
      'Content recommendation engine for readers',
      'Executive-ready dashboard views'
    ],
    sponsor: 'Nina Roberts, Director — Marketing & Communications',
    owner: 'James Liu',
    classification: 'internal',
    licensing: 'Power BI Pro License Required',
    geographies: ['UK', 'US', 'EU'],
    support: 'Self-Service',
    training: 'Available — Dashboard walkthrough',
    faqs: 4,
    releaseNotes: 'v1.3.0 — Feb 2025 · Enhanced content analytics',
    testimonial: { quote: 'We finally have visibility into which content drives real engagement.', author: 'Claire Adams', role: 'Content Strategy Lead' },
    successStory: { title: 'Content Rationalization', text: 'Identified top 20% of publications driving 80% engagement, enabling strategic content consolidation.' }
  },
  'augmented-insights-discovery': {
    overview: 'Augmented Insights and Discovery Engine is a core HybridGraph4AI solution that transforms unstructured financial advisor biographies and integrates them with structured sales and assets datasets. It surfaces hidden investment insights across large unstructured data sources.',
    valueAmount: '$580K annually through enhanced advisor intelligence and cross-selling opportunities.',
    activeUsers: '520+', geos: 2,
    benefits: [
      'Hidden pattern discovery across financial datasets',
      'Advisor profile enrichment from unstructured sources',
      'Cross-selling opportunity identification',
      'Graph-based relationship mapping'
    ],
    sponsor: 'Robert Zhang, Partner — Asset Management',
    owner: 'Catherine Moore',
    classification: 'confidential',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US'],
    support: 'Managed Service',
    training: 'Available — Workshop-based',
    faqs: 7,
    releaseNotes: 'v2.1.0 — Mar 2025 · Enhanced graph analytics',
    testimonial: { quote: 'We discovered cross-selling opportunities worth $12M in the first quarter alone.', author: 'Patricia Wong', role: 'VP, Wealth Management' },
    successStory: { title: 'Wealth Advisory Insights', text: 'Processed 8,000+ advisor profiles and identified 340 high-value relationship clusters previously invisible to the team.' }
  },
  'kpmg-agenda-creator': {
    overview: 'KPMG Agenda Creator takes engagement context — client industry, meeting type, stakeholder profile and prior meeting notes — and generates a structured, professional agenda. It reduces preparation time and ensures consistent, high-quality client interactions across engagement teams.',
    valueAmount: '$520K annually through reduced meeting preparation time across advisory and assurance teams.',
    activeUsers: '1,800+', geos: 3,
    benefits: [
      'Meeting agenda generated in under 3 minutes',
      'Context-aware — adapts to client industry and meeting type',
      'Consistent output quality across all seniority levels',
      'Integrates with Outlook and Teams calendaring'
    ],
    sponsor: 'David Chen, Partner — Capital Markets',
    owner: 'Lisa Park',
    classification: 'internal',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US', 'EU'],
    support: 'Self-Service',
    training: 'Available — Quick start guide',
    faqs: 8,
    releaseNotes: 'v1.2.0 — March 2025 · Outlook calendar integration',
    testimonial: { quote: 'I prepare for client meetings in a fraction of the time now.', author: 'James Newton', role: 'Senior Manager, Advisory' },
    successStory: { title: 'Advisory Team Rollout', text: 'Used by 1,800+ professionals within 3 months of launch, saving average 45 minutes per meeting.' }
  },
  'advisor-intelligence': {
    overview: 'Advisor Intelligence automates agenda generation for advisor fund meetings by analyzing fund details and meeting context. It produces tailored, data-driven agendas that enable advisors to have more productive and informed client conversations.',
    valueAmount: '$390K annually through improved advisor productivity and meeting effectiveness.',
    activeUsers: '680+', geos: 2,
    benefits: [
      'AI-powered meeting agenda tailored to fund context',
      'Real-time fund performance data integration',
      'Automated pre-meeting briefing documents',
      'Post-meeting action item tracking'
    ],
    sponsor: 'Elizabeth Foster, Partner — Wealth Advisory',
    owner: 'Ryan Kim',
    classification: 'confidential',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US'],
    support: 'Self-Service',
    training: 'Available — Quick start guide',
    faqs: 6,
    releaseNotes: 'v1.4.0 — Feb 2025 · Fund performance integration',
    testimonial: { quote: 'Every meeting now starts with a comprehensive, data-backed agenda.', author: 'Sarah Phillips', role: 'Senior Advisor, Wealth Management' },
    successStory: { title: 'Advisor Productivity Boost', text: 'Average meeting prep time reduced from 45 minutes to 8 minutes across 680+ advisors.' }
  },
  'synthdataforge': {
    overview: 'SynthDataForge creates realistic, high-quality synthetic datasets for machine learning development and testing. It generates statistically representative dummy data while preserving privacy, enabling teams to develop and test models without access to sensitive production data.',
    valueAmount: '$210K annually through accelerated ML development cycles and reduced data access bottlenecks.',
    activeUsers: '380+', geos: 2,
    benefits: [
      'Statistically representative synthetic data generation',
      'Privacy-preserving — no PII exposure risk',
      'Support for CSV, JSON, and SQL output formats',
      'Configurable data distributions and correlations'
    ],
    sponsor: 'Daniel Lee, Director — AI Engineering',
    owner: 'Michelle Wang',
    classification: 'internal',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US'],
    support: 'Self-Service',
    training: 'Available — Documentation',
    faqs: 5,
    releaseNotes: 'v1.2.0 — Jan 2025 · Custom distribution support',
    testimonial: { quote: 'We eliminated our 3-week data access approval cycle entirely.', author: 'Anil Gupta', role: 'ML Engineer, Data Science' },
    successStory: { title: 'ML Pipeline Acceleration', text: 'Reduced ML model development cycle from 8 weeks to 3 weeks by providing instant synthetic training data.' }
  },
  'pro-manager': {
    overview: 'Pro-Manager is a one-stop project management solution harnessing AI and GenAI to make project activities efficient across the full engagement lifecycle. It automates status reporting, risk flagging, and resource planning while providing predictive insights for proactive management.',
    valueAmount: '$450K annually through improved project delivery efficiency and risk reduction.',
    activeUsers: '2,400+', geos: 5,
    benefits: [
      'Automated weekly status report generation',
      'AI-driven risk identification and early warning',
      'Predictive resource planning and allocation',
      'Cross-engagement portfolio analytics'
    ],
    sponsor: 'Richard Hayes, Partner — Delivery Excellence',
    owner: 'Samantha Brooks',
    classification: 'internal',
    licensing: 'No Additional License Required',
    geographies: ['UK', 'US', 'EU', 'APAC', 'MEA'],
    support: 'Managed Service',
    training: 'Available — Onboarding program',
    faqs: 12,
    releaseNotes: 'v3.1.0 — Mar 2025 · Portfolio analytics dashboard',
    testimonial: { quote: 'Pro-Manager transformed how we track and deliver complex engagements.', author: 'Karen Walsh', role: 'Engagement Manager, Technology' },
    successStory: { title: 'Enterprise Program Management', text: 'Managed 150+ concurrent engagements with 30% reduction in delivery risk incidents and 25% faster status reporting.' }
  }
};

const UseCaseDetail = ({ toolId, allUseCases, onBack, onNavigateToDetail, onNavigateToAllUseCases }) => {
  const [useCase, setUseCase] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [toolId]);

  useEffect(() => {
    if (allUseCases && allUseCases.length > 0) {
      const found = allUseCases.find(uc => uc.id === toolId);
      setUseCase(found || null);
    } else {
      fetch('/api/use-cases')
        .then(res => res.json())
        .then(data => {
          const found = data.find(uc => uc.id === toolId);
          setUseCase(found || null);
        })
        .catch(err => console.error('Error:', err));
    }
  }, [toolId, allUseCases]);

  if (!useCase) {
    return (
      <div className="ucd-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: '#6b7280', fontSize: 14 }}>Loading use case...</p>
      </div>
    );
  }

  const enrichment = ENRICHMENT[useCase.id] || ENRICHMENT['kpmg-agenda-creator'];
  const authenticDetails = toolDetails[useCase.id] || {};
  const overviewText = useCase.overview || authenticDetails.overview || useCase.description || enrichment.overview;
  const capabilitiesList = useCase.keyCapabilities || authenticDetails.capabilities || enrichment.benefits;

  const excelBc = EXCEL_BREADCRUMBS[useCase.id];
  const domainLabels = excelBc ? [excelBc.domainLabel] : (useCase.domain || []).map(d => DOMAIN_LABELS[d] || d);
  const domainIds = excelBc ? [excelBc.domainId] : (useCase.domain || []);
  const tagLabels = excelBc ? [excelBc.looLabel] : (useCase.tags && typeof useCase.tags === 'object'
    ? Object.keys(useCase.tags).map(k => LOO_LABELS[k] || k)
    : []);

  const statusLabel = useCase.status === 'Live' ? 'Available' : (useCase.status === 'Beta' || useCase.status === 'Demo' ? 'Pilot' : 'In Development');
  const statusClass = statusLabel === 'Available' ? 'available' : (statusLabel === 'Pilot' ? 'pilot' : 'in-development');
  const confType = enrichment.classification || 'internal';

  // Related use cases (same domain, exclude current)
  const relatedCases = (allUseCases || [])
    .filter(uc => uc.id !== useCase.id && uc.domain && useCase.domain && uc.domain.some(d => useCase.domain.includes(d)))
    .slice(0, 2);

  return (
    <div className="ucd-container">
      {/* ─── Breadcrumb ─── */}
      <div className="ucd-breadcrumb">
        <a
          href={getPageUrl('usecase3')}
          className="ucd-breadcrumb-link"
          onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); onBack && onBack(); } }}
        >
          <AppIcon name="ChevronLeft" size={12} /> Browse
        </a>
        {domainLabels.slice(0, 1).map((dl, i) => (
          <React.Fragment key={dl}>
            <AppIcon name="ChevronRight" size={10} className="ucd-breadcrumb-sep" />
            <a
              href={getPageUrl('allusecases', { domain: domainIds[i] })}
              className="ucd-breadcrumb-link"
              onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); onNavigateToAllUseCases && onNavigateToAllUseCases(domainIds[i]); } }}
            >
              {dl}
            </a>
          </React.Fragment>
        ))}
        {tagLabels.slice(0, 2).map(tl => (
          <React.Fragment key={tl}>
            <AppIcon name="ChevronRight" size={10} className="ucd-breadcrumb-sep" />
            <a
              href={getPageUrl('allusecases', { domain: domainIds[0] })}
              className="ucd-breadcrumb-link"
              onClick={(e) => { if (isPlainLeftClick(e)) { e.preventDefault(); onNavigateToAllUseCases && onNavigateToAllUseCases(domainIds[0]); } }}
            >
              {tl}
            </a>
          </React.Fragment>
        ))}
      </div>

      {/* ─── Top Header ─── */}
      <div className="ucd-top-header">
        {/* Title row */}
        <div className="ucd-title-row">
          <div className="ucd-title-left">
            <h1 className="ucd-title">{useCase.title}</h1>
            <p className="ucd-subtitle">{useCase.description}</p>
          </div>

          {useCase.launchUrl && (
            <a href={useCase.launchUrl} target="_blank" rel="noopener noreferrer" className="ucd-launch-btn">
              Launch Application <AppIcon name="ExternalLink" size={14} />
            </a>
          )}
        </div>
      </div>

      {/* ─── Body: 2 columns ─── */}
      <div className="ucd-body">
        {/* Left Column */}
        <div className="ucd-left">
          {/* Overview */}
          <div className="ucd-overview-card">
            <h2 className="ucd-overview-title">Overview</h2>
            <p className="ucd-overview-text">{overviewText}</p>
          </div>

          {/* Value Realisation */}
          <div className="ucd-value-card">
            <div className="ucd-value-header">
              <div className="ucd-value-icon"><AppIcon name="TrendingUp" size={18} /></div>
              <div className="ucd-value-label">Value Realisation</div>
            </div>
            <p className="ucd-value-text">{enrichment.valueAmount}</p>
            <div className="ucd-value-stats">
              <div>
                <div className="ucd-value-stat-num">{enrichment.activeUsers}</div>
                <div className="ucd-value-stat-label">Active Users</div>
              </div>
              <div>
                <div className="ucd-value-stat-num">{enrichment.geos}</div>
                <div className="ucd-value-stat-label">Geographies</div>
              </div>
            </div>
          </div>

          {/* Key Capabilities */}
          <div className="ucd-benefits-card">
            <h2 className="ucd-benefits-title">Key Capabilities</h2>
            <ul className="ucd-benefits-list">
              {capabilitiesList.map((b, i) => (
                <li key={i} className="ucd-benefit-item">
                  <span className="ucd-benefit-icon">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Watch Demo */}
          {useCase.tutorialUrl ? (
            <a href={useCase.tutorialUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <div className="ucd-demo-card">
                <div className="ucd-demo-play"><div className="ucd-demo-play-icon"></div></div>
                <div className="ucd-demo-title">Watch Demo</div>
                <div className="ucd-demo-subtitle">A short walkthrough of {useCase.title} in action</div>
              </div>
            </a>
          ) : (
            <div className="ucd-demo-card">
              <div className="ucd-demo-play"><div className="ucd-demo-play-icon"></div></div>
              <div className="ucd-demo-title">Watch Demo</div>
              <div className="ucd-demo-subtitle">A short walkthrough of {useCase.title} in action</div>
            </div>
          )}

          {/* User Testimonials — white bordered card with inner nested card */}
          <div className="ucd-testimonials-card">
            <h2 className="ucd-section-heading">
              <AppIcon name="MessageSquareText" size={18} /> User Testimonials
            </h2>
            <div className="ucd-testimonial-inner">
              <div className="ucd-stars">
                {'★★★★★'.split('').map((s, i) => <span key={i} className="ucd-star">{s}</span>)}
              </div>
              <p className="ucd-testimonial-quote">"{enrichment.testimonial.quote}"</p>
              <div className="ucd-testimonial-author">{enrichment.testimonial.author}</div>
              <div className="ucd-testimonial-role">{enrichment.testimonial.role}</div>
            </div>
          </div>

          {/* Success Stories — white bordered card with inner content */}
          <div className="ucd-success-card">
            <h2 className="ucd-section-heading">
              <AppIcon name="Award" size={18} /> Success Stories
            </h2>
            <div className="ucd-success-inner">
              <h4 className="ucd-success-item-title"><span className="ucd-success-dot"></span> {enrichment.successStory.title}</h4>
              <p className="ucd-success-item-text">{enrichment.successStory.text}</p>
            </div>
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="ucd-sidebar">
          {/* Ownership */}
          <div className="ucd-sidebar-card">
            <div className="ucd-sidebar-section-title">Ownership</div>

            <div className="ucd-sidebar-label">Business Sponsor</div>
            <div className="ucd-sidebar-value">{enrichment.sponsor}</div>

            <div className="ucd-sidebar-label">Product Owner</div>
            <div className="ucd-sidebar-value">{enrichment.owner}</div>

            <button className="ucd-contact-btn"><AppIcon name="Mail" size={14} /> Contact Owner</button>
          </div>

          {/* Governance */}
          <div className="ucd-sidebar-card">
            <div className="ucd-sidebar-section-title">Governance</div>

            <div className="ucd-sidebar-label">Data Classification</div>
            <div className={`ucd-gov-badge ${confType}`}>
              <span className="dot"></span> {confType === 'confidential' ? 'Confidential' : 'Internal'}
            </div>

            <div className="ucd-sidebar-label">Licensing</div>
            <div className="ucd-sidebar-value">{enrichment.licensing}</div>

            <div className="ucd-sidebar-label">Geographies</div>
            <div className="ucd-geo-pills">
              {enrichment.geographies.map(g => (
                <span key={g} className="ucd-geo-pill">{g}</span>
              ))}
            </div>

            <div className="ucd-sidebar-label">Support Model</div>
            <div className="ucd-sidebar-value">{enrichment.support}</div>

            <div className="ucd-sidebar-label">Training</div>
            <div className="ucd-sidebar-value">{enrichment.training}</div>

            <div className="ucd-sidebar-label">FAQ</div>
            <div className="ucd-sidebar-value">{enrichment.faqs} FAQs available</div>
          </div>

          {/* Release Notes */}
          <div className="ucd-sidebar-card">
            <div className="ucd-sidebar-section-title">Release Notes</div>
            <div className="ucd-release-text">{enrichment.releaseNotes}</div>
          </div>

          {/* Related Use Cases */}
          {relatedCases.length > 0 && (
            <div className="ucd-sidebar-card">
              <div className="ucd-sidebar-section-title">Related Use Cases</div>
              {relatedCases.map(rc => (
                <a
                  key={rc.id}
                  href={getPageUrl('usecasedetail', { id: rc.id })}
                  className="ucd-related-item"
                  onClick={(e) => {
                    if (isPlainLeftClick(e)) {
                      e.preventDefault();
                      onNavigateToDetail && onNavigateToDetail(rc.id);
                    }
                  }}
                  style={{ display: 'flex', cursor: 'pointer' }}
                >
                  <div>
                    <div className="ucd-related-title">{rc.title}</div>
                    <div className="ucd-related-sub">{DOMAIN_LABELS[rc.domain?.[0]] || rc.domainLabel}</div>
                  </div>
                  <AppIcon name="ArrowRight" size={14} className="ucd-related-arrow" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UseCaseDetail;
