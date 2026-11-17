const express = require('express');
const cors = require('cors');
const path = require('path');
const { useCases, systemHealth, monitoringData, executionStats } = require('./data');
const adminHealth = require('./adminHealth');
const costMetrics = require('./costMetrics');
const azureLogs = require('./azureLogs');
const { requireEntraAuth, allowedEmailsCount } = require('./entraAuth');

const app = express();
// Azure provides the port via process.env.PORT
const port = process.env.PORT || 3000;

// Initialize mock launches for sorting
useCases.forEach(uc => {
  uc.launches = 0;
});

app.use(cors());
app.use(express.json());

// Public, non-secret MSAL bootstrap configuration. The browser needs these
// identifiers before it can sign in. Keep secrets/credentials out of this route.
// Environment-specific values let one frontend artifact work in TEST and PROD.
app.get('/api/auth/config', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    tenantId: process.env.ENTRA_TENANT_ID || '',
    clientId: process.env.ENTRA_SPA_CLIENT_ID || process.env.ENTRA_CLIENT_ID || process.env.VITE_ENTRA_CLIENT_ID || '',
    apiScope: process.env.ENTRA_API_SCOPE || process.env.VITE_ENTRA_API_SCOPE || '',
    redirectUri: process.env.ENTRA_REDIRECT_URI || process.env.VITE_ENTRA_REDIRECT_URI || '',
  });
});

app.get('/api/use-cases', (req, res) => {
  res.json(useCases);
});

app.post('/api/use-cases/:id/launch', (req, res) => {
  const id = req.params.id;
  const useCase = useCases.find(uc => uc.id === id);
  if (useCase) {
    useCase.launches = (useCase.launches || 0) + 1;
    res.json({ success: true, launches: useCase.launches });
  } else {
    res.status(404).json({ error: 'Use case not found' });
  }
});

app.get('/api/system-health', (req, res) => {
  res.json({
    overview: systemHealth,
    monitoring: monitoringData,
    executionStats: executionStats
  });
});

/* ── Admin tab: real status checks + auto-fix + owner notification ── */
/*    All routes below require a valid Entra ID sign-in (see entraAuth.js). */

// UC1: current status of every use case with a live launchUrl
app.get('/api/admin/health', requireEntraAuth, (req, res) => {
  const apps = adminHealth.getHealthSnapshot(useCases);
  const checkedApps = apps.filter(a => a.lastChecked);
  res.json({
    apps,
    summary: {
      total: apps.length,
      active: apps.filter(a => a.status === 'active').length,
      stopped: apps.filter(a => a.status === 'stopped').length,
      inactive: apps.filter(a => a.status === 'inactive').length,
      checking: apps.filter(a => a.status === 'checking').length,
      avgLatencyMs: checkedApps.length
        ? Math.round(checkedApps.reduce((sum, a) => sum + (a.latencyMs || 0), 0) / checkedApps.length)
        : null,
    },
  });
});

// UC1+2+3 for a single app: re-probe now, auto-fix via retry, notify owner if still down
app.post('/api/admin/health/:id/check', requireEntraAuth, async (req, res) => {
  const useCase = useCases.find(uc => uc.id === req.params.id);
  if (!useCase) return res.status(404).json({ error: 'Use case not found' });
  const record = await adminHealth.investigateApplication(useCase);
  res.json(record);
});

// UC1+2+3 across every app in the catalog
app.post('/api/admin/health/check-all', requireEntraAuth, async (req, res) => {
  const records = await adminHealth.runCheckAll(useCases);
  res.json({ apps: records });
});

// Live feed for the "Active Alerts" panel: detections, auto-fix attempts, resolutions, notifications
app.get('/api/admin/incidents', requireEntraAuth, (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json(adminHealth.getIncidents(limit));
});

// Azure Monitor / Log Analytics: errors only, grouped per registered application.
app.get('/api/admin/logs/errors', requireEntraAuth, async (req, res) => {
  try {
    const minutes = Math.min(Math.max(Number(req.query.minutes) || 60, 1), 1440);
    const result = await azureLogs.getErrorsForApplications(useCases.filter(uc => uc.launchUrl), minutes, 50);
    res.json(result);
  } catch (err) {
    res.status(200).json({ configured: true, queryError: true, error: err.message, apps: {} });
  }
});

