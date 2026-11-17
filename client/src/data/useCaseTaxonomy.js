export const BUSINESS_AREAS = [
  {
    id: 'banking-finance',
    label: 'Financial Services',
    desc: 'Banking, capital markets, insurance, risk/compliance and FS partners',
    icon: 'Landmark',
    matchIds: ['banking-finance', 'financial-services', 'banking', 'cap-market', 'insurance', 'risk-compliance', 'fs-partners']
  },
  {
    id: 'am',
    label: 'Asset Management / Private Equity',
    desc: 'Fund management, deal analytics and portfolio AI',
    icon: 'Briefcase',
    matchIds: ['am', 'am-pe', 'am-pe-sub']
  },
  {
    id: 'prod',
    label: 'Products',
    desc: 'Consumer, retail, life sciences and manufacturing',
    icon: 'ShoppingBag',
    matchIds: ['prod', 'products', 'consumer-retail', 'life-sciences', 'industrial-manufacturing', 'enrc']
  },
  {
    id: 'healthcare',
    label: 'Infrastructure, Governance & Healthcare',
    desc: 'Healthcare, public sector and infrastructure',
    icon: 'HeartPulse',
    matchIds: ['healthcare', 'infrastructure-governance-healthcare', 'sled', 'federal']
  },
  {
    id: 'technology',
    label: 'Technology, Media & Telecommunications',
    desc: 'All the TMT and digital services sectors',
    icon: 'Radio',
    matchIds: ['technology', 'tmt', 'tmt-sub']
  },
  {
    id: 'horizontal',
    label: 'Horizontal',
    desc: 'Reusable AI capabilities across every industry',
    icon: 'GitMerge',
    matchIds: ['horizontal', 'hr', 'pmo', 'cv-screener', 'text-to-sql', 'data-generation']
  }
];

export const DOMAIN_TABS = [
  { id: 'all', label: 'All', matchIds: ['all'] },
  ...BUSINESS_AREAS
];

export const CORE_LINE_OFFERINGS = [
  'Corporate Services',
  'Customer & Operations',
  'Risk Services',
  'Technology Solutions'
];

export const CORE_SUB_LOBS_BY_DOMAIN = {
  all: [
    'Banking',
    'Capital Markets',
    'Insurance',
    'Risk/Compliance',
    'FS Partners',
    'Asset Management / Private Equity (AM/PE)',
    'Consumer & Retail',
    'Life Sciences',
    'Industrial Manufacturing',
    'ENRC',
    'Healthcare',
    'SLED',
    'Federal',
    'Technology, Media & Telecommunications (TMT)'
  ],
  'banking-finance': ['Banking', 'Capital Markets', 'Insurance', 'Risk/Compliance', 'FS Partners'],
  'am': ['Asset Management / Private Equity (AM/PE)'],
  'prod': ['Consumer & Retail', 'Life Sciences', 'Industrial Manufacturing', 'ENRC'],
  'healthcare': ['Healthcare', 'SLED', 'Federal'],
  'technology': ['Technology, Media & Telecommunications (TMT)'],
  'horizontal': []
};

