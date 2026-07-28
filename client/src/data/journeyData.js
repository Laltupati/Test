// // ═══════════════════════════════════════════════════════════════════
// //  BUSINESS JOURNEY DATA — Industry → Process Areas → Scenarios
// // ═══════════════════════════════════════════════════════════════════

// export const industries = [
//   {
//     id: 'financial-services',
//     label: 'Financial Services',
//     sublabel: 'Banking, Cap Markets, Insurance, AM/PE',
//     icon: '🏦',
//     accent: 'blue',
//     color: '#003087',
//   },
//   {
//     id: 'consumer-retail',
//     label: 'C&R',
//     sublabel: 'Consumer & Retail',
//     icon: '🛍',
//     accent: 'teal',
//     color: '#00A3A1',
//   },
//   {
//     id: 'life-sciences',
//     label: 'Life Sciences',
//     sublabel: 'Pharma, Biotech & MedTech',
//     icon: '🧬',
//     accent: 'lblue',
//     color: '#0091DA',
//   },
//   {
//     id: 'industrial-manufacturing',
//     label: 'Industrial Manufacturing',
//     sublabel: 'Industrial & Manufacturing',
//     icon: '🏭',
//     accent: 'violet',
//     color: '#470A68',
//   },
//   {
//     id: 'enrc',
//     label: 'ENRC',
//     sublabel: 'Energy, Natural Resources & Chemicals',
//     icon: '⚡',
//     accent: 'purple',
//     color: '#6D2077',
//   },
//   {
//     id: 'tmt',
//     label: 'TMT',
//     sublabel: 'Technology, Media & Telecommunications',
//     icon: '📡',
//     accent: 'blue',
//     color: '#0051BA',
//   },
//   {
//     id: 'healthcare',
//     label: 'Healthcare',
//     sublabel: 'Payers, Providers & Health Systems',
//     icon: '🏥',
//     accent: 'teal',
//     color: '#00A3A1',
//   },
//   {
//     id: 'sled',
//     label: 'SLED',
//     sublabel: 'State, Local & Education',
//     icon: '🏛',
//     accent: 'lblue',
//     color: '#005EB8',
//   },
//   {
//     id: 'federal',
//     label: 'Federal',
//     sublabel: 'Federal Government',
//     icon: '🇮🇳',
//     accent: 'blue',
//     color: '#003087',
//   },
//   {
//     id: 'infrastructure-gov',
//     label: 'Infrastructure, Gov & Healthcare',
//     sublabel: 'Infrastructure & Public Sector',
//     icon: '🏗',
//     accent: 'purple',
//     color: '#483698',
//   },
// ];

// // Process Areas — common across industries
// export const processAreas = [
//   {
//     id: 'customer-service-ops',
//     label: 'Customer Service & Operations',
//     icon: '🤝',
//     description: 'Automate and enhance front-line customer interactions and back-office operations.',
//   },
//   {
//     id: 'corporate-services',
//     label: 'Corporate Services',
//     icon: '🏢',
//     description: 'Streamline internal operations including HR, Finance, and legal workflows.',
//   },
//   {
//     id: 'risk-services',
//     label: 'Risk Services',
//     icon: '🛡',
//     description: 'Identify, monitor, and mitigate risk across regulatory and compliance landscapes.',
//   },
//   {
//     id: 'technology-solutions',
//     label: 'Technology Solutions',
//     icon: '⚙',
//     description: 'Accelerate technology delivery, architecture, and developer productivity.',
//   },
// ];

