const useCases = [
  {
    id: "proscreener",
    title: "Proscreener",
    domain: ["horizontal", "hr", "cv-screener", "infrastructure-governance-healthcare", "healthcare"],
    subLob: "HR & Talent, Healthcare, Cross-Industry",
    technologies: ["agent-ai", "ml"],
    capabilities: ["document-analysis", "classification"],
    description: "Streamlines the hiring process by identifying top talent through intelligent CV screening and automated candidate ranking.",
    domainLabel: "Horizontal / HR & Talent",
    status: "Live", statusClass: "s-live", color: "#4178D9", icon: "UserSearch",
    image: "/img_proscreener.jpg",
    output: ["PDF", "DOCX"], tools: ["Azure OpenAI", "Doc Intelligence"],
    launchUrl: "https://proscreener-h2fjfthwd7g3hmez.eastus-01.azurewebsites.net/",
    tags: {
      "corporate-services": ["Human Capital", "People and Org", "HR Strategy and Transformation"],
    },
  },
  
  {
    id: "natural-language-data-querying",
    title: "Reimagine AI Analyst",
    domain: ["horizontal", "text-to-sql", "banking-finance", "financial-services", "banking", "cap-market", "insurance", "technology", "tmt", "healthcare", "infrastructure-governance-healthcare"],
    subLob: "Banking, Capital Markets, Insurance, Healthcare, TMT, Data & Analytics",
    technologies: ["agent-ai", "ml"],
    capabilities: ["qa-systems", "document-analysis"],
    description: "AI-powered senior data analyst that investigates investment data, tests hypotheses, cites every number, and generates client-ready reports in seconds.",
    domainLabel: "Horizontal / Data & Analytics",
    status: "Live", statusClass: "s-live", color: "#00A3A1", icon: "Database",
    image: "/sql_image.png",
    output: ["SQL Query", "Results"], tools: ["Azure SQL", "OpenAI"],
    launchUrl: "https://ue-kgs-aianalyst-f4fjgne2fmf0d7eb.eastus-01.azurewebsites.net/",
    tags: {
      "customer-service-ops": ["FS Operations", "Customer Engagement and Experience Design"],
      "technology-solutions": ["AI and Data Strategy", "Data Management and Analytics", "Tech and Data Engineering"],
    },
  },

  // {
  //   id: "bank-complaint-automation",
  //   title: "Bank Complaint Automation",
  //   domain: ["banking-finance", "financial-services", "banking", "insurance"],
  //   subLob: "Banking, Insurance, Financial Services",
  //   technologies: ["agent-ai", "rag", "ml"],
  //   capabilities: ["text-summarization", "classification", "qa-systems"],
  //   description: "AI-powered complaints management that streamlines and automates the end-to-end complaints handling process for financial institutions.",
  //   domainLabel: "Financial Services / Operations",
  //   status: "Live", statusClass: "s-live", color: "#6D2077", icon: "ClipboardList",
  //   image: "/img_bank_complaint.jpg",
  //   output: ["Case Report", "Resolution"], tools: ["Azure OpenAI", "AI Search"],
  //   launchUrl: "https://ue-kgs-bankcomplaintautomation01-gpekbgb2behycacg.eastus-01.azurewebsites.net/",
  //   tags: {
  //     "customer-service-ops": ["Customer", "FS Operations", "Banking", "Insurance", "Service Optimization"],
  //     "risk-services": ["FS Regulatory and Compliance", "Consumer Compliance/Safety and Soundness", "Ethics, Regulatory and Quality", "Investigations and Disputes"],
  //   },
  // },

  // {
  //   id: "archi-made-easy",
  //   title: "Archi-Made-Easy",
  //   domain: ["technology", "tmt", "tmt-sub", "prod", "products", "horizontal"],
  //   subLob: "Technology, Media & Telecommunications (TMT), Consumer & Retail, Industrial Manufacturing",
  //   technologies: ["agent-ai", "dl"],
  //   capabilities: ["document-analysis", "classification"],
  //   description: "A buddy to every technology architect that analyzes, compares and deciphers complex architectural diagrams using generative AI vision models.",
  //   domainLabel: "Technology / Products / Horizontal",
  //   status: "Demo", statusClass: "s-demo", color: "#470A68", icon: "LayoutTemplate",
  //   image: "/arch_img.webp",
  //   // launchUrl: "#",
  //   tutorialUrl: "https://godevarchimadeeasy.blob.core.windows.net/archimadecontainer/KPMG%20Architecture%20Assistant.mp4",
  //   tags: {
  //     "technology-solutions": ["Tech and Data Strategy", "Tech and Data Integration", "IT Strategy", "Engineering (AI/Cloud/App/Data/Infra)"],
  //   },
  // },

  {
    id: "resume-creator",
    title: "Resume Creator",
    domain: ["horizontal", "hr", "infrastructure-governance-healthcare", "healthcare"],
    subLob: "HR & Talent, Healthcare, Cross-Industry",
    technologies: ["agent-ai", "ml"],
    capabilities: ["content-generation", "document-analysis"],
    description: "Generates polished KPMG Profile Slides from raw CV data, standardized, KPMG-branded, and ready for client proposals.",
    domainLabel: "Horizontal / HR & Talent",
    status: "Live", statusClass: "s-live", color: "#4178D9", icon: "FileText",
    image: "/img_res_creator.avif",
    output: ["PPTX", "DOCX"], tools: ["Doc Intelligence", "OpenAI"],
    launchUrl: "https://ue-kgs-resumecreationformatting01-ekd0dgbscag7etbj.eastus-01.azurewebsites.net/",
    tags: {
      "corporate-services": ["Human Capital", "People and Org", "HR Strategy and Transformation"],
    },
  },

  // {
  //   id: "tom-asset-comparisons",
  //   title: "Tom Asset Comparisons",
  //   domain: ["banking-finance", "financial-services", "banking", "cap-market", "insurance", "technology", "tmt"],
  //   subLob: "Banking, Capital Markets, Insurance, TMT",
  //   technologies: ["agent-ai", "rag"],
  //   capabilities: ["classification", "text-summarization"],
  //   description: "Security controls and role-based process flow comparison for Target Operating Model assessments across asset classes.",
  //   domainLabel: "Financial Services / Technology",
  //   status: "Beta", statusClass: "s-beta", color: "#6D2077", icon: "Scale",
  //   image: "/img_tom.jpg",
  //   output: ["Comparison", "XLSX"], tools: ["AI Search", "Blob Storage"],
  //   launchUrl: "https://tomassestcomparisons-hyc4g6h9g5c4b9hf.eastus2-01.azurewebsites.net/",
  //   tags: {
  //     "risk-services": ["FS Regulatory and Compliance", "Cyber and Tech Risk", "Enterprise and Third Party Risk Management", "Strategy and GRC"],
  //     "technology-solutions": ["Tech and Data Strategy", "Tech Asset Management"],
  //   },
  // },

  // {
  //   id: "financial-outlook-generator",
  //   title: "Financial Outlook Generator",
  //   domain: ["banking-finance", "financial-services", "banking", "cap-market", "insurance", "am", "am-pe", "am-pe-sub"],
  //   subLob: "Banking, Capital Markets, Insurance, Asset Management / Private Equity (AM/PE)",
  //   technologies: ["agent-ai", "ml", "rag"],
  //   capabilities: ["content-generation", "text-summarization", "document-analysis"],
  //   description: "Creates comprehensive financial and market outlook reports with AI-generated insights, trend analysis, and strategic recommendations.",
  //   domainLabel: "Financial Services / AM/PE",
  //   status: "Live", statusClass: "s-live", color: "#269924", icon: "TrendingUp",
  //   image: "/financial_img.webp",
  //   output: ["PDF", "DOCX", "PPTX"], tools: ["Azure OpenAI", "Excel Parser"],
  //   launchUrl: "https://fingenoutlookv2-cjcfefh2hqftajb0.eastus-01.azurewebsites.net/",
  //   tags: {
  //     "customer-service-ops": ["FS Operations", "Capital Markets", "Banking"],
  //     "corporate-services": ["Finance and EPM", "Finance Strategy and Transformation", "Enterprise Performance Mgt (EPM)"],
  //   },
  // },

  // {
  //   id: "power-bi-publication-scoreboard",
  //   title: "Power BI Publication Scoreboard",
  //   domain: ["horizontal", "banking-finance", "financial-services", "healthcare", "infrastructure-governance-healthcare", "technology", "tmt"],
  //   subLob: "Banking, Healthcare, TMT, Enterprise Analytics",
  //   technologies: ["ml"],
  //   capabilities: ["classification", "text-summarization"],
  //   description: "Tracks and visualizes content performance metrics for internal Power BI publications and marketing communications.",
  //   domainLabel: "Horizontal / Data & Analytics",
  //   status: "Live", statusClass: "s-live", color: "#F1C44D", icon: "BarChart2",
  //   image: "/power_bi_img.jpg",
  //   output: ["Dashboard", "XLSX"], tools: ["Power BI", "Azure SQL"],
  //   launchUrl: "https://app.powerbi.com/singleSignOn?ctid=deff24bb-2089-4400-8c8e-f71e680378b2&experience=power-bi%2F&ru=https%3A%2F%2Fapp.powerbi.com%2Fgroups%2Fme%2Fapps%2F1b849312-ad8b-433f-9949-419f6984fad1%2Freports%2Fc74c941d-d9e1-4112-978d-27bbab512682%2Fa0685d35ed509545cf49%3Fctid%3Ddeff24bb-2089-4400-8c8e-f71e680378b2%26experience%3Dpower-bi%252F%26noSignUpCheck%3D1",
  //   tags: {
  //     "customer-service-ops": ["Customer Engagement and Experience Design", "Marketing Enablement"],
  //     "corporate-services": ["Finance and EPM", "Enterprise Performance Mgt (EPM)"],
  //     "technology-solutions": ["AI and Data Strategy", "Data Management and Analytics"],
  //   },
  // },

  {
    id: "augmented-insights-discovery",
    title: "Augmented Insights and Discovery Engine",
    domain: ["am", "am-pe", "am-pe-sub", "banking-finance", "financial-services", "cap-market"],
    subLob: "Asset Management / Private Equity (AM/PE), Capital Markets",
    technologies: ["agent-ai", "ml", "rag"],
    capabilities: ["document-analysis", "classification", "qa-systems"],
    description: "AI solution that transforms Unstructured Financial advisor biographies and integrates it with structured sales and assets dataset.",
    domainLabel: "AM/PE / Financial Services",
    status: "Live", statusClass: "s-live", color: "#4178D9", icon: "Search",
    image: "/augmented_insights.png",
    output: ["Insights", "Reports"], tools: ["HybridGraph4AI", "Azure OpenAI"],
    launchUrl: "https://ue-kgs-aidegraphragfrontend01-bghuh5h6ezhecaby.eastus-01.azurewebsites.net/",
    tags: {
      "customer-service-ops": ["FS Operations", "Capital Markets", "Customer Engagement and Experience Design", "Sales Acceleration"],
      "technology-solutions": ["AI and Data Strategy", "Data Management and Analytics", "Tech and Data Engineering"],
    },
  },

  {
    id: "kpmg-agenda-creator",
    title: "KPMG Agenda Creator",
    domain: ["banking-finance", "financial-services", "banking", "cap-market", "insurance", "am", "am-pe", "am-pe-sub", "horizontal"],
    subLob: "Banking, Capital Markets, Insurance, Asset Management / Private Equity (AM/PE), Cross-Industry",
    technologies: ["agent-ai"],
    capabilities: ["content-generation", "document-analysis"],
    description: "A standalone AI tool that helps Sales Managers build personalised meeting agendas.",
    domainLabel: "Financial Services / AM/PE / Horizontal",
    status: "Live", statusClass: "s-live", color: "#00A3A1", icon: "CalendarCheck",
    image: "/agenda_creator.png",
    output: ["Agenda", "DOCX"], tools: ["Azure OpenAI"],
    launchUrl: "https://ue-kgs-agendacreatorwebapp01-cze6c0fbg9dgb2f3.eastus-01.azurewebsites.net/",
    tags: {
      "customer-service-ops": ["Customer", "Sales Acceleration", "Customer Engagement and Experience Design", "Marketing Enablement"],
      "corporate-services": ["Sourcing and GCC"],
    },
  },

  {
    id: "advisor-intelligence",
    title: "Advisor Intelligence",
    domain: ["banking-finance", "financial-services", "banking", "cap-market", "am", "am-pe", "am-pe-sub"],
    subLob: "Banking, Capital Markets, Asset Management / Private Equity (AM/PE)",
    technologies: ["agent-ai", "ml"],
    capabilities: ["content-generation", "qa-systems"],
    description: "Advisor Intelligence automates agenda generation for advisor fund meetings by analyzing fund details and meeting context.",
    domainLabel: "Financial Services / AM/PE",
    status: "Live", statusClass: "s-live", color: "#6D2077", icon: "Users",
    image: "/advisor_intelligence.png",
    output: ["Meeting Agenda", "Analysis"], tools: ["Azure OpenAI", "AI Search"],
    launchUrl: "https://ue2-kgs-advisorintelligence01-bbawgzatg5dqc3cj.eastus2-01.azurewebsites.net/",
    tags: {
      "customer-service-ops": ["FS Operations", "Capital Markets", "Banking", "Customer Engagement and Experience Design"],
      "corporate-services": ["Finance and EPM", "Finance Strategy and Transformation"],
    },
  },

  {
    id: "synthdataforge",
    title: "SynthDataForge",
    domain: ["horizontal", "data-generation", "technology", "tmt", "banking-finance", "financial-services", "prod", "products"],
    subLob: "Technology, Media & Telecommunications (TMT), Banking, Consumer & Retail, Life Sciences",
    technologies: ["ml", "dl"],
    capabilities: ["content-generation"],
    description: "The Synthetic Data Generator creates realistic high-quality dummy datasets for machine learning development.",
    domainLabel: "Horizontal / Technology / Products",
    status: "Live", statusClass: "s-live", color: "#470A68", icon: "TestTube2",
    image: "/synthdataforge.png",
    output: ["CSV", "JSON", "SQL"], tools: ["Python", "Faker", "SDV"],
    launchUrl: "https://ue-kgs-synthdataforge-g5d0a9fyhwepgyec.eastus-01.azurewebsites.net/",
    tags: {
      "technology-solutions": ["AI and Data Strategy", "Data Management and Analytics", "Tech and Data Engineering", "Quality Engineering"],
    },
  },

  {
    id: "pro-manager",
    title: "Pro-Manager",
    domain: ["horizontal", "pmo", "banking-finance", "financial-services", "banking", "insurance", "technology", "tmt", "healthcare", "infrastructure-governance-healthcare", "prod", "products", "consumer-retail", "life-sciences", "industrial-manufacturing", "enrc", "am", "am-pe", "am-pe-sub"],
    subLob: "Banking, Insurance, Healthcare, TMT, Consumer & Retail, ENRC, AM/PE, Enterprise PMO",
    technologies: ["agent-ai"],
    capabilities: ["content-generation", "document-analysis"],
    description: "One-stop project management solution harnessing AI and GenAI to make project activities efficient across the full engagement lifecycle.",
    domainLabel: "Horizontal / Cross-Industry PMO",
    status: "Live", statusClass: "s-live", color: "#0091DA", icon: "LayoutDashboard",
    image: "/img_promanager.jpeg",
    output: ["Dashboard", "Reports"], tools: ["Azure OpenAI", "SQL"],
    launchUrl: "https://promanager-kdc-ame0gabpbvhggmcj.eastus-01.azurewebsites.net/",
    tags: {
      "customer-service-ops": ["FS Operations", "Healthcare Operations", "S&L Operations", "Transformation"],
      "corporate-services": ["Finance and EPM", "Human Capital", "Sourcing and GCC", "Enterprise Performance Mgt (EPM)"],
      "technology-solutions": ["Tech and Data Strategy", "IT Strategy"],
    },
  },

  {
    id: "qualiverse-ai",
    title: "QualiVerse AI",
    domain: ["horizontal", "pmo", "workforce-productivity", "banking-finance", "financial-services"],
    subLob: "Cross-Industry, AI Governance & Portfolio Management",
    technologies: ["agent-ai"],
    capabilities: ["classification", "document-analysis"],
    description: "Enterprise AI-initiatives directory and dashboard that lists and tracks internal AI projects across lifecycle stages (Concept \u2192 Dev \u2192 Live), with tagging, filtering, and a split-screen viewer for each project's architecture diagrams, video demos, and docs.",
    domainLabel: "Horizontal / AI Governance & PMO",
    status: "Live", statusClass: "s-live", color: "#6D2077", icon: "LayoutGrid",
    image: "/qualiverse-ai.png",
    output: ["Project Directory", "Dashboard"], tools: ["React", "Node.js"],
    launchUrl: "https://qualiverse-m3nwxpgwpa-uc.a.run.app/",
    tags: {
      "technology-solutions": ["AI and Data Strategy", "Tech and Data Engineering", "IT Strategy"],
      "corporate-services": ["Enterprise Performance Mgt (EPM)"],
    },
  }
];