export const USE_CASE_TAXONOMY = {
  lobs: {
    'banking-finance': [
      'natural-language-data-querying',
      'bank-complaint-automation',
      'tom-asset-comparisons',
      // 'financial-outlook-generator',
      'power-bi-publication-scoreboard',
      'augmented-insights-discovery',
      'kpmg-agenda-creator',
      'advisor-intelligence',
      'synthdataforge',
      'pro-manager',
      'qualiverse-ai'
    ],
    'am': [
      // 'financial-outlook-generator',
      'natural-language-data-querying',
      'augmented-insights-discovery',
      'kpmg-agenda-creator',
      'advisor-intelligence',
      'pro-manager'
    ],
    'prod': ['synthdataforge', 'pro-manager'],
    'healthcare': [
      'proscreener',
      // 'natural-language-data-querying',
      'resume-creator',
      'power-bi-publication-scoreboard',
      'pro-manager'
    ],
    'technology': [
      // 'natural-language-data-querying',
      // 'archi-made-easy',
      'tom-asset-comparisons',
      'power-bi-publication-scoreboard',
      'synthdataforge',
      'pro-manager'
    ],
    'horizontal': [
      'proscreener',
      'natural-language-data-querying',
      // 'archi-made-easy',
      'resume-creator',
      'power-bi-publication-scoreboard',
      'kpmg-agenda-creator',
      'synthdataforge',
      'pro-manager',
      'qualiverse-ai'
    ]
  },
  looTags: {
    // 'archi-made-easy': ['Technology Solutions'],
    //'tom-asset-comparisons': ['Risk Services', 'Technology Solutions'],
    // 'financial-outlook-generator': ['Corporate Services'],
    //'power-bi-publication-scoreboard': ['Customer & Operations', 'Corporate Services', 'Technology Solutions'],
    'kpmg-agenda-creator': ['AI Agenda Assistant'],
    'advisor-intelligence': ['Advisor Research Assistant'],
    //'bank-complaint-automation': ['Customer & Operations'],
    'augmented-insights-discovery': ['Insight Discovery Engine'],
    'proscreener': ['CV Screener'],
    'natural-language-data-querying': ['Conversational Data Analytics'],
    'resume-creator': ['Profile Generator'],
    'synthdataforge': ['Synthetic Data Generation'],
    'pro-manager': ['Program Management Office'],
    'qualiverse-ai': ['AI Governance & Portfolio Tracking']
  },
  subLobs: {
    // 'archi-made-easy': ['Technology, Media & Telecommunications (TMT)', 'Consumer & Retail', 'Industrial Manufacturing'],
    //'tom-asset-comparisons': ['Banking', 'Capital Markets', 'Insurance', 'Risk/Compliance', 'FS Partners', 'Technology, Media & Telecommunications (TMT)'],
    // 'financial-outlook-generator': ['Banking', 'Capital Markets', 'Insurance', 'FS Partners', 'Asset Management / Private Equity (AM/PE)'],
    //'power-bi-publication-scoreboard': ['Banking', 'Risk/Compliance', 'FS Partners', 'Healthcare', 'Technology, Media & Telecommunications (TMT)'],
    'kpmg-agenda-creator': ['Banking', 'Capital Markets', 'Insurance', 'FS Partners'],
    'advisor-intelligence': ['Banking', 'Capital Markets', 'Insurance', 'FS Partners', 'Asset Management / Private Equity (AM/PE)'],
    //'bank-complaint-automation': ['Banking', 'Capital Markets', 'Insurance', 'Risk/Compliance', 'FS Partners'],
    'augmented-insights-discovery': ['Asset Management / Private Equity (AM/PE)'],
    'proscreener': ['Healthcare'],
    'natural-language-data-querying': ['Asset Management / Private Equity (AM/PE)', 'Capital Markets', 'Insurance', 'Risk/Compliance', 'FS Partners', 'Healthcare', 'Technology, Media & Telecommunications (TMT)'],
    'resume-creator': ['Healthcare'],
    'synthdataforge': ['Banking', 'Consumer & Retail', 'Life Sciences', 'Technology, Media & Telecommunications (TMT)'],
    'pro-manager': ['Banking', 'Insurance', 'Risk/Compliance', 'FS Partners', 'Healthcare', 'Technology, Media & Telecommunications (TMT)', 'Consumer & Retail', 'ENRC', 'Asset Management / Private Equity (AM/PE)'],
    'qualiverse-ai': ['Banking', 'Risk/Compliance', 'FS Partners']
  }
};

export const getTaxonomyUseCaseIds = () => Object.keys(USE_CASE_TAXONOMY.looTags);

export const getAllowedUseCaseIdsForDomain = (domainId) => {
  if (domainId === 'all') {
    return getTaxonomyUseCaseIds();
  }
  return USE_CASE_TAXONOMY.lobs[domainId] || [];
};

export const getLineOfOfferingOptions = (domainId = 'all') => {
  const unique = new Set();
  if (domainId === 'all') {
    CORE_LINE_OFFERINGS.forEach((line) => unique.add(line));
  }
  if (domainId !== 'all' && domainId !== 'horizontal') {
    CORE_LINE_OFFERINGS.forEach((line) => unique.add(line));
  }
  getAllowedUseCaseIdsForDomain(domainId).forEach((useCaseId) => {
    (USE_CASE_TAXONOMY.looTags[useCaseId] || []).forEach((tag) => unique.add(tag));
  });
  return Array.from(unique);
};

export const getSubLobOptions = (domainId = 'all') => {
  const unique = new Set();
  const baseline = CORE_SUB_LOBS_BY_DOMAIN[domainId] || [];
  baseline.forEach((subLob) => unique.add(subLob));
  getAllowedUseCaseIdsForDomain(domainId).forEach((useCaseId) => {
    (USE_CASE_TAXONOMY.subLobs[useCaseId] || []).forEach((subLob) => unique.add(subLob));
  });
  return Array.from(unique);
};