// // Scenarios per Industry × Process Area
// // Each scenario can reference solution IDs from data.js
// export const scenarios = {
//   'financial-services': {
//     'customer-service-ops': [
//       {
//         id: 'complaint-resolution',
//         label: 'Complaint Resolution',
//         description: 'Automate end-to-end handling of customer complaints and escalations.',
//         role: 'Customer Service Agent',
//         solutions: ['bank-complaint-automation', 'pro-manager'],
//       },
//       {
//         id: 'query-resolution',
//         label: 'Query Resolution',
//         description: 'Answer complex client queries using natural language interfaces on enterprise data.',
//         role: 'Operations Analyst',
//         solutions: ['natural-language-data-querying'],
//       },
//       {
//         id: 'reporting-insights',
//         label: 'Reporting & Insights',
//         description: 'Generate performance dashboards and client-ready reports with AI assistance.',
//         role: 'Relationship Manager',
//         solutions: ['power-bi-publication-scoreboard', 'financial-outlook-generator'],
//       },
//     ],
//     'corporate-services': [
//       {
//         id: 'talent-acquisition',
//         label: 'Talent Acquisition',
//         description: 'Screen and rank candidates at scale using AI-powered resume analysis.',
//         role: 'HR Business Partner',
//         solutions: ['proscreener', 'resume-creator'],
//       },
//       {
//         id: 'financial-reporting',
//         label: 'Financial Reporting',
//         description: 'Generate comprehensive market outlook and financial reports.',
//         role: 'Finance Analyst',
//         solutions: ['financial-outlook-generator', 'power-bi-publication-scoreboard'],
//       },
//       {
//         id: 'project-management',
//         label: 'Project Management',
//         description: 'Manage the full engagement lifecycle with AI-powered project tools.',
//         role: 'Engagement Manager',
//         solutions: ['pro-manager'],
//       },
//     ],
//     'risk-services': [
//       {
//         id: 'operational-risk',
//         label: 'Operational Risk Assessment',
//         description: 'Compare security controls and assess operational risk across asset classes.',
//         role: 'Risk Analyst',
//         solutions: ['tom-asset-comparisons'],
//       },
//       {
//         id: 'compliance-monitoring',
//         label: 'Compliance Monitoring',
//         description: 'Automate classification and tracking of regulatory complaints and events.',
//         role: 'Compliance Officer',
//         solutions: ['bank-complaint-automation'],
//       },
//     ],
//     'technology-solutions': [
//       {
//         id: 'architecture-analysis',
//         label: 'Architecture Analysis',
//         description: 'Decipher and compare complex architectural diagrams with AI vision models.',
//         role: 'Technology Architect',
//         solutions: ['archi-made-easy'],
//       },
//       {
//         id: 'query-automation',
//         label: 'Data Query Automation',
//         description: 'Convert plain English questions into SQL queries for enterprise data analysis.',
//         role: 'Data Analyst',
//         solutions: ['natural-language-data-querying', 'utility-studio'],
//       },
//       {
//         id: 'qa-automation',
//         label: 'QA & Test Automation',
//         description: 'Generate structured test cases from requirements to accelerate software delivery.',
//         role: 'QA Engineer',
//         solutions: ['test-case-generator'],
//       },
//     ],
//   },
//   'healthcare': {
//     'customer-service-ops': [
//       {
//         id: 'patient-query',
//         label: 'Patient Query Resolution',
//         description: 'Answer patient queries quickly using NL interfaces on healthcare data.',
//         role: 'Patient Services Agent',
//         solutions: ['natural-language-data-querying'],
//       },
//       {
//         id: 'ops-management',
//         label: 'Operations Management',
//         description: 'Coordinate and manage healthcare operations across the engagement lifecycle.',
//         role: 'Operations Manager',
//         solutions: ['pro-manager'],
//       },
//     ],
//     'corporate-services': [
//       {
//         id: 'hr-screening',
//         label: 'HR & Talent Screening',
//         description: 'Streamline clinical and admin staff hiring with AI-powered candidate ranking.',
//         role: 'HR Manager',
//         solutions: ['proscreener', 'resume-creator'],
//       },
//       {
//         id: 'performance-reporting',
//         label: 'Performance Reporting',
//         description: 'Track and visualize key performance metrics across healthcare publications.',
//         role: 'Analytics Lead',
//         solutions: ['power-bi-publication-scoreboard'],
//       },
//     ],
//     'risk-services': [
//       {
//         id: 'compliance-tracking',
//         label: 'Compliance & Risk Tracking',
//         description: 'Monitor and classify regulatory risks using AI-driven complaint management.',
//         role: 'Risk & Compliance Officer',
//         solutions: ['bank-complaint-automation', 'tom-asset-comparisons'],
//       },
//     ],
//     'technology-solutions': [
//       {
//         id: 'system-architecture',
//         label: 'System Architecture Review',
//         description: 'Analyze and compare healthcare system architectural designs.',
//         role: 'Solutions Architect',
//         solutions: ['archi-made-easy'],
//       },
//       {
//         id: 'data-querying',
//         label: 'Clinical Data Querying',
//         description: 'Query clinical and operational data using plain English.',
//         role: 'Data Analyst',
//         solutions: ['natural-language-data-querying'],
//       },
//     ],
//   },
//   'tmt': {
//     'customer-service-ops': [
//       {
//         id: 'support-ops',
//         label: 'Support Operations',
//         description: 'Automate customer support query resolution and complaint handling.',
//         role: 'Support Operations Lead',
//         solutions: ['bank-complaint-automation', 'natural-language-data-querying'],
//       },
//       {
//         id: 'content-reporting',
//         label: 'Content Performance Reporting',
//         description: 'Track and visualize content performance metrics across media platforms.',
//         role: 'Media Analyst',
//         solutions: ['power-bi-publication-scoreboard'],
//       },
//     ],
//     'corporate-services': [
//       {
//         id: 'hr-ops',
//         label: 'HR Operations',
//         description: 'Automate talent acquisition and employee profile management.',
//         role: 'Talent Acquisition Manager',
//         solutions: ['proscreener', 'resume-creator'],
//       },
//       {
//         id: 'project-delivery',
//         label: 'Project Delivery',
//         description: 'Manage technology projects across agile and waterfall delivery models.',
//         role: 'Programme Manager',
//         solutions: ['pro-manager'],
//       },
//     ],
//     'risk-services': [
//       {
//         id: 'tom-assessment',
//         label: 'TOM Assessment',
//         description: 'Compare Target Operating Models for technology transformation programmes.',
//         role: 'Risk Consultant',
//         solutions: ['tom-asset-comparisons'],
//       },
//     ],
//     'technology-solutions': [
//       {
//         id: 'arch-review',
//         label: 'Architecture Review',
//         description: 'Analyze and decipher complex technology architecture diagrams.',
//         role: 'Enterprise Architect',
//         solutions: ['archi-made-easy'],
//       },
//       {
//         id: 'test-generation',
//         label: 'Test Case Generation',
//         description: 'Automatically generate test cases from requirements to speed up delivery.',
//         role: 'QA Lead',
//         solutions: ['test-case-generator'],
//       },
//       {
//         id: 'prompt-engineering',
//         label: 'Prompt Engineering',
//         description: 'Build, test, and benchmark AI prompts for technology applications.',
//         role: 'AI Engineer',
//         solutions: ['utility-studio'],
//       },
//     ],
//   },
//   // Default fallback for all other industries
//   'default': {
//     'customer-service-ops': [
//       {
//         id: 'query-resolution',
//         label: 'Query Resolution',
//         description: 'Answer complex operational queries using natural language interfaces.',
//         role: 'Operations Analyst',
//         solutions: ['natural-language-data-querying'],
//       },
//       {
//         id: 'ops-reporting',
//         label: 'Operational Reporting',
//         description: 'Generate and track performance dashboards with AI-driven insights.',
//         role: 'Reporting Analyst',
//         solutions: ['power-bi-publication-scoreboard', 'financial-outlook-generator'],
//       },
//     ],
//     'corporate-services': [
//       {
//         id: 'talent-acquisition',
//         label: 'Talent Acquisition',
//         description: 'Screen and rank candidates at scale with AI-powered resume analysis.',
//         role: 'HR Manager',
//         solutions: ['proscreener', 'resume-creator'],
//       },
//       {
//         id: 'project-management',
//         label: 'Project Management',
//         description: 'Manage engagements across the full project lifecycle with AI assistance.',
//         role: 'Engagement Manager',
//         solutions: ['pro-manager'],
//       },
//     ],
//     'risk-services': [
//       {
//         id: 'risk-assessment',
//         label: 'Risk Assessment',
//         description: 'Compare and assess risk controls across operating model frameworks.',
//         role: 'Risk Consultant',
//         solutions: ['tom-asset-comparisons', 'bank-complaint-automation'],
//       },
//     ],
//     'technology-solutions': [
//       {
//         id: 'architecture-analysis',
//         label: 'Architecture Analysis',
//         description: 'Decipher and compare complex architectural diagrams with AI.',
//         role: 'Solutions Architect',
//         solutions: ['archi-made-easy'],
//       },
//       {
//         id: 'data-query',
//         label: 'Data Query Automation',
//         description: 'Convert plain English questions into SQL queries for data exploration.',
//         role: 'Data Analyst',
//         solutions: ['natural-language-data-querying'],
//       },
//     ],
//   },
// };

