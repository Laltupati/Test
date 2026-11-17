import React, { useEffect, useState } from 'react';
import { timeAgo, statusBadge } from '../format';

// The API may return CC recipients as an array (new format) or as a
// comma/semicolon-delimited string (legacy environment-variable format).
// Normalize both so notification metadata can never crash the whole page.
function formatCcRecipients(value) {
  const recipients = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[;,]/)
      : [];
  return recipients.map((item) => String(item || '').trim()).filter(Boolean).join(', ');
}

const PREVIEW_ERRORS = [
  {
    TimeGenerated: 'Preview · 2 min ago',
    Source: 'Console',
    Level: 'Error',
    Message: 'Unhandled exception connecting to Azure SQL',
  },
  {
    TimeGenerated: 'Preview · 2 min ago',
    Source: 'HTTP',
    Level: 'Error',
    Message: '500 POST /api/query',
  },
];

function friendlyLastError(app) {
  if (!app) return '—';
  if (app.status === 'stopped') {
    const code = app.statusCode || app.lastError?.statusCode || 403;
    return `Azure App Service stopped (HTTP ${code})`;
  }
  if (['inactive'].includes(app.status) && app.dependencyHealth?.status === 'unhealthy') {
    const dependency = app.dependencyHealth?.failingDependency || app.lastError?.dependency;
    return dependency ? `${dependency} dependency failure` : (app.lastError?.errorMessage || 'Application dependency/error detected');
  }
  if (app.lastError?.errorMessage) return app.lastError.errorMessage;
  if (app.lastError?.errorType === 'http_error') return 'HTTP request failed';
  return app.lastError?.errorType || '—';
}

function friendlyAction(app) {
  const action = app?.remediation;
  if (!app?.actionRequired) return 'No action';
  if (action === 'owner_alert') return 'Notify owner · investigate dependency';
  if (action === 'auto_restart_then_alert') return 'Auto-restart then notify owner';
  if (action === 'resolved') return 'Resolved';
  return action || 'Owner investigation';
}

function AzureMetric({ label, value, tone }) {
  return (
    <div className={`ad-azure-metric ${tone || ''}`}>
      <div className="ad-azure-metric-label">{label}</div>
      <div className={`ad-azure-metric-value ${tone || ''}`}>{value}</div>
    </div>
  );
}

function statusTone(status) {
  if (status === 'active') return 'healthy';
  if (status === 'stopped') return 'stopped';
  if (['inactive'].includes(status)) return 'unavailable';
  return 'unknown';
}

function dependencyFromError(error) {
  return error?.Dependency || error?.dependency || null;
}

function isRecentError(error, minutes = 5) {
  const ts = new Date(error?.TimeGenerated || error?.timeGenerated || 0).getTime();
  return Number.isFinite(ts) && ts > 0 && (Date.now() - ts) <= minutes * 60 * 1000;
}

function dependencySummary(errors = [], app) {
  const values = [...new Set(errors.map(dependencyFromError).filter(Boolean))];
  const current = app?.dependencyHealth?.failingDependency;
  if (current && !values.includes(current)) values.unshift(current);
  return values;
}

const SEVERITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

function normalizeSeverity(value) {
  const v = String(value || '').toLowerCase();
  if (['urgent', 'critical', 'fatal'].includes(v)) return 'critical';
  if (['high'].includes(v)) return 'high';
  if (['medium', 'warning', 'warn', 'error'].includes(v)) return 'medium';
  return 'low';
}

function errorSeverity(error) {
  const message = String(error?.Message || error?.errorMessage || '').toLowerCase();
  if (/fatal|critical|unhandled|out of memory|heap out of memory|process crash|application crash|\b401\b|\b403\b|unauthorized|forbidden|permissiondenied|authentication|invalid credential|invalid api key|invalid subscription key/.test(message)) return 'critical';
  if (/\b429\b|too many requests|quota|throttl|rate limit|\b500\b|\b502\b|\b503\b|\b504\b|service unavailable|bad gateway|gateway timeout/.test(message)) return 'high';
  if (/timeout|timed out|econnrefused|econnreset|connection refused|connection reset|dns|name resolution/.test(message)) return 'medium';
  return normalizeSeverity(error?.Severity || error?.severity || error?.Level || error?.level);
}

function severityLabel(severity) {
  if (severity === 'critical') return 'Critical';
  if (severity === 'high') return 'High';
  if (severity === 'medium') return 'Medium';
  return 'Low / Info';
}

