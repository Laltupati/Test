/* ═══════════════════════════════════════════════════════════════════
   CONFIGURATION & CONSTANTS
   Centralized configuration for filters, labels, and app settings
   ═══════════════════════════════════════════════════════════════════ */

// Filter group labels and mappings
const FILTER_CONFIG = {
  domain: {
    label: 'Domain',
    values: ['Finance', 'HR', 'Supply Chain', 'Risk', 'Audit', 'Data & Analytics']
  },
  tech: {
    label: 'Technology',
    values: ['Cloud', 'AI/ML', 'RPA', 'Data', 'Integration', 'Legacy']
  },
  capability: {
    label: 'Capability',
    values: ['Process Automation', 'Data Processing', 'Analytics', 'Integration', 'Security']
  }
};

// Label mappings for display (user-friendly names)
const LABEL_MAP = {
  'domain-finance': 'Finance',
  'domain-hr': 'HR',
  'domain-supply': 'Supply Chain',
  'domain-risk': 'Risk Management',
  'domain-audit': 'Audit',
  'domain-data': 'Data & Analytics',
  
  'tech-cloud': 'Cloud',
  'tech-ai': 'AI/ML',
  'tech-rpa': 'RPA',
  'tech-data': 'Data',
  'tech-integration': 'Integration',
  'tech-legacy': 'Legacy Systems',
  
  'cap-process': 'Process Automation',
  'cap-data': 'Data Processing',
  'cap-analytics': 'Analytics',
  'cap-integration': 'Integration',
  'cap-security': 'Security'
};

// Status indicators
const STATUS_CONFIG = {
  live: { color: '#00D4D1', bg: 'rgba(0, 163, 161, 0.2)', label: 'LIVE' },
  beta: { color: '#F1C44D', bg: 'rgba(241, 196, 77, 0.2)', label: 'BETA' },
  demo: { color: '#C084E0', bg: 'rgba(71, 10, 104, 0.25)', label: 'DEMO' },
  soon: { color: '#7A96B8', bg: 'rgba(90, 110, 140, 0.2)', label: 'COMING SOON' }
};

// App settings
const APP_CONFIG = {
  resultsPerPage: 12,
  animationDuration: 250,
  tooltipDelay: 100,
  debounceDelay: 300
};

