// // Reference implementations (showcased at the bottom of Phase 3)
// export const implementations = [
//   {
//     id: 'capital-group',
//     client: 'Capital Group',
//     sector: 'Asset Management',
//     icon: '📈',
//     description: 'AI-powered portfolio analysis and financial reporting automation deployed for Capital Group\'s investment management operations.',
//     tags: ['Financial Outlook Generator', 'NL Data Querying'],
//     accent: '#003087',
//   },
//   {
//     id: 'vanguard',
//     client: 'Vanguard',
//     sector: 'Asset Management',
//     icon: '🏦',
//     description: 'Intelligent client servicing and complaint management solution implemented across Vanguard\'s retail and institutional channels.',
//     tags: ['Bank Complaint Automation', 'Pro-Manager'],
//     accent: '#00A3A1',
//   },
//   {
//     id: 'scb',
//     client: 'Standard Chartered Bank',
//     sector: 'Banking',
//     icon: '🌐',
//     description: 'End-to-end AI-assisted compliance and TOM assessment suite rolled out for Standard Chartered\'s risk and operations divisions.',
//     tags: ['TOM Asset Comparisons', 'Bank Complaint Automation'],
//     accent: '#0051BA',
//   },
// ];

// ═══════════════════════════════════════════════════════════════════
//  BUSINESS JOURNEY DATA — Industry → Sub Industries → Process Areas → Scenarios
// ═══════════════════════════════════════════════════════════════════