function highestSeverity(app, errors = []) {
  // Operational severity represents CURRENT application impact. Historical
  // Log Analytics evidence remains available in Complete Error Logs, but it
  // must not keep a recovered/healthy or access-restricted app actionable.
  if (!app) return null;
  if (app.status === 'active') return null;
  if (app.status === 'stopped' || app.status === 'inactive') return 'critical';
  if (app.status === 'monitoring_error' || app.status === 'restricted') return 'critical';
  if (['inactive'].includes(app.status) && app.dependencyHealth?.status === 'unhealthy') return 'critical';

  const values = errors.filter((entry) => isRecentError(entry, 5)).map(errorSeverity);
  if (app?.actionRequired && app?.errorSeverity) values.push(normalizeSeverity(app.errorSeverity));
  if (!values.length) return null;
  return values.sort((a, b) => (SEVERITY_ORDER[b] || 0) - (SEVERITY_ORDER[a] || 0))[0];
}

function issueTitle(error, app) {
  const dependency = dependencyFromError(error) || app?.dependencyHealth?.failingDependency;
  const message = String(error?.Message || error?.errorMessage || app?.lastError?.errorMessage || '');
  if (dependency && /401|403|authentication|unauthorized|forbidden|invalid .*key|permissiondenied/i.test(message)) return `${dependency} authentication`;
  if (dependency && /429|quota|throttl|rate limit/i.test(message)) return `${dependency} quota / throttling`;
  if (dependency) return `${dependency} dependency`;
  if (/500|502|503|504/i.test(message)) return 'Application HTTP failure';
  return message ? 'Application / dependency issue' : null;
}

function SeverityMetric({ severity, active, detail }) {
  const label = severityLabel(severity);
  return (
    <div className={`ad-severity-metric ${severity} ${active ? 'active' : 'clear'}`}>
      <div className="ad-severity-metric-head"><span className="ad-severity-dot" />{label}</div>
      <div className="ad-severity-metric-state">{active ? 'ACTIVE' : 'CLEAR'}</div>
      <div className="ad-severity-metric-detail">{active ? (detail || 'Action / review required') : 'No unresolved issue'}</div>
    </div>
  );
}

