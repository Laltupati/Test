const useCases = [
  {
    id: "proscreener",
    title: "Proscreener",
    domain: ["hr"],
    technologies: ["agent-ai", "ml"],
    capabilities: ["document-analysis", "classification"],
    description: "Streamlines the hiring process by identifying top talent through intelligent CV screening and automated candidate ranking.",
    domainLabel: "HR and Talent",
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
    title: "Natural Language Data Querying",
    domain: ["banking-finance", "technology"],
    technologies: ["agent-ai", "ml"],
    capabilities: ["qa-systems", "document-analysis"],
    description: "SQL Query Assistant converts plain English questions into optimized SQL queries against your enterprise data warehouse.",
    domainLabel: "Data and Analytics",
    status: "Live", statusClass: "s-live", color: "#00A3A1", icon: "Database",
    image: "/sql_image.png",
    output: ["SQL Query", "Results"], tools: ["Azure SQL", "OpenAI"],
    launchUrl: "https://qgpt2-hufsced8fwc7gdcx.eastus-01.azurewebsites.net/",
    tags: {
      "customer-service-ops": ["FS Operations", "Customer Engagement and Experience Design"],
      "technology-solutions": ["AI and Data Strategy", "Data Management and Analytics", "Tech and Data Engineering"],
    },
  },

  {
    id: "bank-complaint-automation",
    title: "Bank Complaint Automation",
    domain: ["banking-finance", "insurance"],
    technologies: ["agent-ai", "rag", "ml"],
    capabilities: ["text-summarization", "classification", "qa-systems"],
    description: "AI-powered complaints management that streamlines and automates the end-to-end complaints handling process for financial institutions.",
    domainLabel: "Operations",
    status: "Live", statusClass: "s-live", color: "#6D2077", icon: "ClipboardList",
    image: "/img_bank_complaint.jpg",
    output: ["Case Report", "Resolution"], tools: ["Azure OpenAI", "AI Search"],
    launchUrl: "https://ue-kgs-bankcomplaintautomation01-gpekbgb2behycacg.eastus-01.azurewebsites.net/",
    tags: {
      "customer-service-ops": ["Customer", "FS Operations", "Banking", "Insurance", "Service Optimization"],
      "risk-services": ["FS Regulatory and Compliance", "Consumer Compliance/Safety and Soundness", "Ethics, Regulatory and Quality", "Investigations and Disputes"],
    },
  },

  {
    id: "archi-made-easy",
    title: "Archi-Made-Easy",
    domain: ["technology"],
    technologies: ["agent-ai", "dl"],
    capabilities: ["document-analysis", "classification"],
    description: "A buddy to every technology architect that analyzes, compares and deciphers complex architectural diagrams using generative AI vision models.",
    domainLabel: "Technology",
    status: "Demo", statusClass: "s-demo", color: "#470A68", icon: "LayoutTemplate",
    image: "/arch_img.webp",
    // launchUrl: "#",
    tutorialUrl: "https://godevarchimadeeasy.blob.core.windows.net/archimadecontainer/KPMG%20Architecture%20Assistant.mp4",
    tags: {
      "technology-solutions": ["Tech and Data Strategy", "Tech and Data Integration", "IT Strategy", "Engineering (AI/Cloud/App/Data/Infra)"],
    },
  },

  {
    id: "resume-creator",
    title: "Resume Creator",
    domain: ["hr"],
    technologies: ["agent-ai", "ml"],
    capabilities: ["content-generation", "document-analysis"],
    description: "Generates polished KPMG Profile Slides from raw CV data, standardized, KPMG-branded, and ready for client proposals.",
    domainLabel: "HR and Talent",
    status: "Live", statusClass: "s-live", color: "#4178D9", icon: "FileText",
    image: "/img_res_creator.avif",
    output: ["PPTX", "DOCX"], tools: ["Doc Intelligence", "OpenAI"],
    launchUrl: "https://ue-kgs-resumecreationformatting01-ekd0dgbscag7etbj.eastus-01.azurewebsites.net/",
    tags: {
      "corporate-services": ["Human Capital", "People and Org", "HR Strategy and Transformation"],
    },
  },

  {
    id: "tom-asset-comparisons",
    title: "TOM Asset Comparisons",
    domain: ["banking-finance", "insurance", "technology"],
    technologies: ["agent-ai", "rag"],
    capabilities: ["classification", "text-summarization"],
    description: "Security controls and role-based process flow comparison for Target Operating Model assessments across asset classes.",
    domainLabel: "Technology",
    status: "Beta", statusClass: "s-beta", color: "#6D2077", icon: "Scale",
    image: "/img_tom.jpg",
    output: ["Comparison", "XLSX"], tools: ["AI Search", "Blob Storage"],
    launchUrl: "https://tomassestcomparisons-hyc4g6h9g5c4b9hf.eastus2-01.azurewebsites.net/",
    tags: {
      "risk-services": ["FS Regulatory and Compliance", "Cyber and Tech Risk", "Enterprise and Third Party Risk Management", "Strategy and GRC"],
      "technology-solutions": ["Tech and Data Strategy", "Tech Asset Management"],
    },
  },

  {
    id: "financial-outlook-generator",
    title: "Financial Outlook Generator",
    domain: ["banking-finance"],
    technologies: ["agent-ai", "ml", "rag"],
    capabilities: ["content-generation", "text-summarization", "document-analysis"],
    description: "Creates comprehensive financial and market outlook reports with AI-generated insights, trend analysis, and strategic recommendations.",
    domainLabel: "Finance",
    status: "Live", statusClass: "s-live", color: "#269924", icon: "TrendingUp",
    image: "/financial_img.webp",
    output: ["PDF", "DOCX", "PPTX"], tools: ["Azure OpenAI", "Excel Parser"],
    launchUrl: "https://fingenoutlookv2-cjcfefh2hqftajb0.eastus-01.azurewebsites.net/",
    tags: {
      "customer-service-ops": ["FS Operations", "Capital Markets", "Banking"],
      "corporate-services": ["Finance and EPM", "Finance Strategy and Transformation", "Enterprise Performance Mgt (EPM)"],
    },
  },

  {
    id: "power-bi-publication-scoreboard",
    title: "Power BI Publication Scoreboard",
    domain: ["banking-finance", "healthcare", "technology"],
    technologies: ["ml"],
    capabilities: ["classification", "text-summarization"],
    description: "Tracks and visualizes content performance metrics for internal Power BI publications and marketing communications.",
    domainLabel: "Data and Analytics",
    status: "Live", statusClass: "s-live", color: "#F1C44D", icon: "BarChart2",
    image: "/power_bi_img.jpg",
    output: ["Dashboard", "XLSX"], tools: ["Power BI", "Azure SQL"],
    launchUrl: "https://app.powerbi.com/singleSignOn?ctid=deff24bb-2089-4400-8c8e-f71e680378b2&experience=power-bi%2F&ru=https%3A%2F%2Fapp.powerbi.com%2Fgroups%2Fme%2Fapps%2F1b849312-ad8b-433f-9949-419f6984fad1%2Freports%2Fc74c941d-d9e1-4112-978d-27bbab512682%2Fa0685d35ed509545cf49%3Fctid%3Ddeff24bb-2089-4400-8c8e-f71e680378b2%26experience%3Dpower-bi%252F%26noSignUpCheck%3D1",
    tags: {
      "customer-service-ops": ["Customer Engagement and Experience Design", "Marketing Enablement"],
      "corporate-services": ["Finance and EPM", "Enterprise Performance Mgt (EPM)"],
      "technology-solutions": ["AI and Data Strategy", "Data Management and Analytics"],
    },
  },

  {
    id: "augmented-insights-discovery",
    title: "Augmented Insights and Discovery Engine",
    domain: ["banking-finance"],
    technologies: ["agent-ai", "ml", "rag"],
    capabilities: ["document-analysis", "classification", "qa-systems"],
    description: "A core HybridGraph4AI solution that transforms Unstructured Financial advisor biographies and integrates it with structured sales and assets dataset.",
    domainLabel: "Finance",
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
    domain: ["banking-finance", "technology"],
    technologies: ["agent-ai"],
    capabilities: ["content-generation", "document-analysis"],
    description: "A standalone AI tool that helps Sales Managers build personalised meeting agendas.",
    domainLabel: "Operations",
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
    domain: ["banking-finance"],
    technologies: ["agent-ai", "ml"],
    capabilities: ["content-generation", "qa-systems"],
    description: "Advisor Intelligence automates agenda generation for advisor fund meetings by analyzing fund details and meeting context.",
    domainLabel: "Finance",
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
    domain: ["technology", "banking-finance"],
    technologies: ["ml", "dl"],
    capabilities: ["content-generation"],
    description: "The Synthetic Data Generator creates realistic high-quality dummy datasets for machine learning development.",
    domainLabel: "Technology",
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
    domain: ["banking-finance", "technology", "healthcare", "insurance", "hr"],
    technologies: ["agent-ai"],
    capabilities: ["content-generation", "document-analysis"],
    description: "One-stop project management solution harnessing AI and GenAI to make project activities efficient across the full engagement lifecycle.",
    domainLabel: "Operations",
    status: "Live", statusClass: "s-live", color: "#0091DA", icon: "LayoutDashboard",
    image: "/img_promanager.jpeg",
    output: ["Dashboard", "Reports"], tools: ["Azure OpenAI", "SQL"],
    launchUrl: "https://promanager-kdc-ame0gabpbvhggmcj.eastus-01.azurewebsites.net/",
    tags: {
      "customer-service-ops": ["FS Operations", "Healthcare Operations", "S&L Operations", "Transformation"],
      "corporate-services": ["Finance and EPM", "Human Capital", "Sourcing and GCC", "Enterprise Performance Mgt (EPM)"],
      "technology-solutions": ["Tech and Data Strategy", "IT Strategy"],
    },
  }
];

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
  { id: 6, solution: "Archi-Made-Easy", status: "Stopped", statusClass: "tb-stop", health: 0, requests: "0", success: "N/A", healthColor: "" }
];

const executionStats = {
  totalCount: 13,
  passCount: 27,
  activeNow: 4,
  totalRequestsToday: "3,794"
};

module.exports = {
  useCases,
  systemHealth,
  monitoringData,
  executionStats
};