export const industries = [
  {
    id: 'financial-services',
    label: 'Financial Services',
    sublabel: 'Banking, Cap Market, Insurance',
    icon: 'Landmark',
    accent: 'blue',
    color: '#003087',
    children: [
      {
        id: 'banking',
        label: 'Banking',
        sublabel: 'Banking',
        description: 'Retail, commercial and corporate banking — from customer onboarding and loan origination to complaint resolution and regulatory compliance.',
        icon: 'Landmark',
        accent: 'blue',
        color: '#003087',
      },
      {
        id: 'cap-market',
        label: 'Cap Market',
        sublabel: 'Capital Markets',
        description: 'Investment banking, trading and securities operations — covering deal origination, research automation, trade surveillance and post-trade processing.',
        icon: 'TrendingUp',
        accent: 'blue',
        color: '#003087',
      },
      {
        id: 'insurance',
        label: 'Insurance',
        sublabel: 'Insurance',
        description: 'Property, casualty and life insurance — streamlining underwriting, claims adjudication, fraud detection and policy servicing with AI.',
        icon: 'ShieldCheck',
        accent: 'blue',
        color: '#003087',
      },
    ],
  },
  {
    id: 'am-pe',
    label: 'AM/PE',
    sublabel: 'Asset Management / Private Equity',
    icon: 'Briefcase',
    accent: 'blue',
    color: '#003087',
    children: [
      {
        id: 'am-pe-sub',
        label: 'AM/PE',
        sublabel: 'Asset Management / Private Equity',
        description: 'Asset management and private equity — accelerating fund reporting, portfolio monitoring, investor relations and deal-flow analysis with AI.',
        icon: 'Briefcase',
        accent: 'blue',
        color: '#003087',
      },
    ],
  },
  {
    id: 'products',
    label: 'Products',
    sublabel: 'C and R, Life Science, Ind Mng, ENRC',
    icon: 'ShoppingBag',
    accent: 'blue',
    color: '#003087',
    children: [
      {
        id: 'consumer-retail',
        label: 'C and R',
        sublabel: 'Consumer and Retail',
        description: 'Consumer goods and retail — enhancing demand forecasting, personalised marketing, supply-chain optimisation and customer experience with AI.',
        icon: 'ShoppingBag',
        accent: 'blue',
        color: '#003087',
      },
      {
        id: 'life-sciences',
        label: 'Life Science',
        sublabel: 'Pharma, Biotech and MedTech',
        description: 'Pharmaceuticals, biotech and medical devices — supporting clinical trial analysis, regulatory submissions, pharmacovigilance and R&D acceleration.',
        icon: 'FlaskConical',
        accent: 'blue',
        color: '#003087',
      },
      {
        id: 'industrial-manufacturing',
        label: 'Ind Mng',
        sublabel: 'Industrial Manufacturing',
        description: 'Industrial and discrete manufacturing — driving predictive maintenance, quality control, production planning and smart factory operations.',
        icon: 'Factory',
        accent: 'blue',
        color: '#003087',
      },
      {
        id: 'enrc',
        label: 'ENRC',
        sublabel: 'Energy, Natural Resources and Chemicals',
        description: 'Energy, natural resources and chemicals — enabling asset optimisation, ESG reporting, exploration analytics and safety compliance with AI.',
        icon: 'Zap',
        accent: 'blue',
        color: '#003087',
      },
    ],
  },
  {
    id: 'tmt',
    label: 'TMT',
    sublabel: 'Technology, Media and Telecommunications',
    icon: 'Radio',
    accent: 'blue',
    color: '#003087',
    children: [
      {
        id: 'tmt-sub',
        label: 'TMT',
        sublabel: 'Technology, Media and Telecommunications',
        description: 'Technology, media and telecoms — transforming product development, content operations, network management and customer care with AI.',
        icon: 'Radio',
        accent: 'blue',
        color: '#003087',
      },
    ],
  },
  {
    id: 'infrastructure-governance-healthcare',
    label: 'Infrastructure, Governance and Healthcare',
    sublabel: 'Healthcare, SLED, Federal',
    icon: 'HardHat',
    accent: 'blue',
    color: '#003087',
    children: [
      {
        id: 'healthcare',
        label: 'Healthcare',
        sublabel: 'Payers, Providers and Health Systems',
        description: 'Healthcare payers, providers and health systems — improving clinical documentation, prior authorisation, patient engagement and care coordination.',
        icon: 'HeartPulse',
        accent: 'blue',
        color: '#003087',
      },
      {
        id: 'sled',
        label: 'SLED',
        sublabel: 'State, Local and Education',
        description: 'State, local government and education — modernising citizen services, grant management, permitting workflows and learning outcomes with AI.',
        icon: 'Building2',
        accent: 'blue',
        color: '#003087',
      },
      {
        id: 'federal',
        label: 'Federal',
        sublabel: 'Federal Government',
        description: 'Federal agencies and defence — enhancing mission operations, document intelligence, procurement automation and regulatory reporting.',
        icon: 'Flag',
        accent: 'blue',
        color: '#003087',
      },
    ],
  },
  {
    id: 'horizontal',
    label: 'Horizontal',
    sublabel: 'Cross-cutting AI tools for all industries',
    icon: 'GitMerge',
    accent: 'blue',
    color: '#003087',
    description: 'Cross-cutting AI tools applicable across all lines of business — from talent acquisition and project management to data generation and SQL automation.',
    // No children: clicking goes directly to Phase 2
  },
];


