/**
 * MOCK DATA — this file exists because several sections of the dashboard
 * (AI usage/cost, security posture, deployment history, platform service
 * health) need data this app's backend does not currently collect.
 *
 * None of this is wired to a real Azure integration. To make a section
 * real, replace its import here with a fetch to a real endpoint (Azure
 * Cost Management API, Microsoft Graph Secure Score, App Service
 * deployment history, Azure Resource Health, etc.) — see
 * README-DASHBOARD.md for a section-by-section breakdown of what's real
 * vs. mocked today.
 */

export const mockPlatformServices = [
  { name: 'Azure OpenAI', status: 'Healthy' },
  { name: 'AI Search', status: 'Healthy' },
  { name: 'Content Safety', status: 'Healthy' },
  { name: 'Storage Accounts', status: 'Healthy' },
  { name: 'Key Vault', status: 'Healthy' },
  { name: 'Application Insights', status: 'Healthy' },
  { name: 'App Service (Playground)', status: 'Healthy' },
  { name: 'API Management', status: 'Healthy' },
];

export const mockSecurityPosture = {
  score: 94,
  checks: [
    { label: 'Entra ID', value: 'Healthy', ok: true },
    { label: 'RBAC', value: 'Configured', ok: true },
    { label: 'Managed Identity', value: 'Enabled', ok: true },
    { label: 'Network Security', value: 'Restricted', ok: true },
    { label: 'Private Endpoints', value: '7 / 8', ok: true },
    { label: 'Secrets in Key Vault', value: 'Yes', ok: true },
    { label: 'Certificates', value: 'Valid', ok: true },
    { label: 'MFA', value: 'Enforced', ok: true },
  ],
};

export const mockAiUsage = {
  requestsToday: 24600,
  requestsDeltaPct: 18,
  tokensToday: 8400000,
  tokensDeltaPct: 14,
  activeUsers: 1284,
  avgLatencySeconds: 1.42,
  costTodayUsd: 184,
  costDeltaPct: 9,
  topModels: [
    { name: 'GPT-4o', pct: 57 },
    { name: 'GPT-4o-mini', pct: 31 },
    { name: 'text-embedding-3-large', pct: 10 },
    { name: 'Other models', pct: 2 },
  ],
};

export const mockCost = {
  totalCost: 8420,
  budget: 10000,
  consumedPct: 84,
  byService: [
    { name: 'Azure OpenAI', amount: 6840, pct: 81 },
    { name: 'AI Search', amount: 920, pct: 11 },
    { name: 'App Services', amount: 410, pct: 5 },
    { name: 'Storage', amount: 250, pct: 3 },
  ],
};

export const mockTrends = {
  availabilityPct: 99.98,
  avgResponseMs: 35,
  errorRatePct: 0.32,
  requestsToday: 24600,
};

export const mockRecentDeployments = [
  { app: 'ProScreener v2.4.1', team: 'AI Analytics', when: '27 Aug 2026, 10:15 AM', status: 'Success' },
  { app: 'Resume Creator v3.1.0', team: 'People & Culture', when: '26 Aug 2026, 11:30 AM', status: 'Success' },
  { app: 'SynthDataForge v1.3.2', team: 'Data Engineering', when: '26 Aug 2026, 01:30 PM', status: 'Success' },
];