// Admin-only monitoring metadata merged from genaiplaygtest2.
// Business/use-case catalog fields above remain from the current GENAIPLAYG code.
const adminMonitoringMetadata = {
  "proscreener": {
    "owner": "Nagappa, Nagappa",
    "ownerEmail": "nagappa.nagappa@kpmg.co.uk"
  },
  "natural-language-data-querying": {
    "owner": "M S, Rahul",
    "ownerEmail": "rahulms@kpmg.com"
  },
  "resume-creator": {
    "owner": "laltupati@kpmg.com",
    "ownerEmail": "laltupati@kpmg.com",
    "azureResourceGroup": "go-rg-m-dev-inc-kgs-oai22",
    "azureResources": [
      {
        "role": "frontend",
        "name": "ue-kgs-resumecreationformatting01"
      },
      {
        "role": "backend",
        "name": "ue-kgs-resumecreationformattingbackend01"
      },
      {
        "role": "openai",
        "name": "OAI-resumeformatting-dev"
      }
    ]
    ,
    "requiredAppSettingGroups": [
      {
        "name": "Azure OpenAI API key",
        "roles": ["backend"],
        "matchMode": "exact",
        "patterns": [
          "AZURE_OPENAI_API_KEY"
        ]
      }
    ],
    "allowRuntimeRecoveryWhenProbeBlocked": true,
    "allowTelemetryRecoveryWhenProbeBlocked": true,
    "recoveryRuntimeRoles": ["frontend", "backend"]
  },
  "augmented-insights-discovery": {
    "owner": "M S, Rahul",
    "ownerEmail": "rahulms@kpmg.com"
  },
  "kpmg-agenda-creator": {
    "owner": "Mohapatra, Pritam",
    "ownerEmail": "pritammohapatra@kpmg.com",
    "azureResourceGroup": "go-rg-m-dev-inc-kgs-oai25",
    "azureResources": [
      {
        "role": "openai",
        "name": "oai-agendacreator-dev"
      }
    ]
  },
  "advisor-intelligence": {
    "owner": "Mohapatra, Pritam",
    "ownerEmail": "pritammohapatra@kpmg.com",
    // Public probes may be blocked by App Service access restrictions.
    // Recovery is allowed after consecutive successful Log Analytics cycles
    // show no fresh Neo4j failure. ARM runtime evidence is preferred when
    // available; telemetry recovery is the fallback when the public probe is
    // blocked by App Service access restrictions.
    "allowRuntimeRecoveryWhenProbeBlocked": true,
    "allowTelemetryRecoveryWhenProbeBlocked": true,
    "recoveryRuntimeRoles": ["frontend"],
    "azureResourceGroup": "go-rg-m-dev-inc-kgs-oai18",
    "azureResources": [
      {
        "role": "frontend",
        "name": "ue2-kgs-advisorintelligence01"
      }
    ]
  },
  "synthdataforge": {
    "owner": "Mohapatra, Pritam",
    "ownerEmail": "pritammohapatra@kpmg.com"
  },
  "pro-manager": {
    "owner": "Nagappa, Nagappa",
    "ownerEmail": "nagappa.nagappa@kpmg.co.uk"
  }
};
useCases.forEach((useCase) => {
  if (adminMonitoringMetadata[useCase.id]) Object.assign(useCase, adminMonitoringMetadata[useCase.id]);
});