// Process Areas — common across industries
export const processAreas = [
  {
    id: 'customer-service-ops',
    label: 'Customer Service and Operations',
    icon: 'Headphones',
    description: 'Automate and enhance front-line customer interactions and back-office operations.',
  },
  {
    id: 'corporate-services',
    label: 'Corporate Services',
    icon: 'Briefcase',
    description: 'Streamline internal operations including HR, Finance, and legal workflows.',
  },
  {
    id: 'risk-services',
    label: 'Risk Services',
    icon: 'ShieldCheck',
    description: 'Identify, monitor, and mitigate risk across regulatory and compliance landscapes.',
  },
  {
    id: 'technology-solutions',
    label: 'Technology Solutions',
    icon: 'Settings',
    description: 'Accelerate technology delivery, architecture, and developer productivity.',
  },
];

// Horizontal-specific process areas (replaces standard 4 for the Horizontal LOB)
export const horizontalProcessAreas = [
  {
    id: 'cv-screener',
    label: 'CV Screener',
    icon: 'UserSearch',
    description: 'Identify top talent through intelligent CV screening and automated candidate ranking.',
  },
  {
    id: 'text-to-sql',
    label: 'Text to SQL Generator',
    icon: 'Database',
    description: 'Convert plain English questions into optimised SQL queries against enterprise data.',
  },
  {
    id: 'resume-creator',
    label: 'Resume Creator',
    icon: 'FileText',
    description: 'Generate polished KPMG Profile Slides from raw CV data, ready for client proposals.',
  },
  {
    id: 'data-generation',
    label: 'Data Generation',
    icon: 'TestTube2',
    description: 'Create realistic high-quality synthetic datasets for machine learning and testing.',
  },
];