window.TOOL_DETAILS = {
  "proscreener": {
    title: "Proscreener",
    overview:
      "Pro Screener is an AI-powered resume screening application designed to streamline and accelerate the hiring process by identifying the most suitable candidates for a given role. Pro Screener allows users to upload a job description file along with multiple candidate resumes, then intelligently compares each resume against the job requirements. The application analyzes candidate profiles based on key hiring criteria such as Experience, Average Score, Big 4 Experience, and Resume-to-Job Description Comparison, helping recruiters and hiring teams quickly shortlist top talent with greater consistency and efficiency.",
    capabilities: [
      "Job Description-Based Screening: Upload a job description document to use as the benchmark for evaluating candidate resumes.",
      "Bulk Resume Upload: Upload and process multiple candidate resumes at once to reduce manual screening effort.",
      "AI-Powered Resume Analysis: Analyze resumes against the job description to identify relevant skills, experience, and overall fit.",
      "Experience Evaluation: Assess candidate experience levels to determine whether applicants meet the role’s required background.",
      "Average Candidate Scoring: Generate an overall score for each candidate based on alignment with the job description and screening criteria.",
      "Big 4 Experience Identification: Detect whether candidates have experience with Big 4 firms for easier filtering and prioritization.",
      "Resume-to-Job Description Comparison: Provide a comparison view showing how closely each resume matches the role requirements."
    ]
  },

  "natural-language-data-querying": {
    title: "Natural Language Data Querying",
    overview:
      "SQL Query Assistant is a natural language-based database querying application designed to help users interact with SQLite databases without manually writing SQL queries. SQL Query Assistant enables users to upload a SQLite database file and ask questions in plain English. The application analyzes the user’s question, generates the appropriate SQL query, executes it against the uploaded database, and returns the results in a user-friendly format. Depending on the user’s request, it can present outputs as tables, charts, or explanations, making database analysis faster, simpler, and more accessible for both technical and non-technical users.",
    capabilities: [
      "Natural Language Querying: Ask database-related questions in plain English without manually writing SQL queries.",
      "Faster Data Analysis: Combine query generation, execution, visualization, and explanation in a single workflow to reduce analysis effort.",
      "Automatic Question Analysis: Interpret user input to identify intent, required fields, filters, calculations, and expected output format.",
      "Query Execution: Generate and run SQL queries against the uploaded database to retrieve relevant results.",
      "Tabular Result Display: Show query outputs in a structured table format for easy review and validation.",
      "Chart Generation: Create charts or graphs when users request visual analysis or trend exploration.",
      "Result Explanation: Provide clear explanations of returned results to help users understand insights and meaning.",
      "Interactive Database Exploration: Support follow-up questions so users can explore the database conversationally, step by step."
    ]
  },

  "bank-complaint-automation": {
    title: "Bank Complaint Automation",
    overview:
      "TD Bank Complaints Management Assistant is an AI-powered complaints management solution designed to streamline and automate the end-to-end customer complaints handling process. The application enables users to capture key complaint metadata such as Bank Name, Date, Customer Name, Communication Channel, State, Product, Associated Product, Business Line, Business Unit, Level 3, and Level 4 classification. Users can enter the customer complaint details in the Customer Verbatim field, after which the assistant analyzes the complaint and supports faster complaint review, classification, routing, and resolution. By combining structured complaint data with AI-driven analysis, the solution helps banking teams manage complaints more consistently, efficiently, and accurately.",
    capabilities: [
      "Complaint Intake Management:Allows users to capture customer complaint information through a structured interface, including customer details, communication channel, product information, and complaint classification fields.",
      "Customer Verbatim Analysis:Enables users to enter the customer’s complaint narrative and uses AI to analyze the content for relevant issues, themes, and complaint context.",
      "Metadata Capture:Records important complaint metadata such as bank name, date, customer name, state, product, associated product, business line, business unit, and complaint category levels.",
      "Product and Service Classification:Supports classification of complaints based on banking products such as checking accounts, savings accounts, payment services, and related sub-products.",
      "Complaint Categorization:Helps organize complaints using hierarchical classification levels such as Level 3 and Level 4, enabling better tracking and reporting of complaint types."
    ]
  },

  "archi-made-easy": {
    title: "Archi-Made-Easy",
    overview:
      "Archi-Made-Easy is an AI-powered architecture analysis assistant designed to support technology architects, consultants, and solution design teams in understanding complex architectural visuals with greater speed and clarity. Archi-Made-Easy uses generative AI models to analyze, compare, and decipher complex architectural images. The application acts as a digital buddy for architects by helping interpret architecture diagrams, identify key components, understand relationships between systems, and simplify technical visuals into meaningful insights. Since the application currently includes a single video, it can be positioned as a focused demonstration or guided walkthrough that showcases how AI can assist in architectural understanding and decision-making.",
    capabilities: [
      "Architecture Image Analysis:Analyzes complex architectural diagrams and helps users understand the systems, components, layers, and relationships represented in the visual.",
      "Generative AI-Powered Interpretation:Uses generative AI models to decipher architecture images and convert complex technical visuals into easier-to-understand explanations.",
      "Architectural Comparison Support:Supports comparison of architectural images or patterns to help users identify similarities, differences, gaps, or design variations.",
      "Diagram Deciphering:Helps break down dense architecture diagrams into simpler explanations by identifying key elements such as applications, services, integrations, infrastructure layers, and data flows.",
      "Consultant and Architect Assistance:Acts as a companion tool for technology architects and consultants by reducing the time required to review and interpret technical architecture visuals.",
      "Simplified Architecture Understanding:Transforms complex architecture content into concise, readable insights, making architectural designs easier to communicate with technical and business stakeholders.",
      "Visual Knowledge Extraction:Extracts meaningful information from architecture images, helping users understand design intent, dependencies, and possible architectural considerations.",
      "Architecture Review Enablement:Assists in reviewing architectural diagrams by highlighting important components and supporting better design discussions.",
      "Single Video-Based Experience:Provides a focused video-based experience or demonstration that showcases the application’s capabilities and guides users through its intended usage.",
      "Faster Decision Support:Helps architecture and consulting teams accelerate analysis, comparison, and understanding of solution designs, supporting faster and more informed decision-making."
    ]
  },

  "pro-manager": {
    title: "Pro-Manager",
    overview:
      "PAM is an AI and GenAI-powered project management solution designed to support project teams across the full engagement lifecycle. It helps automate planning, reporting, financial tracking, agile delivery, meeting support, documentation, and change management activities, making project execution more efficient, intelligent, and data-driven.",
    capabilities: [
      "PAM-Pro: Focuses on project initiation and planning activities to ensure the engagement starts with clear objectives, scope, risks, communication structure, and resource alignment.",
      "PAM-MIS: Provides project monitoring and management reporting capabilities to track project health, progress, risks, issues, timelines, and stakeholder updates.",
      "PAM-Agile: Supports agile project delivery by helping teams manage user stories, scrum reviews, velocity tracking, sprint progress, and backlog prioritization.",
      "PAM-Fin: Enhances financial oversight by analyzing engagement margins, budgets, pricing models, staffing mix, revenue, costs, and profitability.",
      "PAM-Assist: Provides productivity support for meetings, documentation, action tracking, communication analysis, project updates, and feedback management.",
      "PAM-Change Agent: Supports organizational change management by helping teams assess change impacts and create structured transformation narratives."
    ]
  },

  "resume-creator": {
    title: "Resume Creator",
    overview:
      "Profile Generator is an AI-powered document processing tool designed to streamline and standardize the creation of professional profile slides from resumes in PDF, Word, or PowerPoint formats. The tool enables users to automatically extract key professional details and convert them into a consistent, branded, presentation-ready profile slide, significantly reducing manual formatting effort and improving accuracy and uniformity across organizational deliverables.",
    capabilities: [
      "Multi‑Format Resume Support: Allows users to upload resumes in PDF, Word, or PowerPoint formats for seamless processing.",
      "Automated Profile Extraction: Extracts key professional information—including summary, specialization, skills, education, and engagements—without manual effort.",
      "Standardized Slide Generation: Converts extracted data into a consistent, branded, presentation-ready profile slide aligned with organizational templates.",
      "AI‑Driven Content Structuring: Organizes unstructured resume content into clear, well-defined sections to ensure accuracy and uniformity.",
      "Rapid Output Delivery: Generates polished profile slides within seconds, significantly reducing preparation and formatting time."
    ]
  },

  "tom-asset-comparisons": {
    title: "TOM Asset Comparisons",
    overview:
      "Tom Asset Comparisons is an automated comparison tool designed to simplify the review of security controls and role‑based process flows within Target Operating Model assessments. By allowing users to upload Source and Target files, the tool highlights differences across asset classes and provides a structured way to evaluate how operating models align. This helps teams complete TOM comparisons more efficiently, maintain consistency in assessments, and reduce the time spent on manual file reviews.",
    capabilities: [
      "Automated File Comparison: Allows users to upload Source and Target files for side‑by‑side comparison of security controls and process flows.",
      "Security Control Matching: Automatically analyzes, compares, and maps security controls across asset classes to highlight gaps and alignment issues.",
      "Process Flow Evaluation: Supports L1–L4 role‑based process flow comparisons using the Source file as the reference model for assessment.",
      "Standardized Format Compliance: Ensures uploaded files adhere to approved formats (such as ARIS), enabling accurate and structured comparisons.",
      "End‑to‑End Analysis Automation: Reduces manual review effort by processing and generating comparison insights, even for large and complex TOM files.",
      "Scalable Performance: Handles large input files with processing windows typically ranging from 1–2 hours, depending on file size and complexity."
    ]
  },

  "financial-outlook-generator": {
    title: "Financial Outlook Generator",
    overview:
      "Financial Outlook Generator is an AI‑assisted reporting tool designed to help teams create comprehensive financial and market outlook documents. By combining user inputs with AI‑generated insights, the tool produces structured reports that summarize market trends, highlight key economic indicators, and present forward‑looking perspectives. This enables teams to develop consistent, well‑organized outlook reports while reducing the time and effort typically required for research and manual drafting.",
    capabilities: [
      "Automated Report Generation: Creates structured financial and market outlook reports based on user inputs and AI‑supported analysis.",
      "Trend & Indicator Analysis: Summarizes relevant market movements, economic indicators, and thematic trends in a clear, organized format.",
      "Insight‑Driven Narratives: Produces readable, cohesive narratives that help teams communicate strategic viewpoints effectively.",
      "Customizable Sections: Allows users to tailor report focus areas such as macroeconomic trends, sector insights, and market expectations.",
      "Consistent Output Format: Generates reports following a uniform structure, helping maintain alignment across teams and use cases.",
      "Time‑Saving Workflow: Reduces the effort involved in manual data interpretation, drafting, and formatting while preserving report quality."
    ]
  },

  "test-case-generator": {
    title: "Test Case Generator",
    overview:
      "Test Case Generator automates test case creation from requirements documents to reduce manual QA effort and improve delivery readiness.",
    capabilities: [
      "Generates test cases from requirement documents",
      "Reduces manual effort for QA teams",
      "Improves consistency in test coverage preparation",
      "Speeds up handoff from requirements to testing",
      "Supports structured outputs for review and execution"
    ]
  },

  "power-bi-publication-scoreboard": {
    title: "Power BI Publication Scoreboard",
    overview:
      "Power BI Publication Scoreboard is an analytics dashboard designed to track and visualize the performance of internal Power BI publications and marketing communications. The tool consolidates publication activity, consumer engagement, usage patterns, and template correlation into a single interactive workspace, helping teams monitor trends and assess the effectiveness of their content. This enables stakeholders to maintain visibility on publication output, understand audience behavior, and support data‑driven decisions for improving marketing and communication strategies.",
    capabilities: [
      "Publication Performance Tracking: Displays year‑to‑date publication metrics, consumer counts, and exhibit usage to show overall content activity.",
      "Audience & Distribution Insights: Highlights who consumes the publications and how they are distributed across channels such as email, web, and print.",
      "Trend Visualization: Presents visual trends over time, including monthly usage patterns and shifts in publication activity.",
      "Template Correlation Analysis: Compares publication templates to identify similarities, usage patterns, and alignment across content types.",
      "Interactive Power BI Dashboard: Provides an intuitive interface with filters, drill‑downs, and subject‑based navigation for detailed analysis.",
      "Centralized Reporting View: Consolidates key marketing metrics in one place to support regular reporting and informed decision‑making."
    ]
  },

  "utility-studio": {
    title: "Utility Studio",
    overview:
      "Utility Studio is a prompt engineering learning platform for building, testing, and refining prompts with structured templates and benchmarking.",
    capabilities: [
      "Provides structured prompt templates for experimentation",
      "Enables building and testing of prompts",
      "Supports iterative prompt improvement",
      "Benchmarks prompt performance for comparison",
      "Helps teams learn and standardize prompt engineering practices"
    ]
  }
};