app.get('/api/admin/logs/errors/:id', requireEntraAuth, async (req, res) => {
  const useCase = useCases.find(uc => uc.id === req.params.id);
  if (!useCase) return res.status(404).json({ error: 'Use case not found' });
  try {
    const minutes = Math.min(Math.max(Number(req.query.minutes) || 60, 1), 31 * 24 * 60);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const range = req.query.start && req.query.end ? { start: req.query.start, end: req.query.end } : null;
    const result = await azureLogs.getErrorsForUseCase(useCase, minutes, limit, range);
    // Operational severity is contextual. If the application currently has a
    // latched, unhealthy dependency that makes the workflow unusable, every
    // error row shown for that incident is escalated to Critical in the admin
    // evidence view. Preserve the raw row severity for diagnostics.
    const health = adminHealth.getHealthSnapshot([useCase])[0];
    // Preserve the live probe result in the detail view even when the target
    // application does not emit HTTP diagnostics (or ingestion is delayed).
    // This is explicitly labeled as monitor evidence, not an Azure log row.
    if (health && Number(health.statusCode) >= 500 && health.lastError) {
      result.errors = Array.isArray(result.errors) ? result.errors : [];
      const alreadyPresent = result.errors.some((row) => String(row.Message || '').includes(`HTTP ${health.statusCode}`));
      if (!alreadyPresent) result.errors.unshift({
        TimeGenerated: health.lastChecked || new Date().toISOString(),
        Source: 'Health Monitor',
        Level: 'Error',
        Severity: 'critical',
        Message: `Live health probe received HTTP ${health.statusCode}: ${health.lastError.errorMessage || 'Application returned a server error'}`,
        _ResourceId: azureLogs.resolveResourceId(useCase),
        ResourceName: useCase.title,
        IsSynthetic: true,
      });
    }
    const criticalDependency = ['degraded', 'inactive'].includes(health?.status) &&
      health?.dependencyHealth?.status === 'unhealthy';
    if (criticalDependency && Array.isArray(result.errors)) {
      result.errors = result.errors.map((row) => ({
        ...row,
        RawSeverity: row.RawSeverity || row.Severity || row.Level || null,
        Severity: 'critical',
        OperationalSeverityReason: `Application is unavailable because of an unresolved ${health.dependencyHealth?.failingDependency || 'dependency'} failure`,
      }));
      result.operationalSeverity = 'critical';
    }
    res.json(result);
  } catch (err) {
    res.status(200).json({ configured: true, queryError: true, error: err.message, errors: [] });
  }
});

// Non-sensitive config summary for the Security & Access / Configuration tabs —
// exposes counts only (never the actual allowlisted emails).
app.get('/api/admin/config', requireEntraAuth, (req, res) => {
  const webhookConfigured = !!(process.env.OWNER_NOTIFICATION_WEBHOOK_URL || process.env.AZURE_NOTIFICATION_WEBHOOK_URL);
  res.json({
    allowedEmailsCount,
    notifications: {
      provider: webhookConfigured ? 'Logic App webhook' : 'Not configured',
      webhookConfigured,
      cc: String(process.env.OWNER_NOTIFICATION_CC || 'laltupati@kpmg.com')
        .split(/[;,]/).map((email) => email.trim()).filter(Boolean),
      smtpRequired: false,
    },
  });
});

// Real Azure spend for "Usage & Cost" and the Overview's Cost & Consumption
// panel. Returns { configured: false } until AZURE_SUBSCRIPTION_ID is set —
// see README-AZURE-COST.md.
app.get('/api/admin/cost', requireEntraAuth, async (req, res) => {
  try {
    const startDate = req.query.start || req.query.startDate || undefined;
    const endDate = req.query.end || req.query.endDate || undefined;
    const force = String(req.query.force || '').toLowerCase() === '1' || String(req.query.force || '').toLowerCase() === 'true';
    res.json(await costMetrics.getCostIntelligence(useCases, { startDate, endDate, force }));
  } catch (err) {
    res.status(500).json({ configured: true, error: err.message });
  }
});

// Background sweep so status is fresh even before anyone opens the Admin tab
adminHealth.startMonitoring(useCases);

// Serve frontend in production (Azure)
const clientBuildPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientBuildPath));

// Catch-all route to serve index.html for Single Page Application routing
app.use((req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