// Center node for Horizontal (PMO — shown in the center circle)
export const horizontalCenterArea = {
  id: 'pmo',
  label: 'PMO',
  icon: 'LayoutDashboard',
  description: 'AI-powered project management across the full engagement lifecycle.',
};

// ═══════════════════════════════════════════════════════════════════
//  Scenario Templates
// ═══════════════════════════════════════════════════════════════════

// ── Financial Services (Banking, Cap Markets, Insurance) ──
const financialServicesScenarios = {
  'corporate-services': [
    {
      id: 'fin-outlook',
      label: 'Financial Reporting',
      description: 'Generate comprehensive market outlook and financial reports with AI-driven insights.',
      role: 'Finance Analyst',
      solutions: ['financial-outlook-generator'],
    },
    {
      id: 'agenda-creation',
      label: 'Meeting Agenda Creation',
      description: 'Build personalised meeting agendas for client and advisor engagements.',
      role: 'Sales Manager',
      solutions: ['kpmg-agenda-creator'],
    },
    {
      id: 'advisor-intel',
      label: 'Advisor Intelligence',
      description: 'Automate agenda generation for advisor fund meetings by analysing fund details and context.',
      role: 'Relationship Manager',
      solutions: ['advisor-intelligence'],
    },
  ],
  'customer-service-ops': [
    {
      id: 'complaint-resolution',
      label: 'Complaint Resolution',
      description: 'Automate end-to-end handling of customer complaints and escalations.',
      role: 'Customer Service Agent',
      solutions: ['bank-complaint-automation'],
    },
  ],
  'risk-services': [],
  'technology-solutions': [],
};

// ── Asset Management / Private Equity ──
const amPeScenarios = {
  'corporate-services': [
    {
      id: 'ampe-fin-outlook',
      label: 'Financial Reporting',
      description: 'Generate comprehensive market outlook and financial reports for portfolio monitoring.',
      role: 'Finance Analyst',
      solutions: ['financial-outlook-generator'],
    },
    {
      id: 'ampe-augmented',
      label: 'Augmented Insights and Discovery',
      description: 'Transform unstructured financial data and integrate with structured datasets for AI-driven discovery.',
      role: 'Investment Analyst',
      solutions: ['augmented-insights-discovery'],
    },
  ],
  'customer-service-ops': [],
  'risk-services': [],
  'technology-solutions': [],
};