export default function HealthMonitoring({ apps, summary, checkOne, checkingId, onOpenApp, loadAppErrors, loadCompleteAppErrors }) {
  const [errorMap, setErrorMap] = useState({});
  const [logsConfigured, setLogsConfigured] = useState(null);
  const [logLoadError, setLogLoadError] = useState(false);
  const [logErrorMessage, setLogErrorMessage] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showCompleteLogs, setShowCompleteLogs] = useState(false);
  const [completeLogs, setCompleteLogs] = useState([]);
  const [completeLogsLoading, setCompleteLogsLoading] = useState(false);
  const [completeLogsError, setCompleteLogsError] = useState('');
  const [completeLogsMinutes, setCompleteLogsMinutes] = useState(1440);
  const [completeLogsRangeMode, setCompleteLogsRangeMode] = useState('preset');
  const [completeLogsStart, setCompleteLogsStart] = useState('');
  const [completeLogsEnd, setCompleteLogsEnd] = useState('');
  const [completeLogsSearch, setCompleteLogsSearch] = useState('');


  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!loadAppErrors) {
        if (!cancelled) setLogsConfigured(false);
        return;
      }
      const data = await loadAppErrors();
      if (cancelled) return;
      if (!data) {
        // A failed/timeout HTTP request is not evidence that Log Analytics is
        // unconfigured. Preserve the last known configuration and live rows;
        // only an explicit configured:false response may enable Preview Mode.
        setLogLoadError(true);
        setLogErrorMessage('Unable to reach the GenAI Playground log API. Retrying automatically.');
        return;
      }
      setLogLoadError(Boolean(data.queryError || data.error));
      setLogErrorMessage(data.error || '');
      // Preview is reserved for an explicit backend response that Azure
      // Monitor is not configured. Transient query failures stay in the
      // connected/error state and never inject sample data.
      setLogsConfigured(data.configured === false ? false : true);
      if (!data.queryError && !data.error && data.apps) {
        setErrorMap(data.apps);
      }
    };

    load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loadAppErrors]);

  useEffect(() => {
    if (!apps.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !apps.some((app) => app.id === selectedId)) {
      setSelectedId(apps[0].id);
    }
  }, [apps, selectedId]);

  const previewMode = logsConfigured === false;
  const azureQueryFailed = logLoadError;
  const azureLive = logsConfigured === true && !logLoadError;
  const azureConnecting = logsConfigured === null && !logLoadError;
  const selectedIndex = Math.max(0, apps.findIndex((app) => app.id === selectedId));
  const selectedApp = apps[selectedIndex] || apps[0];
  const selectedLiveErrors = selectedApp ? (errorMap[selectedApp.id] || []) : [];
  const selectedSampleErrors = previewMode && selectedIndex % 3 === 0 ? PREVIEW_ERRORS : [];
  const selectedRecentErrors = selectedLiveErrors.filter((e) => isRecentError(e));
  const selectedErrors = previewMode ? selectedSampleErrors : selectedLiveErrors;
  const selectedErrorCount = previewMode ? selectedSampleErrors.length : selectedLiveErrors.length;
  // The rolling 60-minute Log Analytics view can legitimately become empty
  // while an unresolved dependency incident remains latched. In that case use
  // the persisted Azure evidence attached to the health record for the urgent
  // attention panel instead of rendering an empty box.
  const selectedLatchedErrors = !previewMode && Array.isArray(selectedApp?.azureErrors) ? selectedApp.azureErrors : [];
  const selectedUrgentErrors = previewMode
    ? selectedSampleErrors
    : (selectedLiveErrors.length ? selectedLiveErrors : selectedLatchedErrors);
  const selectedPreviewUrgent = previewMode && selectedSampleErrors.length > 0;
  const selectedDependencies = dependencySummary(selectedRecentErrors.length ? selectedRecentErrors : selectedUrgentErrors, selectedApp);
  const selectedCriticalDependency = ['inactive'].includes(selectedApp?.status) && selectedApp?.dependencyHealth?.status === 'unhealthy';
  const selectedOperationallyHealthy = selectedApp?.status === 'active';
  const selectedSeverityEvidenceBase = selectedOperationallyHealthy
    ? []
    : (selectedUrgentErrors.length
        ? selectedUrgentErrors
        : (selectedApp?.lastError ? [{ ...selectedApp.lastError, Severity: selectedApp.errorSeverity }] : []));
  // The log row's raw verbosity is not the same as operational impact. When an
  // unresolved dependency has made this application's workflow unusable, show
  // the incident evidence as Critical while preserving RawSeverity for detail.
  const selectedSeverityEvidence = selectedCriticalDependency
    ? selectedSeverityEvidenceBase.map((entry) => ({ ...entry, RawSeverity: entry.RawSeverity || entry.Severity || entry.Level, Severity: 'critical' }))
    : selectedSeverityEvidenceBase;
  const selectedHighestSeverity = highestSeverity(selectedApp, selectedSeverityEvidence);
  const selectedSeveritySummary = ['critical', 'high', 'medium', 'low'].reduce((acc, severity) => {
    const match = selectedSeverityEvidence.find((entry) => errorSeverity(entry) === severity);
    const activeFromApp = ['inactive'].includes(selectedApp?.status) && normalizeSeverity(selectedApp?.errorSeverity) === severity;
    acc[severity] = {
      active: Boolean(match || activeFromApp),
      detail: issueTitle(match, selectedApp),
    };
    return acc;
  }, {});
  const selectedHighestEvidence = selectedSeverityEvidence
    .slice()
    .sort((a, b) => (SEVERITY_ORDER[errorSeverity(b)] || 0) - (SEVERITY_ORDER[errorSeverity(a)] || 0))[0];

  const selectedActionableEvidence = selectedSeverityEvidence.filter((entry) => SEVERITY_ORDER[errorSeverity(entry)] >= SEVERITY_ORDER.medium);
  const selectedUrgent = selectedApp && !previewMode && (['inactive'].includes(selectedApp.status) || (selectedHighestSeverity && SEVERITY_ORDER[selectedHighestSeverity] >= SEVERITY_ORDER.medium));

  const fetchCompleteLogs = async (app = selectedApp, minutes = completeLogsMinutes, range = null) => {
    if (!app || !loadCompleteAppErrors) return;
    setCompleteLogsLoading(true);
    setCompleteLogsError('');
    try {
      const data = await loadCompleteAppErrors(app.id, minutes, 500, range);
      if (!data) {
        setCompleteLogs([]);
        setCompleteLogsError('Unable to retrieve error logs from Azure Log Analytics.');
        return;
      }
      if (data.queryError || data.error) {
        setCompleteLogs([]);
        setCompleteLogsError(data.error || 'Azure Log Analytics query failed.');
        return;
      }
      setCompleteLogs(Array.isArray(data.errors) ? data.errors : []);
    } finally {
      setCompleteLogsLoading(false);
    }
  };

  const openCompleteLogs = async () => {
    setCompleteLogsSearch('');
    setShowCompleteLogs(true);
    await fetchCompleteLogs(selectedApp, completeLogsMinutes);
  };

  const filteredCompleteLogs = completeLogs.filter((entry) => {
    const q = completeLogsSearch.trim().toLowerCase();
    if (!q) return true;
    return [entry.TimeGenerated, entry.Source, entry.Level, entry.Severity, entry.Message, entry.ResourceRole, entry.ResourceName, dependencyFromError(entry)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });

  return (
    <div className="ad-health-page">
      <div className="ad-page-header ad-health-page-header">
        <div>
          <h1 className="ad-page-title">Health & Monitoring</h1>
          <p className="ad-page-subtitle">Application availability, Azure Monitor errors, remediation and owner escalation</p>
        </div>

      </div>

      <div className={`ad-monitor-banner ad-monitor-banner-compact ${previewMode || azureQueryFailed ? 'preview' : 'live'}`}>
        <div className="ad-monitor-banner-copy">
          <div className="ad-monitor-banner-title">
            Azure Monitor Integration
            <span className={`ad-monitor-mode ${azureLive ? 'live' : 'preview'}`}>
              {previewMode ? 'PREVIEW MODE' : azureQueryFailed ? 'QUERY UNAVAILABLE' : azureConnecting ? 'CONNECTING' : 'LIVE'}
            </span>
          </div>
          <div className="ad-monitor-banner-sub">
            {previewMode
              ? 'Azure is not configured yet. Preview values remain visible until Log Analytics is enabled.'
              : azureQueryFailed
                ? 'The latest Log Analytics request failed. Previously loaded live data is retained; the dashboard will retry automatically.'
                : azureConnecting
                  ? 'Connecting to Azure Monitor / Log Analytics and loading live telemetry.'
                  : 'Live App Service console logs and HTTP 2xx, 4xx and 5xx events are being read from Azure Monitor / Log Analytics.'}
          </div>
          {logLoadError && <div className="ad-monitor-note">The latest Log Analytics request failed; the last known live state is retained and the dashboard will retry{logErrorMessage ? `: ${logErrorMessage}` : '.'}</div>}
        </div>
        <div className="ad-monitor-status-grid ad-monitor-status-grid-compact">
          <div><span className={azureLive ? 'ad-status-dot ok' : 'ad-status-dot off'} />Log Analytics <strong>{previewMode ? 'Not configured' : azureQueryFailed ? 'Query failed' : azureConnecting ? 'Connecting' : 'Connected'}</strong></div>
          <div><span className={azureLive ? 'ad-status-dot ok' : 'ad-status-dot off'} />Console Logs <strong>{previewMode ? 'Preview' : azureQueryFailed ? 'Unavailable' : azureConnecting ? 'Connecting' : 'Live'}</strong></div>
          <div><span className={azureLive ? 'ad-status-dot ok' : 'ad-status-dot off'} />HTTP 2xx / 4xx / 5xx <strong>{previewMode ? 'Preview' : azureQueryFailed ? 'Unavailable' : azureConnecting ? 'Connecting' : 'Live'}</strong></div>
          <div><span className={azureLive ? 'ad-status-dot ok' : 'ad-status-dot off'} />Managed Identity <strong>{previewMode ? 'Pending setup' : azureQueryFailed ? 'Query unavailable' : azureConnecting ? 'Connecting' : 'Active'}</strong></div>
        </div>
      </div>

      <div className="ad-kpi-row ad-health-kpi-row ad-health-kpi-row-compact">
        <div className="ad-kpi-card ad-health-kpi-healthy"><div className="ad-kpi-label">Available</div><div className="ad-kpi-value g">{summary?.active ?? apps.filter((a) => a.status === 'active').length}</div><div className="ad-kpi-sub">Reachable · no active errors</div></div>
        <div className="ad-kpi-card ad-health-kpi-unavailable"><div className="ad-kpi-label">Unavailable</div><div className="ad-kpi-value ad-kpi-red">{summary?.inactive ?? apps.filter((a) => a.status === 'inactive').length}</div><div className="ad-kpi-sub">Unreachable or functionality failure</div></div>
        <div className="ad-kpi-card ad-health-kpi-stopped"><div className="ad-kpi-label">Stopped / Down</div><div className="ad-kpi-value ad-kpi-stopped-value">{summary?.stopped ?? apps.filter((a) => a.status === 'stopped').length}</div><div className="ad-kpi-sub">App Service stopped in Azure</div></div>
      </div>

      <div className="ad-health-workspace">
        <section className="ad-health-list-panel" aria-label="Application health list">
          <div className="ad-health-workspace-head">
            <div>
              <h2>Application Health</h2>
              <span>{apps.length} monitored</span>
            </div>
            <div className="ad-health-legend">
              <span className="healthy">● Available</span>
              <span className="unavailable">● Unavailable</span>
              <span className="stopped">● Stopped / Down</span>
            </div>
          </div>

          <div className="ad-health-list-header">
            <span>Application</span>
            <span>Status</span>
            <span>Response</span>
            <span>Last checked</span>
            <span>Owner</span>
            <span>Azure severity</span>
            <span>Action</span>
          </div>

          <div className="ad-health-list" tabIndex={0} aria-label="Scrollable list of monitored applications">
            {apps.map((app, appIndex) => {
              const badge = statusBadge(app.status);
              const liveErrors = errorMap[app.id] || [];
              const sampleErrors = previewMode && appIndex % 3 === 0 ? PREVIEW_ERRORS : [];
              const appSeverity = previewMode ? (sampleErrors.length ? 'medium' : null) : ((['inactive'].includes(app.status) && app.dependencyHealth?.status === 'unhealthy') ? 'critical' : highestSeverity(app, liveErrors.length ? liveErrors : (app.azureErrors || [])));
              const isSelected = app.id === selectedApp?.id;
              const tone = statusTone(app.status);
              const probeStatusCode = Number(app.probeStatusCode ?? app.statusCode);
              const hasProbeStatusCode = Number.isFinite(probeStatusCode) && probeStatusCode > 0;

              return (
                <div
                  key={app.id}
                  className={`ad-health-list-row ${tone}${isSelected ? ' selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(app.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedId(app.id); }}
                >
                  <div className="ad-health-app-cell">
                    <span className={`ad-health-app-dot ${tone}`} />
                    <div>
                      <strong>{app.title}</strong>
                      <small className="ad-health-app-url" title={app.launchUrl || ''}>{(app.launchUrl || '').replace(/^https?:\/\//, '')}</small>
                    </div>
                  </div>
                  <div className="ad-health-status-cell">
                    <span className={badge.cls} title={badge.sub}>● {badge.label}</span>
                  </div>
                  <div className="ad-health-response">
                    <strong>{app.latencyMs != null ? `${app.latencyMs} ms` : '—'}</strong>
                    <small>
                      {hasProbeStatusCode
                        ? `HTTP ${probeStatusCode}`
                        : app.status === 'inactive' ? 'No HTTP response' : ''}
                    </small>
                  </div>
                  <div className="ad-health-row-meta">
                    <strong>{timeAgo(app.lastChecked)}</strong>
                  </div>
                  <div className="ad-health-owner">
                    <strong>{app.owner || '—'}</strong>
                    {app.ownerEmail && <small>{app.ownerEmail}</small>}
                  </div>
                  <div className={`ad-health-azure-severity ${appSeverity || 'clear'}`}>
                    <strong>{previewMode ? 'Preview' : (appSeverity ? severityLabel(appSeverity) : 'Clear')}</strong>
                    <small>{previewMode ? 'Sample classification' : (appSeverity ? 'Highest unresolved' : 'No action signal')}</small>
                  </div>
                  <div className="ad-health-row-action">
                    {(() => {
                      const needsInvestigation = Boolean(
                        app.actionRequired ||
                        ['stopped', 'inactive'].includes(app.status) ||
                        ['critical', 'high', 'medium'].includes(appSeverity)
                      );
                      return (
                        <button
                          type="button"
                          className={`ad-btn ad-btn-mini ${needsInvestigation ? 'ad-btn-investigate' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (needsInvestigation) {
                              setSelectedId(app.id);
                              if (checkOne && checkingId !== app.id) {
                                Promise.resolve(checkOne(app.id)).finally(() => {
                                  if (onOpenApp && app.launchUrl) onOpenApp(app);
                                });
                              } else if (onOpenApp && app.launchUrl) {
                                onOpenApp(app);
                              }
                            } else if (onOpenApp) {
                              onOpenApp(app);
                            }
                          }}
                        >
                          {needsInvestigation ? (checkingId === app.id ? 'Checking…' : 'Investigate') : 'Open'}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={`ad-health-detail-panel ${selectedApp ? statusTone(selectedApp.status) : ''}`} aria-label="Selected application monitoring detail">
          {selectedApp ? (
            <>
              <div className="ad-health-detail-head">
                <div>
                  <div className="ad-health-detail-eyebrow">Selected application</div>
                  <h2>{selectedApp.title}</h2>
                  <div className="ad-app-url">{(selectedApp.launchUrl || '').replace(/^https?:\/\//, '')}</div>
                </div>
                <span className={statusBadge(selectedApp.status).cls}>● {statusBadge(selectedApp.status).label}</span>
              </div>

              <div className="ad-health-detail-summary">
                <div><span>Last checked</span><strong>{timeAgo(selectedApp.lastChecked)}</strong></div>
                <div><span>Failures</span><strong>{selectedApp.consecutiveFailures ?? 0}</strong></div>
                <div><span>Last error</span><strong title={friendlyLastError(selectedApp)}>{friendlyLastError(selectedApp)}</strong></div>
                <div><span>Action</span><strong className={selectedApp.actionRequired ? 'danger' : 'ok'}>{friendlyAction(selectedApp)}</strong></div>
              </div>
              {selectedApp.monitoringNote && <div className="ad-monitor-note" role="status">{selectedApp.monitoringNote}</div>}

              <div className="ad-azure-section ad-azure-section-detail">
                <div className="ad-azure-section-head">
                  <div>
                    <div className="ad-azure-title">Azure Monitor</div>
                    <div className="ad-azure-subtitle">Severity-classified Azure application and dependency events</div>
                  </div>
                  <span className={`ad-monitor-mode ${azureLive ? 'live' : 'preview'}`}>{previewMode ? 'NOT CONFIGURED · PREVIEW' : azureQueryFailed ? 'TELEMETRY UNAVAILABLE' : 'LIVE DATA'}</span>
                </div>

                <div className="ad-severity-metrics-grid">
                  <SeverityMetric severity="critical" {...selectedSeveritySummary.critical} />
                  <SeverityMetric severity="high" {...selectedSeveritySummary.high} />
                  <SeverityMetric severity="medium" {...selectedSeveritySummary.medium} />
                  <SeverityMetric severity="low" {...selectedSeveritySummary.low} />
                </div>

                <div className={`ad-azure-overall ${selectedHighestSeverity || 'clear'}`}>
                  <div>
                    <span>Overall Azure health</span>
                    <strong>{selectedHighestSeverity ? `${severityLabel(selectedHighestSeverity)}${selectedHighestSeverity === 'critical' ? ' — urgent action required' : selectedHighestSeverity === 'high' ? ' — investigation required' : selectedHighestSeverity === 'medium' ? ' — monitor / investigate' : ' — informational'}` : 'Clear — no unresolved Azure issue'}</strong>
                  </div>
                  <div className="ad-azure-latest-issue">
                    <span>Latest / retained issue</span>
                    <strong>{selectedHighestEvidence ? (issueTitle(selectedHighestEvidence, selectedApp) || 'Application issue') : (['inactive'].includes(selectedApp?.status) ? friendlyLastError(selectedApp) : '—')}</strong>
                    <small>{selectedHighestEvidence?.TimeGenerated || selectedHighestEvidence?.timeGenerated ? timeAgo(selectedHighestEvidence.TimeGenerated || selectedHighestEvidence.timeGenerated) : ''}</small>
                  </div>
                </div>

                <button
                  type="button"
                  className="ad-complete-log-card"
                  onClick={openCompleteLogs}
                  disabled={!azureLive || !selectedApp || !loadCompleteAppErrors}
                  title={!azureLive ? 'Azure Log Analytics must be connected to view complete logs.' : 'Open complete Azure Log Analytics errors for this application'}
                >
                  <span className="ad-complete-log-icon">≡</span>
                  <span className="ad-complete-log-copy">
                    <strong>View Complete Error Logs</strong>
                    <small>Open the full Azure Log Analytics error history for {selectedApp?.title || 'this application'}.</small>
                  </span>
                  <span className="ad-complete-log-arrow">→</span>
                </button>

                {previewMode && (
                  <div className="ad-preview-explainer ad-preview-explainer-compact">
                    <strong>Preview:</strong> values marked <strong>sample</strong> are simulated and will be replaced by Log Analytics data after configuration.
                  </div>
                )}

                {azureLive && (selectedDependencies.length > 0 || ['inactive'].includes(selectedApp.status)) && (
                  <div className="ad-dependency-health">
                    <div className="ad-dependency-health-title">Dependency health</div>
                    <div className="ad-dependency-chips">
                      {(selectedDependencies.length ? selectedDependencies : ['Application dependency']).map((dep) => (
                        <span key={dep} className="ad-dependency-chip failing">● {dep} · Unhealthy</span>
                      ))}
                    </div>
                    <div className="ad-dependency-note">An application or dependency error means the full application functionality is unavailable.</div>
                  </div>
                )}

                {azureLive && selectedApp.lastNotification && (
                  <div className={`ad-owner-notification ${selectedApp.lastNotification.sent ? 'sent' : 'pending'}`}>
                    <strong>{selectedApp.lastNotification.sent ? '✓ Owner alert sent' : '◷ Owner alert queued / Azure Monitor delivery'}</strong>
                    <span>{selectedApp.ownerEmail || 'Owner email not configured'}{formatCcRecipients(selectedApp.lastNotification?.cc) ? ` · CC ${formatCcRecipients(selectedApp.lastNotification.cc)}` : ''}</span>
                  </div>
                )}

                {(selectedUrgent || selectedPreviewUrgent) && (
                  <div className={`ad-urgent-block ad-urgent-block-compact ${previewMode ? 'sample' : ''}`}>
                    <div className="ad-urgent-title">
                      {previewMode && <span className="ad-sample-pill">SAMPLE</span>}
                      {selectedHighestSeverity === 'critical' ? 'CRITICAL — URGENT ACTION REQUIRED' : selectedHighestSeverity === 'high' ? 'HIGH — INVESTIGATION REQUIRED' : selectedHighestSeverity === 'medium' ? 'MEDIUM — ATTENTION REQUIRED' : 'INFORMATIONAL'}
                    </div>
                    <div className="ad-urgent-meta">Severity is based on operational impact, not log volume. Critical and High issues are escalated to the application owner.</div>
                    <div className="ad-error-scroll">
                      {selectedActionableEvidence.length > 0 ? selectedActionableEvidence.slice(0, 10).map((e, i) => (
                        <div key={`${e.TimeGenerated || e.timeGenerated || 'latched'}-${i}`} className="ad-error-row">
                          <div className="ad-error-time">{e.TimeGenerated || e.timeGenerated || 'Last detected incident'} · {e.Source || e.source || 'Azure Monitor'}{(e.ResourceRole || e.resourceRole) ? ` · ${e.ResourceRole || e.resourceRole}` : ''}{(e.ResourceName || e.resourceName) ? ` · ${e.ResourceName || e.resourceName}` : ''}{dependencyFromError(e) ? ` · ${dependencyFromError(e)}` : ''}</div>
                          <div className="ad-error-message">{e.Message || e.errorMessage || selectedApp?.lastError?.errorMessage || 'Unresolved Azure dependency incident.'}</div>
                        </div>
                      )) : selectedApp?.lastError ? (
                        <div className="ad-error-row">
                          <div className="ad-error-time">{selectedApp.lastError.timeGenerated || 'Last detected incident'} · {selectedApp.lastError.source || 'Azure Monitor'}{selectedApp.lastError.resourceRole ? ` · ${selectedApp.lastError.resourceRole}` : ''}{selectedApp.lastError.resourceName ? ` · ${selectedApp.lastError.resourceName}` : ''}{selectedApp.lastError.dependency ? ` · ${selectedApp.lastError.dependency}` : ''}</div>
                          <div className="ad-error-message">{selectedApp.lastError.errorMessage || 'Unresolved Azure dependency incident.'}</div>
                        </div>
                      ) : (
                        <div className="ad-error-row"><div className="ad-error-message">Unresolved dependency incident. Open Complete Error Logs for the full Azure Log Analytics history.</div></div>
                      )}
                    </div>
                  </div>
                )}

                {!previewMode && selectedErrorCount === 0 && (
                  <div className="ad-no-errors">
                    {['inactive'].includes(selectedApp?.status) && selectedApp?.dependencyIncidentLatched
                      ? '● No new Azure Monitor errors in the current 60-minute window. The unresolved incident evidence above is retained until recovery is verified.'
                      : '● No Azure Monitor errors detected in the selected time window.'}
                  </div>
                )}
              </div>

              {selectedApp.autoFixAttempts?.length > 0 && (
                <div className="ad-remediation-block ad-remediation-block-detail">
                  <div className="ad-kpi-label">Auto-remediation attempts</div>
                  <div className="ad-remediation-attempts">
                    {selectedApp.autoFixAttempts.map((a, i) => (
                      <span key={i} className={a.ok ? 'ok' : 'danger'}>Attempt {a.attempt}: {a.ok ? 'Recovered' : 'Still failing'}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="ad-empty-note">No applications are available for monitoring.</div>
          )}
        </section>
      </div>

      {showCompleteLogs && selectedApp && (
        <div className="ad-log-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCompleteLogs(false); }}>
          <div className="ad-log-modal" role="dialog" aria-modal="true" aria-label={`Complete Azure error logs for ${selectedApp.title}`}>
            <div className="ad-log-modal-header">
              <div>
                <div className="ad-health-detail-eyebrow">Azure Log Analytics</div>
                <h2>Complete Error Logs · {selectedApp.title}</h2>
                <p>Direct Azure Log Analytics records across the mapped frontend/backend resources. Level is shown exactly as returned by the Log Analytics workspace; application operational severity is calculated separately in the Health view.</p>
              </div>
              <button type="button" className="ad-log-modal-close" onClick={() => setShowCompleteLogs(false)} aria-label="Close complete error logs">×</button>
            </div>

            <div className={`ad-log-modal-toolbar${completeLogsRangeMode === 'custom' ? ' ad-log-modal-toolbar-custom' : ''}`}>
              <div className="ad-log-filter-group">
                <label htmlFor="complete-log-window">Time range</label>
                <select
                  id="complete-log-window"
                  value={completeLogsRangeMode === 'custom' ? 'custom' : completeLogsMinutes}
                  onChange={async (e) => {
                    if (e.target.value === 'custom') {
                      setCompleteLogsRangeMode('custom');
                      return;
                    }
                    const minutes = Number(e.target.value);
                    setCompleteLogsRangeMode('preset');
                    setCompleteLogsMinutes(minutes);
                    await fetchCompleteLogs(selectedApp, minutes);
                  }}
                >
                  <option value={60}>Last 60 minutes</option>
                  <option value={360}>Last 6 hours</option>
                  <option value={720}>Last 12 hours</option>
                  <option value={1440}>Last 24 hours</option>
                  <option value={4320}>Last 3 days</option>
                  <option value={10080}>Last 7 days</option>
                  <option value="custom">Custom date & time…</option>
                </select>
              </div>
              {completeLogsRangeMode === 'custom' && (
                <>
                  <div className="ad-log-filter-group ad-log-custom-time">
                    <label htmlFor="complete-log-start">From</label>
                    <input id="complete-log-start" type="datetime-local" value={completeLogsStart} onChange={(e) => setCompleteLogsStart(e.target.value)} />
                  </div>
                  <div className="ad-log-filter-group ad-log-custom-time">
                    <label htmlFor="complete-log-end">To</label>
                    <input id="complete-log-end" type="datetime-local" value={completeLogsEnd} onChange={(e) => setCompleteLogsEnd(e.target.value)} />
                  </div>
                  <button type="button" className="ad-btn ad-btn-primary ad-log-apply-range" disabled={!completeLogsStart || !completeLogsEnd || completeLogsLoading} onClick={() => {
                    const start = new Date(completeLogsStart);
                    const end = new Date(completeLogsEnd);
                    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
                      setCompleteLogsError('Choose a valid custom range where From is earlier than To.');
                      return;
                    }
                    fetchCompleteLogs(selectedApp, completeLogsMinutes, { start: start.toISOString(), end: end.toISOString() });
                  }}>Apply range</button>
                </>
              )}
              <div className="ad-log-search-wrap">
                <label htmlFor="complete-log-search">Search logs</label>
                <input
                  id="complete-log-search"
                  type="search"
                  value={completeLogsSearch}
                  onChange={(e) => setCompleteLogsSearch(e.target.value)}
                  placeholder="Search error, dependency, resource..."
                />
              </div>
              <button type="button" className="ad-btn ad-btn-primary ad-log-refresh" onClick={() => completeLogsRangeMode === 'custom' && completeLogsStart && completeLogsEnd
                ? fetchCompleteLogs(selectedApp, completeLogsMinutes, { start: new Date(completeLogsStart).toISOString(), end: new Date(completeLogsEnd).toISOString() })
                : fetchCompleteLogs(selectedApp, completeLogsMinutes)} disabled={completeLogsLoading}>
                {completeLogsLoading ? 'Refreshing…' : '↻ Refresh'}
              </button>
            </div>

            <div className="ad-log-modal-summary">
              <span><strong>{completeLogs.length}</strong> retrieved</span>
              <span><strong>{filteredCompleteLogs.length}</strong> shown</span>
              <span>Maximum 500 records per query</span>
            </div>

            <div className="ad-log-table-wrap">
              {completeLogsLoading ? (
                <div className="ad-log-empty">Loading complete Azure Log Analytics errors…</div>
              ) : completeLogsError ? (
                <div className="ad-log-empty error">{completeLogsError}</div>
              ) : filteredCompleteLogs.length === 0 ? (
                <div className="ad-log-empty">No matching error logs were found for this application and time range.</div>
              ) : (
                <table className="ad-log-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Source</th>
                      <th>Resource</th>
                      <th>Dependency</th>
                      <th>Level</th>
                      <th>Error message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompleteLogs.map((entry, index) => (
                      <tr key={`${entry.TimeGenerated}-${index}`}>
                        <td className="ad-log-time-cell">{entry.TimeGenerated ? new Date(entry.TimeGenerated).toLocaleString() : '—'}</td>
                        <td><span className={`ad-log-source ${String(entry.Source || '').toLowerCase()}`}>{entry.Source || '—'}</span></td>
                        <td>
                          <strong>{entry.ResourceName || '—'}</strong>
                          {entry.ResourceRole && <small>{entry.ResourceRole}</small>}
                        </td>
                        <td>{dependencyFromError(entry) || 'Application'}</td>
                        <td><span className={`ad-log-severity ${String(entry.Level || 'unknown').toLowerCase()}`}>{entry.Level || 'Unknown'}</span></td>
                        <td className="ad-log-message-cell"><pre>{entry.Message || '—'}</pre></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