// Centralized ownership policy: every catalog application routes owner alerts
// and displays the same accountable owner. Keep this after metadata merging so
// legacy per-application values cannot override the requested owner.
const DEFAULT_APPLICATION_OWNER = 'laltupati@kpmg.com';
useCases.forEach((useCase) => {
  useCase.owner = DEFAULT_APPLICATION_OWNER;
  useCase.ownerEmail = DEFAULT_APPLICATION_OWNER;
});

const systemHealth = [
  { id: 1, title: "Operational", label: "System Status", subText: "All systems normal", icon: "✅", colorClass: "hc-green", subClass: "sub-green" },
  { id: 2, title: "13 / 13", label: "Active Solutions", subText: "All solutions active", icon: "🤖", colorClass: "hc-blue", subClass: "sub-blue" },
  { id: 3, title: "1", label: "Failed Agents", subText: "Archi-Made-Easy", icon: "⚠", colorClass: "hc-red", subClass: "sub-red" },
  { id: 4, title: "1.8s", label: "Avg Response Time", subText: "+0.3s vs yesterday", icon: "⏱", colorClass: "hc-amber", subClass: "sub-amber" }
];

const monitoringData = [
  { id: 1, solution: "Proscreener", status: "Running", statusClass: "tb-run", health: 92, requests: "1,245", success: "98.5%", healthColor: "g" },
  { id: 2, solution: "NL Data Query", status: "Running", statusClass: "tb-run", health: 95, requests: "892", success: "94.2%", healthColor: "g" },
  { id: 3, solution: "Bank Complaints", status: "Failed", statusClass: "tb-fail", health: 15, requests: "456", success: "15.8%", healthColor: "r" },
  { id: 4, solution: "Financial Outlook", status: "Running", statusClass: "tb-run", health: 91, requests: "678", success: "91.3%", healthColor: "g" },
  { id: 5, solution: "NL Query Agent", status: "Warning", statusClass: "tb-warn", health: 68, requests: "523", success: "72.4%", healthColor: "a" },
  // { id: 6, solution: "Archi-Made-Easy", status: "Stopped", statusClass: "tb-stop", health: 0, requests: "0", success: "N/A", healthColor: "" }
];

const executionStats = {
  totalCount: 13,
  passCount: 27,
  activeNow: 4,
  totalRequestsToday: "3,794"
};

const toolDetailsData = require('./toolDetailsData');
useCases.forEach(uc => {
  const details = toolDetailsData[uc.id];
  if (details) {
    uc.overview = details.overview;
    uc.keyCapabilities = details.capabilities;
  }
});

module.exports = {
  useCases,
  systemHealth,
  monitoringData,
  executionStats
};