// ── Horizontal (cross-cutting tools) ──
const horizontalScenarios = {
  'cv-screener': [
    {
      id: 'cv-screening-scenario',
      label: 'CV Screening',
      description: 'Streamline hiring by identifying top talent through intelligent CV screening and automated candidate ranking.',
      role: 'HR Manager',
      solutions: ['proscreener'],
    },
  ],
  'text-to-sql': [
    {
      id: 'text-to-sql-scenario',
      label: 'Text to SQL Generation',
      description: 'Convert plain English questions into optimised SQL queries against enterprise data warehouses.',
      role: 'Data Analyst',
      solutions: ['natural-language-data-querying'],
    },
  ],
  'resume-creator': [
    {
      id: 'resume-creation-scenario',
      label: 'Resume Creation',
      description: 'Generate polished KPMG Profile Slides from raw CV data, standardised and ready for client proposals.',
      role: 'HR Business Partner',
      solutions: ['resume-creator'],
    },
  ],
  'data-generation': [
    {
      id: 'data-generation-scenario',
      label: 'Synthetic Data Generation',
      description: 'Create realistic high-quality synthetic datasets for machine learning development and testing.',
      role: 'Data Engineer',
      solutions: ['synthdataforge'],
    },
  ],
  'pmo': [
    {
      id: 'pmo-scenario',
      label: 'Project Management (PMO)',
      description: 'One-stop AI-powered project management solution across the full engagement lifecycle.',
      role: 'Engagement Manager',
      solutions: ['pro-manager'],
    },
  ],
};

// ── Coming Soon (empty — for Products, TMT, Infrastructure) ──
const comingSoonScenarios = {
  'corporate-services': [],
  'customer-service-ops': [],
  'risk-services': [],
  'technology-solutions': [],
};

// ── Healthcare ──
const healthcareScenarios = {
  'customer-service-ops': [
    {
      id: 'patient-query',
      label: 'Patient Query Resolution',
      description: 'Answer patient queries quickly using NL interfaces on healthcare data.',
      role: 'Patient Services Agent',
      solutions: ['natural-language-data-querying'],
    },
    {
      id: 'ops-management',
      label: 'Operations Management',
      description: 'Coordinate and manage healthcare operations across the engagement lifecycle.',
      role: 'Operations Manager',
      solutions: ['pro-manager'],
    },
  ],
  'corporate-services': [
    {
      id: 'hr-screening',
      label: 'HR and Talent Screening',
      description: 'Streamline clinical and admin staff hiring with AI-powered candidate ranking.',
      role: 'HR Manager',
      solutions: ['proscreener', 'resume-creator'],
    },
  ],
  'risk-services': [],
  'technology-solutions': [],
};

// ── TMT ──
const tmtScenarios = {
  'customer-service-ops': [],
  'corporate-services': [],
  'risk-services': [],
  'technology-solutions': [],
};

// Scenarios per Industry / Sub Industry × Process Area
export const scenarios = {
  // Top-level LOBs
  'financial-services': financialServicesScenarios,
  'am-pe':              amPeScenarios,
  'products':           comingSoonScenarios,
  'tmt':                tmtScenarios,
  'infrastructure-governance-healthcare': comingSoonScenarios,
  'horizontal':         horizontalScenarios,

  // Financial Services Sub-LOBs
  'banking':            financialServicesScenarios,
  'cap-market':         financialServicesScenarios,
  'insurance':          financialServicesScenarios,

  // AM/PE Sub-LOB
  'am-pe-sub':          amPeScenarios,

  // Products Sub-LOBs (Coming Soon)
  'consumer-retail':         comingSoonScenarios,
  'life-sciences':           comingSoonScenarios,
  'industrial-manufacturing': comingSoonScenarios,
  'enrc':                    comingSoonScenarios,

  // TMT Sub-LOB (Coming Soon)
  'tmt-sub':            tmtScenarios,

  // Infrastructure Sub-LOBs
  'healthcare':         healthcareScenarios,
  'sled':               comingSoonScenarios,
  'federal':            comingSoonScenarios,

  // Default fallback
  default: comingSoonScenarios,
};